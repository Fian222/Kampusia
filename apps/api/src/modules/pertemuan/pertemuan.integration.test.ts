import { expect, test } from 'bun:test';
import { absensi, dosen, pertemuan, users } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { connect, fixture } from '../krs/krs.fixtures';
import { createKrsRepository } from '../krs/krs.repository';
import { createKrsService } from '../krs/krs.service';
import { createPertemuanRepository } from './pertemuan.repository';
import { createPertemuanService } from './pertemuan.service';

const enabled = Bun.env.RUN_ATTENDANCE_APP_DB_TESTS === '1';
test.skipIf(!enabled)('PostgreSQL meeting finalization is atomic and attendance survives KRS reopening', async () => {
  const { db, client } = connect(); const rollback = new Error('Rollback attendance fixture');
  try {
    await expect(db.transaction(async tx => {
      const f = await fixture(tx);
      const [lecturerAccount] = await tx.insert(users).values({ email: `${f.prefix.toLowerCase()}-lecturer@test.local`, passwordHash: 'unused-test-account', role: 'DOSEN' }).returning();
      await tx.update(dosen).set({ userId: lecturerAccount!.id }).where(eq(dosen.id, f.lecturer.id));
      const krsService = createKrsService(createKrsRepository(tx), 6);
      const plan = await krsService.create(f.user, f.term.id);
      await krsService.add(f.user, plan.id, f.classes[0]!.id);
      const service = createPertemuanService(createPertemuanRepository(tx));
      const meeting = await service.create(lecturerAccount!, f.classes[0]!.id, { nomor_pertemuan: 1, tanggal: f.term.tanggalMulai, jam_mulai: '08:00', jam_selesai: '10:00', materi: 'Integrasi' });
      expect((await service.roster(f.admin, meeting.id)).data).toHaveLength(0);
      await krsService.submit(f.user, plan.id); expect((await service.roster(f.admin, meeting.id)).data).toHaveLength(0);
      await krsService.approve(f.admin, plan.id); expect((await service.roster(f.admin, meeting.id)).data).toHaveLength(1);
      await expect(service.complete(lecturerAccount!, meeting.id)).rejects.toThrow('1 mahasiswa');
      expect((await tx.select().from(pertemuan).where(eq(pertemuan.id, meeting.id)))[0]!.status).toBe('TERJADWAL');
      expect(await tx.select().from(absensi).where(eq(absensi.pertemuanId, meeting.id))).toHaveLength(0);
      const recorded = await service.record(lecturerAccount!, meeting.id, f.students[0]!.id, { status: 'HADIR' });
      await service.complete(lecturerAccount!, meeting.id);
      expect((await tx.select().from(pertemuan).where(eq(pertemuan.id, meeting.id)))[0]!.status).toBe('SELESAI');
      await krsService.reopen(f.admin, plan.id, true);
      expect((await service.studentHistory(f.user, {})).data[0]!.status).toBe('HADIR');
      const historical = await service.roster(f.admin, meeting.id); expect(historical.data).toHaveLength(0); expect(historical.historical).toHaveLength(1);
      const corrected = await service.correct(f.admin, meeting.id, f.students[0]!.id, { status: 'IZIN', keterangan: 'Koreksi administrasi terverifikasi' });
      expect(corrected.id).toBe(recorded.id); expect(corrected.createdAt).toEqual(recorded.createdAt); expect(corrected.dicatatOleh).toBe(lecturerAccount!.id); expect(corrected.diubahOleh).toBe(f.admin.id);
      expect(await tx.select().from(absensi).where(eq(absensi.pertemuanId, meeting.id))).toHaveLength(1);
      throw rollback;
    }, { isolationLevel: 'serializable' })).rejects.toBe(rollback);
  } finally { await client.end(); }
}, 30000);
