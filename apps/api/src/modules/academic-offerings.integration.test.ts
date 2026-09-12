import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { fakultas, programStudi, mataKuliah, kurikulum, kurikulumMatkul, semester, kelasKuliah, dosen, kelasDosen, ruangan, jadwalKuliah, mahasiswa, users, krs, krsDetail } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { createSemesterRepository } from './semester/semester.repository';
import { createSemesterService } from './semester/semester.service';
import { createKelasKuliahRepository } from './kelas-kuliah/kelas-kuliah.repository';
import { createKelasKuliahService } from './kelas-kuliah/kelas-kuliah.service';
import { createKelasDosenRepository } from './kelas-dosen/kelas-dosen.repository';
import { createKelasDosenService } from './kelas-dosen/kelas-dosen.service';

test.skipIf(Bun.env.RUN_OFFERING_DB_TESTS !== '1')('PostgreSQL semester/class/lecturer transactions, constraints, filters, history and rollback', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Offering tests require local kampusia.');
  const { db, client } = createDatabase(url.toString());
  const prefix = 'T' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const rollback = new Error('Rollback offering fixtures');
  try {
    const activeBefore = (await db.select().from(semester)).filter(row => row.isActive).map(row => row.id);
    await expect(db.transaction(async tx => {
      const terms = createSemesterService(createSemesterRepository(tx));
      const classes = createKelasKuliahService(createKelasKuliahRepository(tx));
      const assignments = createKelasDosenService(createKelasDosenRepository(tx));
      const usedYears = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map(row => row.year));
      let year = 9900; while (usedYears.has(year) || usedYears.has(year + 1)) year -= 2;
      const termBody = (year: number) => ({ kode: `${year}1`, nama: prefix, tahun_mulai: year, jenis: 'GANJIL' as const, tanggal_mulai: `${year}-01-01`, tanggal_selesai: `${year}-06-30` });
      const a = await terms.create({ ...termBody(year), is_active: true });
      const b = await terms.create(termBody(year + 1));
      await terms.update(b.id, { is_active: true });
      expect((await terms.list({ is_active: 'true' })).data.map(row => row.id)).toEqual([b.id]);
      expect((await terms.get(a.id)).isActive).toBe(false);
      // Deactivation and failed insert share a savepoint: the previous active term survives.
      await expect(terms.create({ ...termBody(year), is_active: true })).rejects.toThrow('Kode semester');
      expect((await terms.list({ is_active: 'true' })).data.map(row => row.id)).toEqual([b.id]);
      await terms.update(a.id, { nama: prefix + ' corrected' });
      expect((await terms.list({ search: prefix, limit: 1, page: 2 })).meta).toEqual({ page: 2, limit: 1, total: 2 });
      expect((await terms.list({ tahun_mulai: year, jenis: 'GANJIL', is_active: 'false', search: prefix })).data[0]?.id).toBe(a.id);
      // Verify both independent unique constraints without invalidating the parent transaction.
      await expect(tx.transaction(save => save.insert(semester).values({ kode: a.kode, nama: prefix, tahunMulai: year, jenis: 'GANJIL', tanggalMulai: a.tanggalMulai, tanggalSelesai: a.tanggalSelesai }))).rejects.toThrow();
      const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
      const [program] = await tx.insert(programStudi).values({ fakultasId: faculty!.id, kode: prefix, nama: prefix, jenjang: 'S1' }).returning();
      const [course] = await tx.insert(mataKuliah).values({ kode: prefix, nama: prefix + ' Course', sks: 3 }).returning();
      const [curriculum] = await tx.insert(kurikulum).values({ programStudiId: program!.id, kode: prefix, nama: prefix, tahunBerlaku: 2026 }).returning();
      const body = { semester_id: a.id, mata_kuliah_id: course!.id, program_studi_id: program!.id, nama_kelas: ' a ', kapasitas: 30 };
      const row = await classes.create(body);
      expect(row.namaKelas).toBe('A'); expect(row.status).toBe('DRAFT');
      await expect(classes.create(body)).rejects.toThrow('sudah ada');
      await expect(classes.create({ ...body, semester_id: crypto.randomUUID() })).rejects.toThrow('Semester tidak ditemukan');
      for (const table of [programStudi, mataKuliah]) {
        const id = table === programStudi ? program!.id : course!.id;
        await tx.update(table).set({ isActive: false }).where(eq(table.id, id));
        await expect(classes.create({ ...body, nama_kelas: 'B' })).rejects.toThrow('aktif');
        await tx.update(table).set({ isActive: true }).where(eq(table.id, id));
      }
      await expect(classes.update(row.id, { status: 'DIBUKA' })).rejects.toThrow('kurikulum');
      await tx.insert(kurikulumMatkul).values({ kurikulumId: curriculum!.id, mataKuliahId: course!.id });
      await expect(classes.update(row.id, { status: 'DIBUKA' })).rejects.toThrow('dosen aktif');
      const lecturers = await tx.insert(dosen).values(['A', 'B'].map(suffix => ({ kodeDosen: prefix + suffix, nama: prefix + suffix }))).returning();
      const teacher = await assignments.add(row.id, { dosen_id: lecturers[0]!.id, is_koordinator: true });
      await expect(assignments.add(row.id, { dosen_id: lecturers[0]!.id })).rejects.toThrow('sudah ditugaskan');
      await expect(assignments.add(row.id, { dosen_id: lecturers[1]!.id, is_koordinator: true })).rejects.toThrow('satu koordinator');
      await tx.update(dosen).set({ isActive: false }).where(eq(dosen.id, lecturers[1]!.id));
      await expect(assignments.add(row.id, { dosen_id: lecturers[1]!.id })).rejects.toThrow('aktif');
      await tx.update(dosen).set({ isActive: true }).where(eq(dosen.id, lecturers[1]!.id));
      const second = await assignments.add(row.id, { dosen_id: lecturers[1]!.id });
      await expect(assignments.update(row.id, second.id, { is_koordinator: true })).rejects.toThrow('satu koordinator');
      await assignments.update(row.id, teacher.id, { is_koordinator: false });
      await assignments.update(row.id, second.id, { is_koordinator: true });
      expect((await assignments.list(row.id, { search: prefix, limit: 1, page: 2 })).meta).toEqual({ page: 2, limit: 1, total: 2 });
      // Partial unique index is authoritative even for a competing direct writer.
      await expect(tx.transaction(save => save.update(kelasDosen).set({ isKoordinator: true }).where(eq(kelasDosen.id, teacher.id)))).rejects.toThrow();
      await expect(classes.update(row.id, { status: 'DIBUKA' })).rejects.toThrow('jadwal');
      const other = await classes.create({ ...body, nama_kelas: 'B' });
      await expect(classes.update(other.id, { nama_kelas: 'A' })).rejects.toThrow('sudah ada');
      const page = await classes.list({ semester_id: a.id, mata_kuliah_id: course!.id, program_studi_id: program!.id, status: 'DRAFT', search: prefix, limit: 1, page: 2 });
      expect(page.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(page.data[0]?.id).toBe(other.id);
      expect((await classes.get(row.id)).dosen).toHaveLength(2);
      await expect(assignments.remove(other.id, teacher.id)).rejects.toThrow('tidak ditemukan');
      await classes.update(other.id, { kapasitas: 25 });
      await classes.update(other.id, { semester_id: b.id });
      const [room] = await tx.insert(ruangan).values({ kode: prefix, nama: prefix, kapasitas: 30 }).returning();
      // Test-only fixtures exercise historical guards; no schedule API or fake production schedule is created.
      await tx.insert(jadwalKuliah).values({ kelasKuliahId: row.id, ruanganId: room!.id, hari: 1, jamMulai: '08:00', jamSelesai: '10:00' });
      await expect(terms.update(a.id, { tanggal_selesai: `${year}-07-01` })).rejects.toThrow('riwayat');
      await expect(classes.update(row.id, { semester_id: b.id })).rejects.toThrow('Identitas');
      await expect(classes.update(row.id, { status: 'DIBUKA' })).rejects.toThrow('Jadwal');
      await expect(classes.update(row.id, { kapasitas: 31 })).rejects.toThrow('ruangan');
      await assignments.remove(row.id, second.id);
      await expect(assignments.add(row.id, { dosen_id: lecturers[1]!.id })).rejects.toThrow('Jadwal');
      await tx.update(kelasKuliah).set({ status: 'DIBUKA' }).where(eq(kelasKuliah.id, row.id));
      await expect(assignments.remove(row.id, teacher.id)).rejects.toThrow('mempertahankan');
      const [student] = await tx.insert(mahasiswa).values({ nim: prefix, nama: prefix, programStudiId: program!.id, kurikulumId: curriculum!.id, angkatan: 2026 }).returning();
      const [approver] = await tx.insert(users).values({ email: prefix.toLowerCase() + '@example.test', passwordHash: 'unused-test-hash', role: 'AKADEMIK' }).returning();
      const [plan] = await tx.insert(krs).values({ mahasiswaId: student!.id, semesterId: a.id, batasSks: 18, status: 'DISETUJUI', diajukanAt: new Date(), disetujuiAt: new Date(), disetujuiOleh: approver!.id }).returning();
      await tx.insert(krsDetail).values({ krsId: plan!.id, kelasKuliahId: row.id });
      expect((await classes.get(row.id)).jumlahMahasiswa).toBe(1);
      const [secondStudent] = await tx.insert(mahasiswa).values({ nim: prefix + 'B', nama: prefix, programStudiId: program!.id, kurikulumId: curriculum!.id, angkatan: 2026 }).returning();
      const [secondPlan] = await tx.insert(krs).values({ mahasiswaId: secondStudent!.id, semesterId: a.id, batasSks: 18, status: 'DISETUJUI', diajukanAt: new Date(), disetujuiAt: new Date(), disetujuiOleh: approver!.id }).returning();
      const [secondDetail] = await tx.insert(krsDetail).values({ krsId: secondPlan!.id, kelasKuliahId: row.id }).returning();
      expect((await classes.get(row.id)).jumlahMahasiswa).toBe(2);
      await expect(classes.update(row.id, { kapasitas: 1 })).rejects.toThrow('jumlah mahasiswa');
      await classes.update(row.id, { kapasitas: 2 });
      await tx.update(krsDetail).set({ status: 'DIBATALKAN' }).where(eq(krsDetail.id, secondDetail!.id));
      expect((await classes.get(row.id)).jumlahMahasiswa).toBe(1);
      await classes.update(row.id, { kapasitas: 1 });
      await expect(classes.update(row.id, { status: 'DIBATALKAN' })).rejects.toThrow('KRS');
      await tx.insert(krsDetail).values({ krsId: plan!.id, kelasKuliahId: other.id, status: 'DIBATALKAN' });
      await expect(classes.update(other.id, { semester_id: a.id })).rejects.toThrow('Identitas');
      await tx.update(krs).set({ status: 'DIBATALKAN' }).where(eq(krs.id, plan!.id));
      expect((await classes.get(row.id)).jumlahMahasiswa).toBe(0);
      // A retained approval timestamp freezes history even after cancellation, without a schedule.
      await tx.update(krs).set({ semesterId: b.id }).where(eq(krs.id, plan!.id));
      await expect(terms.update(b.id, { nama: 'Changed' })).rejects.toThrow('riwayat');
      await terms.update(b.id, { is_active: false });
      expect((await terms.list({ is_active: 'true' })).meta.total).toBe(0);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
    expect((await createSemesterRepository(db).list({ search: prefix })).meta.total).toBe(0);
    expect((await createKelasKuliahRepository(db).list({ search: prefix })).meta.total).toBe(0);
    expect((await db.select().from(semester)).filter(row => row.isActive).map(row => row.id)).toEqual(activeBefore);
  } finally { await client.end(); }
}, 30000);
