import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { fakultas, programStudi, mataKuliah, kurikulum, kurikulumMatkul, semester, kelasKuliah, dosen, kelasDosen, ruangan, jadwalKuliah, mahasiswa, users, krs, krsDetail } from '@kampusia/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createJadwalRepository, schedulingRepository } from './jadwal/jadwal.repository';
import { createJadwalService } from './jadwal/jadwal.service';
import { createRuanganRepository } from './ruangan/ruangan.repository';
import { createRuanganService } from './ruangan/ruangan.service';
import { createKelasKuliahRepository } from './kelas-kuliah/kelas-kuliah.repository';
import { createKelasKuliahService } from './kelas-kuliah/kelas-kuliah.service';
import { createKelasDosenRepository } from './kelas-dosen/kelas-dosen.repository';
import { createKelasDosenService } from './kelas-dosen/kelas-dosen.service';
import { postgresError } from '../utils/academic-write';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
function connect() {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Scheduling tests require local kampusia.');
  return createDatabase(url.toString());
}
async function fixture(tx: Transaction) {
  const prefix = 'J' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const used = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map(row => row.year));
  let year = 9800; while (used.has(year) || used.has(year + 1)) year -= 2;
  const terms = await tx.insert(semester).values([year, year + 1].map(tahunMulai => ({ kode: `${tahunMulai}1`, nama: prefix, tahunMulai, jenis: 'GANJIL' as const, tanggalMulai: '2090-01-01', tanggalSelesai: '2090-06-30' }))).returning();
  const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
  const [program] = await tx.insert(programStudi).values({ kode: prefix, nama: prefix, fakultasId: faculty!.id, jenjang: 'S1' }).returning();
  const [course] = await tx.insert(mataKuliah).values({ kode: prefix, nama: prefix, sks: 3 }).returning();
  const [curriculum] = await tx.insert(kurikulum).values({ kode: prefix, nama: prefix, programStudiId: program!.id, tahunBerlaku: 2026 }).returning();
  await tx.insert(kurikulumMatkul).values({ kurikulumId: curriculum!.id, mataKuliahId: course!.id });
  const classes = await tx.insert(kelasKuliah).values(['A', 'B', 'C'].map((namaKelas, i) => ({ namaKelas, semesterId: terms[i === 1 ? 1 : 0]!.id, programStudiId: program!.id, mataKuliahId: course!.id, kapasitas: 30 }))).returning();
  const rooms = await tx.insert(ruangan).values(['A', 'B'].map(suffix => ({ kode: prefix + suffix, nama: prefix, kapasitas: 40 }))).returning();
  const lecturers = await tx.insert(dosen).values(['A', 'B'].map(suffix => ({ kodeDosen: prefix + suffix, nama: prefix }))).returning();
  return { prefix, terms, faculty: faculty!, program: program!, course: course!, curriculum: curriculum!, classes, rooms, lecturers };
}

test.skipIf(Bun.env.RUN_SCHEDULING_DB_TESTS !== '1')('PostgreSQL schedule conflicts, opening, lecturer changes, approved plans and room history roll back', async () => {
  const { db, client } = connect(); const rollback = new Error('Rollback scheduling fixture'); let prefix = '';
  try {
    await expect(db.transaction(async tx => {
      const f = await fixture(tx); prefix = f.prefix;
      const [a, b, c] = f.classes; const [room, otherRoom] = f.rooms;
      const schedules = createJadwalService(createJadwalRepository(tx));
      const classes = createKelasKuliahService(createKelasKuliahRepository(tx));
      const lecturers = createKelasDosenService(createKelasDosenRepository(tx));
      const rooms = createRuanganService(createRuanganRepository(tx));
      const body = { ruangan_id: room!.id, hari: 1, jam_mulai: '08:00', jam_selesai: '10:00' };
      await expect(classes.update(a!.id, { status: 'DIBUKA' })).rejects.toThrow('dosen aktif');
      await lecturers.add(a!.id, { dosen_id: f.lecturers[0]!.id });
      await expect(classes.update(a!.id, { status: 'DIBUKA' })).rejects.toThrow('jadwal');
      const slot = await schedules.add(a!.id, body);
      expect((await schedules.list(a!.id, { limit: 1 })).meta.total).toBe(1);
      let duplicateError: unknown;
      try {
        await tx.transaction(nested => nested.insert(jadwalKuliah).values({
          kelasKuliahId: a!.id,
          ruanganId: otherRoom!.id,
          hari: 2,
          jamMulai: '10:00',
          jamSelesai: '12:00',
        }));
      } catch (error) { duplicateError = error; }
      expect(postgresError(duplicateError)).toEqual({ code: '23505', constraint: 'jadwal_kuliah_kelas_kuliah_id_unique' });
      await tx.update(ruangan).set({ isActive: false }).where(eq(ruangan.id, room!.id));
      await expect(classes.update(a!.id, { status: 'DIBUKA' })).rejects.toThrow('nonaktif');
      await tx.update(ruangan).set({ isActive: true }).where(eq(ruangan.id, room!.id));
      expect((await classes.update(a!.id, { status: 'DIBUKA' })).status).toBe('DIBUKA');
      await expect(schedules.add(a!.id, { ...body, ruangan_id: otherRoom!.id, jam_mulai: '09:00' }))
        .rejects.toThrow('Jadwal kelas sudah tersedia. Edit jadwal yang ada.');
      await expect(schedules.add(b!.id, body)).rejects.toThrow('ruangan'); // Different semester, same effective dates.
      const other = await schedules.add(b!.id, { ...body, ruangan_id: otherRoom!.id });
      await expect(lecturers.add(b!.id, { dosen_id: f.lecturers[0]!.id })).rejects.toThrow('dosen');
      expect((await lecturers.list(b!.id, {})).meta.total).toBe(0);
      await lecturers.add(b!.id, { dosen_id: f.lecturers[1]!.id });
      await classes.update(b!.id, { status: 'DIBUKA' });
      await expect(schedules.update(b!.id, other.id, { ruangan_id: room!.id })).rejects.toThrow('ruangan');
      await schedules.update(b!.id, other.id, { jam_mulai: '10:00', jam_selesai: '12:00', ruangan_id: room!.id });
      await lecturers.add(b!.id, { dosen_id: f.lecturers[0]!.id }); // Adjacent teaching allowed.
      await expect(schedules.update(b!.id, other.id, { ruangan_id: otherRoom!.id, jam_mulai: '09:30' })).rejects.toThrow('dosen');
      await expect(rooms.update(room!.id, { kapasitas: 29 })).rejects.toThrow('kapasitas kelas');
      await expect(rooms.update(room!.id, { is_active: false })).rejects.toThrow('mendatang');
      await expect(rooms.create({ kode: room!.kode, nama: 'Duplicate', kapasitas: 50 })).rejects.toThrow('Kode ruangan');
      expect((await rooms.list({ search: prefix, is_active: 'true', limit: 1, page: 2 })).meta.total).toBe(2);
      await rooms.update(otherRoom!.id, { is_active: false }); await rooms.update(otherRoom!.id, { is_active: true });
      // Same approved student in two classes: moving the free-room/free-lecturer slot must still fail.
      const studentSlot = await schedules.add(c!.id, { ...body, ruangan_id: otherRoom!.id, hari: 2 });
      const [student] = await tx.insert(mahasiswa).values({ nim: prefix, nama: prefix, programStudiId: f.program.id, kurikulumId: f.curriculum.id, angkatan: 2026 }).returning();
      const [approver] = await tx.insert(users).values({ email: prefix.toLowerCase() + '@example.test', passwordHash: 'unused', role: 'AKADEMIK' }).returning();
      const [plan] = await tx.insert(krs).values({ mahasiswaId: student!.id, semesterId: a!.semesterId, batasSks: 18, status: 'DISETUJUI', diajukanAt: new Date(), disetujuiAt: new Date(), disetujuiOleh: approver!.id }).returning();
      await tx.insert(krsDetail).values([a!, c!].map(row => ({ krsId: plan!.id, kelasKuliahId: row.id })));
      await expect(schedules.update(c!.id, studentSlot.id, { hari: 1 })).rejects.toThrow('KRS mahasiswa');
      expect((await schedules.list(c!.id, {})).data[0]!.hari).toBe(2);
      await expect(schedules.remove(c!.id, studentSlot.id)).rejects.toThrow('riwayat KRS');
      await expect(classes.update(a!.id, { status: 'DIBATALKAN' })).rejects.toThrow('KRS');
      await expect(schedules.remove(b!.id, other.id)).rejects.toThrow('setidaknya satu');
      await classes.update(b!.id, { status: 'DIBATALKAN' });
      await schedules.remove(b!.id, other.id);
      await schedules.add(b!.id, body); // Cancelled classes release reservations.
      await expect(classes.update(b!.id, { status: 'DRAFT' })).rejects.toThrow('ruangan');
      expect((await classes.get(b!.id)).status).toBe('DIBATALKAN');
      // Across-semester disjoint dates are permitted, despite equal room/time.
      await schedules.remove(b!.id, (await schedules.list(b!.id, {})).data[0]!.id);
      await tx.update(semester).set({ tanggalMulai: '2091-01-01', tanggalSelesai: '2091-06-30' }).where(eq(semester.id, b!.semesterId));
      const recreated = await schedules.add(b!.id, body);
      await classes.update(b!.id, { status: 'DRAFT' });
      expect((await schedules.list(b!.id, {})).data[0]!.id).toBe(recreated.id);
      expect((await schedules.list(a!.id, {})).data[0]!.id).toBe(slot.id);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
    expect((await createRuanganRepository(db).list({ search: prefix })).meta.total).toBe(0);
  } finally { await client.end(); }
}, 30000);

// Real independent transactions require committed fixtures. Delete only the exact test-owned IDs in finally.
test.skipIf(Bun.env.RUN_SCHEDULING_DB_TESTS !== '1')('PostgreSQL concurrent room/lecturer writes retry and preserve conflict-free schedules', async () => {
  const { db, client } = connect(); let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    f = await db.transaction(fixture);
    const [a, b] = f.classes; const body = { ruangan_id: f.rooms[0]!.id, hari: 1, jam_mulai: '08:00', jam_selesai: '10:00' };
    let arrivals = 0; let attempts = 0; let release!: () => void;
    let gate = new Promise<void>(resolve => { release = resolve; });
    const repository = createJadwalRepository(db);
    // Hold the first two transactions after their conflict reads, forcing the write-skew race.
    const service = createJadwalService({ ...repository, transaction: operation => db.transaction(async tx => {
      attempts++;
      const repo = schedulingRepository(tx);
      return operation({ ...repo, candidates: async (slot, dates, classId) => {
        const result = await repo.candidates(slot, dates, classId);
        if (++arrivals <= 2) { if (arrivals === 2) release(); await gate; }
        return result;
      } });
    }, { isolationLevel: 'serializable' }) });
    const results = await Promise.allSettled([service.add(a!.id, body), service.add(b!.id, body)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(attempts).toBeGreaterThanOrEqual(3);
    expect((await db.select().from(jadwalKuliah).where(inArray(jadwalKuliah.kelasKuliahId, [a!.id, b!.id])))).toHaveLength(1);
    await db.delete(jadwalKuliah).where(inArray(jadwalKuliah.kelasKuliahId, f.classes.map(row => row.id)));
    // A lecturer shared by classes in different rooms must receive the same protection.
    await db.insert(kelasDosen).values([a!, b!].map(row => ({ kelasKuliahId: row.id, dosenId: f!.lecturers[0]!.id })));
    arrivals = 0; attempts = 0; gate = new Promise<void>(resolve => { release = resolve; });
    const teacherResults = await Promise.allSettled([service.add(a!.id, body), service.add(b!.id, { ...body, ruangan_id: f.rooms[1]!.id })]);
    expect(teacherResults.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts).toBeGreaterThanOrEqual(3);
    const rejected = teacherResults.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.message).toContain('dosen');
  } finally {
    if (f) {
      const fixture = f;
      await db.transaction(async tx => {
        await tx.delete(jadwalKuliah).where(inArray(jadwalKuliah.kelasKuliahId, fixture.classes.map(row => row.id)));
        await tx.delete(kelasDosen).where(inArray(kelasDosen.kelasKuliahId, fixture.classes.map(row => row.id)));
        await tx.delete(kelasKuliah).where(inArray(kelasKuliah.id, fixture.classes.map(row => row.id)));
        await tx.delete(ruangan).where(inArray(ruangan.id, fixture.rooms.map(row => row.id)));
        await tx.delete(dosen).where(inArray(dosen.id, fixture.lecturers.map(row => row.id)));
        await tx.delete(kurikulumMatkul).where(eq(kurikulumMatkul.kurikulumId, fixture.curriculum.id));
        await tx.delete(kurikulum).where(eq(kurikulum.id, fixture.curriculum.id));
        await tx.delete(mataKuliah).where(eq(mataKuliah.id, fixture.course.id));
        await tx.delete(programStudi).where(eq(programStudi.id, fixture.program.id));
        await tx.delete(fakultas).where(eq(fakultas.id, fixture.faculty.id));
        await tx.delete(semester).where(inArray(semester.id, fixture.terms.map(row => row.id)));
      });
    }
    await client.end();
  }
}, 30000);
