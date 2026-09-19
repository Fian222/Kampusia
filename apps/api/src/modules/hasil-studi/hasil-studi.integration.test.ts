import { expect, test } from 'bun:test';
import { hasilStudi, kelasKuliah } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { connect, fixture } from '../krs/krs.fixtures';
import { createKrsRepository } from '../krs/krs.repository';
import { createKrsService } from '../krs/krs.service';
import { createHasilStudiRepository } from './hasil-studi.repository';
import { createHasilStudiService } from './hasil-studi.service';

const enabled = Bun.env.RUN_ACADEMIC_RESULTS_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL KHS/IPK queries use finalized snapshots and retain them after KRS reopening', async () => {
  const { db, client } = connect();
  const rollback = new Error('Rollback academic-result fixture');
  try {
    await expect(db.transaction(async tx => {
      const f = await fixture(tx);
      await tx.update(kelasKuliah).set({ kapasitas: 2 }).where(eq(kelasKuliah.id, f.classes[0]!.id));
      const student = { id: f.user.id, loginId: f.user.loginId, email: f.user.email, role: f.user.role, mustChangePassword: false };
      const manager = { id: f.admin.id, loginId: f.admin.loginId, email: f.admin.email, role: f.admin.role, mustChangePassword: false };
      const krsService = createKrsService(createKrsRepository(tx), 12);
      const plan = await krsService.create(student, f.term.id);
      for (const kelas of f.classes) await krsService.add(student, plan.id, kelas.id);
      await krsService.submit(student, plan.id);
      await krsService.approve(manager, plan.id);

      await tx.insert(hasilStudi).values([
        { kelasKuliahId: f.classes[0]!.id, mahasiswaId: f.students[0]!.id, nilaiAngka: '80.00', nilaiHuruf: 'A', nilaiIndeks: '3.33', difinalisasiAt: new Date(), difinalisasiOleh: f.admin.id },
        { kelasKuliahId: f.classes[1]!.id, mahasiswaId: f.students[0]!.id, nilaiAngka: '0.00', nilaiHuruf: 'E', nilaiIndeks: '0.00', difinalisasiAt: new Date(), difinalisasiOleh: f.admin.id },
      ]);

      const service = createHasilStudiService(createHasilStudiRepository(tx));
      const khs = await service.ownKhs(student, f.term.id);
      expect(khs.courses).toHaveLength(2);
      expect(khs.summary).toMatchObject({ totalSks: 6, totalBobot: '9.99', ips: '1.67', unfinishedCourseCount: 1, provisional: true });
      expect((await service.studentIpk(manager, f.students[0]!.id)).ipk).toBe('1.67');

      await krsService.reopen(manager, plan.id, true);
      const retained = await service.ownKhs(student, f.term.id);
      expect(retained.courses).toHaveLength(2);
      expect(retained.summary.totalSks).toBe(6);
      expect(retained.summary.unfinishedCourseCount).toBe(0);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
}, 30000);
