import { expect, test } from 'bun:test';
import { hasilStudi, kelasKuliah, krs, krsDetail, semester } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { createKrsRepository, krsTransaction } from './krs.repository';
import { createKrsService } from './krs.service';
import { createKelasKuliahRepository } from '../kelas-kuliah/kelas-kuliah.repository';
import { createJadwalRepository } from '../jadwal/jadwal.repository';
import { createJadwalService } from '../jadwal/jadwal.service';
import { connect, fixture, cleanup } from './krs.fixtures';
const enabled = Bun.env.RUN_KRS_DB_TESTS === '1';
test.skipIf(!enabled)('PostgreSQL KRS lifecycle, scoped queries, uniqueness, effective counts and atomic approval roll back', async () => {
  const { db, client } = connect(); const rollback = new Error('Rollback KRS fixture');
  try {
    await expect(db.transaction(async tx => {
      const f = await fixture(tx); const service = createKrsService(createKrsRepository(tx), 6);
      const classService = createKelasKuliahRepository(tx);
      const a = f.classes[0]!, b = f.classes[1]!;
      expect((await classService.findById(a.id))!.jumlahMahasiswa).toBe(0);
      const plan = await service.create(f.user, f.term.id); expect((await service.create(f.user, f.term.id)).id).toBe(plan.id);
      expect((await service.available(f.user, f.term.id, { search: f.prefix, limit: 1, page: 2 })).meta.total).toBe(3);
      const first = await service.add(f.user, plan.id, a.id);
      await expect(service.add(f.user, plan.id, a.id)).rejects.toThrow('sudah dipilih');
      expect((await service.available(f.user, f.term.id, {})).meta.total).toBe(2);
      await expect(service.submit(f.other, plan.id)).rejects.toThrow('tidak ditemukan');
      await service.remove(f.user, plan.id, first.id); expect((await service.add(f.user, plan.id, a.id)).id).toBe(first.id);
      await service.add(f.user, plan.id, b.id); await service.submit(f.user, plan.id);
      const competing = await service.create(f.other, f.term.id); await service.add(f.other, competing.id, b.id); await service.submit(f.other, competing.id);
      expect((await classService.findById(b.id))!.jumlahMahasiswa).toBe(0);
      await service.approve(f.admin, competing.id);
      // One full class aborts the entire multi-class approval.
      await expect(service.approve(f.admin, plan.id)).rejects.toThrow('penuh');
      expect((await service.get(f.admin, plan.id)).status).toBe('DIAJUKAN'); expect((await classService.findById(a.id))!.jumlahMahasiswa).toBe(0);
      await service.cancel(f.admin, competing.id); expect((await classService.findById(b.id))!.jumlahMahasiswa).toBe(0);
      await service.approve(f.admin, plan.id); expect((await classService.findById(a.id))!.jumlahMahasiswa).toBe(1);
      const list = await service.list(f.admin, { search: f.students[0]!.nim, semester_id: f.term.id, program_studi_id: f.program.id, status: 'DISETUJUI', limit: 1 });
      expect(list.meta.total).toBe(1); expect(list.data[0]!.id).toBe(plan.id); expect((await service.get(f.admin, plan.id)).totalSks).toBe(6);
      expect((await service.list(f.admin, { search: f.prefix, status: 'DITOLAK' })).meta.total).toBe(0);
      const schedules = createJadwalService(createJadwalRepository(tx));
      await expect(schedules.update(b.id, f.slots[1]!.id, { hari: 1 })).rejects.toThrow('bentrok');
      await service.reopen(f.admin, plan.id, true); expect((await classService.findById(a.id))!.jumlahMahasiswa).toBe(0);
      expect((await service.get(f.admin, plan.id)).disetujuiAt).toBeNull();
      await service.submit(f.user, plan.id); const pendingAt = (await service.get(f.admin, plan.id)).diajukanAt;
      await service.reject(f.admin, plan.id); expect((await service.get(f.admin, plan.id)).diajukanAt).toEqual(pendingAt);
      await service.reopen(f.user, plan.id); await service.submit(f.user, plan.id); await service.approve(f.admin, plan.id);
      const approved = await service.get(f.admin, plan.id); await service.cancel(f.admin, plan.id);
      const cancelled = await service.get(f.admin, plan.id); expect(cancelled.disetujuiAt).toEqual(approved.disetujuiAt); expect(cancelled.disetujuiOleh).toBe(f.admin.id); expect(cancelled.details.every(row => row.status === 'DIBATALKAN')).toBe(true);
      await expect(service.create(f.user, f.term.id)).rejects.toThrow('DIBATALKAN');
      await expect(tx.transaction(inner => inner.insert(krs).values({ mahasiswaId: f.students[0]!.id, semesterId: f.term.id, batasSks: 6 }))).rejects.toThrow();
      await expect(tx.transaction(inner => inner.insert(krsDetail).values({ krsId: plan.id, kelasKuliahId: a.id }))).rejects.toThrow();
      await expect(tx.transaction(inner => inner.update(krs).set({ status: 'DRAFT' }).where(eq(krs.id, plan.id)))).rejects.toThrow();
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
  } finally { await client.end(); }
}, 30000);

test.skipIf(!enabled)('PostgreSQL KRS creation derives a complete previous IPS snapshot and falls back for unfinished results', async () => {
  const { db, client } = connect(); const rollback = new Error('Rollback dynamic KRS-limit fixture');
  try {
    await expect(db.transaction(async tx => {
      const usedYears = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map(row => row.year));
      let year = 8998; while (usedYears.has(year) && year > 1900) year--;
      if (usedYears.has(year)) throw new Error('No unused academic year is available for the KRS limit test.');
      await tx.update(semester).set({ isActive: false }).where(eq(semester.isActive, true));
      const [previous, target] = await tx.insert(semester).values([
        { kode: `${year}1`, nama: `Ganjil ${year}`, tahunMulai: year, jenis: 'GANJIL', tanggalMulai: `${year}-01-01`, tanggalSelesai: `${year}-06-30` },
        { kode: `${year}2`, nama: `Genap ${year}`, tahunMulai: year, jenis: 'GENAP', tanggalMulai: `${year}-08-01`, tanggalSelesai: `${year}-12-31`, isActive: true },
      ]).returning();
      const f = await fixture(tx); expect(f.term.id).toBe(target!.id);
      const previousClasses = await tx.insert(kelasKuliah).values(f.courses.slice(0, 2).map(course => ({
        semesterId: previous!.id, mataKuliahId: course.id, programStudiId: f.program.id, namaKelas: 'P', kapasitas: 30, status: 'DITUTUP' as const,
      }))).returning();
      const finalizedAt = new Date();
      await tx.insert(hasilStudi).values([
        { kelasKuliahId: previousClasses[0]!.id, mahasiswaId: f.students[0]!.id, nilaiAngka: '99.00', nilaiHuruf: 'A', nilaiIndeks: '2.50', difinalisasiAt: finalizedAt, difinalisasiOleh: f.admin.id },
        { kelasKuliahId: previousClasses[0]!.id, mahasiswaId: f.students[1]!.id, nilaiAngka: '99.00', nilaiHuruf: 'A', nilaiIndeks: '4.00', difinalisasiAt: finalizedAt, difinalisasiOleh: f.admin.id },
      ]);
      const [unfinishedPlan] = await tx.insert(krs).values({ mahasiswaId: f.students[1]!.id, semesterId: previous!.id, batasSks: 18, status: 'DISETUJUI', diajukanAt: finalizedAt, disetujuiAt: finalizedAt, disetujuiOleh: f.admin.id }).returning();
      await tx.insert(krsDetail).values(previousClasses.map(kelas => ({ krsId: unfinishedPlan!.id, kelasKuliahId: kelas.id })));

      const service = createKrsService(createKrsRepository(tx), 6);
      const calculated = await service.create(f.user, target!.id);
      expect(calculated).toMatchObject({ batasSks: 21, batasSksSource: 'PREVIOUS_IPS', previousIps: '2.50', previousSemester: { id: previous!.id } });
      const fallback = await service.create(f.other, target!.id);
      expect(fallback).toMatchObject({ batasSks: 6, batasSksSource: 'INITIAL_FALLBACK', fallbackReason: 'UNFINISHED_RESULTS' });

      await tx.update(hasilStudi).set({ nilaiIndeks: '1.00' }).where(eq(hasilStudi.mahasiswaId, f.students[0]!.id));
      expect(await service.create(f.user, target!.id)).toMatchObject({ id: calculated.id, batasSks: 21, batasSksSource: 'EXISTING_SNAPSHOT' });
      await service.add(f.user, calculated.id, f.classes[0]!.id); await service.submit(f.user, calculated.id); await service.approve(f.admin, calculated.id); await service.reopen(f.admin, calculated.id, true);
      expect((await service.get(f.admin, calculated.id)).batasSks).toBe(21);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
  } finally { await client.end(); }
}, 30000);

test.skipIf(!enabled)('PostgreSQL independent KRS approvals compete for final seat with ordered class locks and retries', async () => {
  const { db, client } = connect(); let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    f = await db.transaction(fixture); const service = createKrsService(createKrsRepository(db), 6);
    const plans = await Promise.all([service.create(f.user, f.term.id), service.create(f.other, f.term.id)]);
    for (let i = 0; i < 2; i++) { await service.add(f.accounts[i]!, plans[i]!.id, f.classes[0]!.id); await service.submit(f.accounts[i]!, plans[i]!.id); }
    let arrivals = 0, attempts = 0; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const racing = createKrsService({ transaction: operation => db.transaction(async tx => {
      attempts++; const repo = krsTransaction(tx);
      return operation({ ...repo, lockClasses: async ids => {
        // Both serializable snapshots exist before either takes the contested class lock.
        if (++arrivals <= 2) { if (arrivals === 2) release(); await gate; }
        await repo.lockClasses(ids);
      } });
    }, { isolationLevel: 'serializable' }) }, 6);
    const results = await Promise.allSettled(plans.map(plan => racing.approve(f!.admin, plan.id)));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1); expect(results.filter(row => row.status === 'rejected')).toHaveLength(1);
    expect(attempts).toBeGreaterThanOrEqual(3);
    const rejected = results.find(row => row.status === 'rejected'); expect(rejected?.status === 'rejected' && rejected.reason.message).toContain('penuh');
    expect((await createKelasKuliahRepository(db).findById(f.classes[0]!.id))!.jumlahMahasiswa).toBe(1);
    const saved = await service.list(f.admin, { program_studi_id: f.program.id }); expect(saved.data.filter(row => row.status === 'DISETUJUI')).toHaveLength(1);
  } finally { try { if (f) await cleanup(db, f); } finally { await client.end(); } }
}, 30000);

test.skipIf(!enabled)('PostgreSQL concurrent initial creation returns a single draft', async () => {
  const { db, client } = connect(); let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    f = await db.transaction(fixture); const service = createKrsService(createKrsRepository(db), 6);
    const plans = await Promise.all([service.create(f.user, f.term.id), service.create(f.user, f.term.id)]);
    expect(plans[0]!.id).toBe(plans[1]!.id);
    expect((await service.mine(f.user, {})).meta.total).toBe(1);
  } finally { try { if (f) await cleanup(db, f); } finally { await client.end(); } }
}, 30000);
