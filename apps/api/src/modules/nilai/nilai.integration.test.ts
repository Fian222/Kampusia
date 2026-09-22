import { expect, test } from 'bun:test';
import { hasilStudi, kelasKuliah, komponenNilai, nilaiMahasiswa } from '@kampusia/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { cleanup, connect, fixture } from '../krs/krs.fixtures';
import { createKrsRepository } from '../krs/krs.repository';
import { createKrsService } from '../krs/krs.service';
import { createNilaiRepository } from './nilai.repository';
import { createNilaiService } from './nilai.service';

const enabled = Bun.env.RUN_GRADING_APP_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL class finalization and correction are atomic and retained across KRS reopening', async () => {
  const { db, client } = connect(); const rollback = new Error('Rollback grading application fixture');
  try {
    await expect(db.transaction(async tx => {
      const f = await fixture(tx); const classId = f.classes[0]!.id;
      await tx.update(kelasKuliah).set({ kapasitas: 2 }).where(eq(kelasKuliah.id, classId));
      const krsService = createKrsService(createKrsRepository(tx), 6);
      const plans = [];
      for (const account of [f.user, f.other]) { const plan = await krsService.create(account, f.term.id); await krsService.add(account, plan.id, classId); await krsService.submit(account, plan.id); await krsService.approve(f.admin, plan.id); plans.push(plan); }
      await tx.update(kelasKuliah).set({ status: 'DITUTUP' }).where(eq(kelasKuliah.id, classId));
      const service = createNilaiService(createNilaiRepository(tx));
      const task = await service.createComponent(f.adviser, classId, { nama: 'Tugas', bobot: '40', urutan: 1 });
      const exam = await service.createComponent(f.adviser, classId, { nama: 'Ujian', bobot: '60', urutan: 2 });
      await service.record(f.adviser, classId, f.students[0]!.id, task.id, { nilai: '80' }); await service.record(f.adviser, classId, f.students[0]!.id, exam.id, { nilai: '90' });
      await service.record(f.adviser, classId, f.students[1]!.id, task.id, { nilai: '70' });
      await expect(service.finalize(f.adviser, classId)).rejects.toThrow('belum lengkap');
      expect(await tx.select().from(hasilStudi).where(eq(hasilStudi.kelasKuliahId, classId))).toHaveLength(0);
      await service.record(f.adviser, classId, f.students[1]!.id, exam.id, { nilai: '75' });
      const finalized = await service.finalize(f.adviser, classId); expect(finalized.data).toHaveLength(2); expect(new Set(finalized.data.map(row => row.difinalisasiAt.valueOf())).size).toBe(1);
      const original = finalized.data.find(row => row.mahasiswaId === f.students[0]!.id)!;
      const corrected = await service.correct(f.admin, classId, f.students[0]!.id, { component_id: exam.id, nilai: '100', alasan: 'Berita acara koreksi ujian' });
      expect(corrected.id).toBe(original.id); expect(corrected.difinalisasiAt).toEqual(original.difinalisasiAt); expect(corrected.difinalisasiOleh).toBe(original.difinalisasiOleh); expect(corrected.nilaiAngka).toBe('92.00');
      await krsService.reopen(f.admin, plans[0]!.id, true);
      expect(await tx.select().from(hasilStudi).where(eq(hasilStudi.kelasKuliahId, classId))).toHaveLength(2);
      expect((await service.roster(f.admin, classId)).data).toHaveLength(1);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
  } finally { await client.end(); }
}, 30000);

test.skipIf(!enabled)('PostgreSQL concurrent finalization produces one complete unique result set', async () => {
  const { db, client } = connect(); let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    f = await db.transaction(tx => fixture(tx)); const classId = f.classes[0]!.id;
    const krsService = createKrsService(createKrsRepository(db), 6);
    const plan = await krsService.create(f.user, f.term.id); await krsService.add(f.user, plan.id, classId); await krsService.submit(f.user, plan.id); await krsService.approve(f.admin, plan.id);
    await db.update(kelasKuliah).set({ status: 'DITUTUP' }).where(eq(kelasKuliah.id, classId));
    const service = createNilaiService(createNilaiRepository(db)); const component = await service.createComponent(f.adviser, classId, { nama: 'Final', bobot: '100', urutan: 1 }); await service.record(f.adviser, classId, f.students[0]!.id, component.id, { nilai: '88' });
    const attempts = await Promise.allSettled([service.finalize(f.adviser, classId), service.finalize(f.adviser, classId)]);
    expect(attempts.filter(row => row.status === 'fulfilled')).toHaveLength(1); expect(attempts.filter(row => row.status === 'rejected')).toHaveLength(1);
    expect(await db.select().from(hasilStudi).where(eq(hasilStudi.kelasKuliahId, classId))).toHaveLength(1);
  } finally {
    if (f) {
      const classIds = f.classes.map(row => row.id);
      await db.delete(hasilStudi).where(inArray(hasilStudi.kelasKuliahId, classIds));
      await db.delete(nilaiMahasiswa).where(inArray(nilaiMahasiswa.komponenNilaiId, db.select({ id: komponenNilai.id }).from(komponenNilai).where(inArray(komponenNilai.kelasKuliahId, classIds))));
      await db.delete(komponenNilai).where(inArray(komponenNilai.kelasKuliahId, classIds));
      await cleanup(db, f);
    }
    await client.end();
  }
}, 30000);
