import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { fakultas, kurikulum, mahasiswa, programStudi, users } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
import { createMahasiswaRepository } from './mahasiswa/mahasiswa.repository';
import { createMahasiswaService } from './mahasiswa/mahasiswa.service';
import { createDosenRepository } from './dosen/dosen.repository';
import { createDosenService } from './dosen/dosen.service';
import { createAuthRepository } from './auth/auth.repository';
import { createAuthService } from './auth/auth.service';
import { createApp } from '../app';

test.skipIf(Bun.env.RUN_PROFILE_DB_TESTS !== '1')('PostgreSQL profile queries, constraints, account links and history (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('Profile integration tests require local kampusia.');
  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback profile fixtures');
  const prefix = 'T' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(10)), value => String(value % 10)).join('');
  try {
    await expect(db.transaction(async tx => {
      const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
      const [program] = await tx.insert(programStudi).values({ fakultasId: faculty!.id, kode: prefix, nama: prefix, jenjang: 'S1' }).returning();
      const [curriculum] = await tx.insert(kurikulum).values({ programStudiId: program!.id, kode: prefix, nama: prefix, tahunBerlaku: 2026 }).returning();
      const accounts = await tx.insert(users).values([
        { loginId: digits + '01', email: prefix.toLowerCase() + '-student@kampusia.test', passwordHash: 'test-only-no-login', role: 'MAHASISWA' as const },
        { loginId: digits + '02', email: prefix.toLowerCase() + '-lecturer@kampusia.test', passwordHash: 'test-only-no-login', role: 'DOSEN' as const },
        { loginId: digits + '03', email: prefix.toLowerCase() + '-collision@kampusia.test', passwordHash: 'test-only-no-login', role: 'ADMIN' as const },
      ]).returning();
      const students = createMahasiswaService(createMahasiswaRepository(tx));
      const lecturers = createDosenService(createDosenRepository(tx));
      const body = { nim: digits + '01', nama: prefix + ' Nama', program_studi_id: program!.id, kurikulum_id: curriculum!.id, angkatan: 2026 };
      const first = await students.create({ ...body, nim: ' ' + body.nim + ' ', status: 'CUTI' });
      expect(first).not.toHaveProperty('userId');
      expect((await students.get(first.id)).account).toEqual({ loginId: digits + '01', email: accounts[0]!.email, isActive: true });
      const second = await students.create({ ...body, nim: digits + '11', status: 'CUTI' });
      await students.create({ ...body, nim: digits + '12', nama: prefix + '_%', angkatan: 2025 });
      const provisionedProfile = await students.create({ ...body, nim: digits + '13', nama: prefix + ' Provisioned' });
      const provisioned = await students.provisionAccount(provisionedProfile.id);
      expect(provisioned.account).toEqual({ loginId: digits + '13', role: 'MAHASISWA', isActive: true });
      expect(provisioned.temporaryPassword).not.toBeNull();
      const [storedProvisioned] = await tx.select().from(users).where(eq(users.loginId, digits + '13'));
      expect(storedProvisioned!.mustChangePassword).toBe(true);
      expect(storedProvisioned!.passwordHash).not.toContain(provisioned.temporaryPassword!);
      expect(await Bun.password.verify(provisioned.temporaryPassword!, storedProvisioned!.passwordHash)).toBe(true);
      expect((await tx.select({ userId: mahasiswa.userId }).from(mahasiswa).where(eq(mahasiswa.id, provisionedProfile.id)))[0]!.userId).toBe(storedProvisioned!.id);
      const firstHash = storedProvisioned!.passwordHash;
      const reset = await students.resetPassword(provisionedProfile.id);
      const [afterReset] = await tx.select().from(users).where(eq(users.id, storedProvisioned!.id));
      expect(afterReset!.id).toBe(storedProvisioned!.id);
      expect(afterReset!.loginId).toBe(digits + '13');
      expect(afterReset!.passwordHash).not.toBe(firstHash);
      expect(await Bun.password.verify(provisioned.temporaryPassword!, afterReset!.passwordHash)).toBe(false);
      expect(await Bun.password.verify(reset.temporaryPassword, afterReset!.passwordHash)).toBe(true);
      expect(afterReset!.mustChangePassword).toBe(true);
      await expect(students.provisionAccount(provisionedProfile.id)).rejects.toThrow('sudah memiliki akun');
      const auth = createAuthService(createAuthRepository(tx));
      const app = createApp(auth, { webOrigin: 'http://localhost:5173', production: false });
      const request = (path: string, method = 'GET', cookie?: string, requestBody?: unknown) => app.handle(new Request('http://localhost' + path, {
        method, headers: { origin: 'http://localhost:5173', ...(cookie ? { cookie } : {}), ...(requestBody ? { 'content-type': 'application/json' } : {}) },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      }));
      const login = await request('/auth/login', 'POST', undefined, { login_id: digits + '13', password: reset.temporaryPassword });
      expect(login.status).toBe(200);
      const temporaryCookie = login.headers.get('set-cookie')!.split(';')[0]!;
      expect((await request('/dashboard/mahasiswa', 'GET', temporaryCookie)).status).toBe(403);
      const changed = await request('/auth/change-password', 'POST', temporaryCookie, { new_password: 'Integration-New-Password-2026!', confirmation: 'Integration-New-Password-2026!' });
      expect(changed.status).toBe(200);
      const changedCookie = changed.headers.get('set-cookie')!.split(';')[0]!;
      expect((await request('/dashboard/mahasiswa', 'GET', changedCookie)).status).toBe(200);
      expect((await request('/auth/login', 'POST', undefined, { login_id: digits + '13', password: reset.temporaryPassword })).status).toBe(401);
      const administrativeReset = await students.resetPassword(provisionedProfile.id);
      expect((await request('/dashboard/mahasiswa', 'GET', changedCookie)).status).toBe(401);
      const relogin = await request('/auth/login', 'POST', undefined, { login_id: digits + '13', password: administrativeReset.temporaryPassword });
      expect(relogin.status).toBe(200);
      expect(((await relogin.json()) as { data: { mustChangePassword: boolean } }).data.mustChangePassword).toBe(true);
      const page = await students.list({ search: prefix, program_studi_id: program!.id, kurikulum_id: curriculum!.id, angkatan: 2026, status: 'CUTI', limit: 1, page: 2 });
      expect(page.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(page.data[0]?.id).toBe(second.id);
      expect(page.data[0]?.fakultas.id).toBe(faculty!.id); expect(page.data[0]?.kurikulum.id).toBe(curriculum!.id);
      expect((await students.list({ search: prefix + '_%' })).meta.total).toBe(1);
      await expect(students.create(body)).rejects.toThrow('NIM sudah digunakan');
      await expect(students.update(second.id, { nim: first.nim.toLowerCase() })).rejects.toThrow('NIM sudah digunakan');
      await expect(students.create({ ...body, nim: digits + '02' })).rejects.toThrow('MAHASISWA');
      const [laterStudentAccount] = await tx.insert(users).values({ loginId: digits + '11', email: prefix.toLowerCase() + '-later-student@kampusia.test', passwordHash: 'test-only-no-login', role: 'MAHASISWA' }).returning();
      await students.update(second.id, { nama: prefix + ' Linked Later' });
      expect((await tx.select({ userId: mahasiswa.userId }).from(mahasiswa).where(eq(mahasiswa.id, second.id)))[0]?.userId).toBe(laterStudentAccount!.id);
      expect((await students.kurikulumOptions({ program_studi_id: program!.id, search: prefix, limit: 1 })).meta.total).toBe(1);
      expect((await students.kurikulumOptions({ program_studi_id: program!.id, page: 2, limit: 1 })).data).toEqual([]);
      const lecturer = await lecturers.create({ nik: digits + '02', kode_dosen: prefix + 'A', nidn: ' ' + prefix.toLowerCase() + 'N ', nama: prefix + ' Dosen', program_studi_id: program!.id });
      const optional = await lecturers.create({ nik: digits + '12', kode_dosen: prefix + 'B', nama: prefix + ' Dosen' });
      const lecturerProvisioned = await lecturers.provisionAccount(optional.id);
      expect(lecturerProvisioned.account).toEqual({ loginId: digits + '12', role: 'DOSEN', isActive: true });
      expect(await Bun.password.verify(lecturerProvisioned.temporaryPassword!, (await tx.select().from(users).where(eq(users.loginId, digits + '12')))[0]!.passwordHash)).toBe(true);
      await expect(lecturers.create({ kode_dosen: lecturer.kodeDosen.toLowerCase(), nama: 'Duplicate' })).rejects.toThrow('Kode dosen sudah digunakan');
      await expect(lecturers.update(optional.id, { nidn: lecturer.nidn!.toLowerCase() })).rejects.toThrow('NIDN sudah digunakan');
      await students.update(first.id, { nim: digits + '21' });
      expect((await tx.select({ loginId: users.loginId }).from(users).where(eq(users.id, accounts[0]!.id)))[0]?.loginId).toBe(digits + '21');
      await expect(students.update(first.id, { nim: digits + '03' })).rejects.toThrow('Nomor Induk sudah digunakan');
      expect((await students.get(first.id)).nim).toBe(digits + '21');
      await lecturers.update(lecturer.id, { nik: digits + '22' });
      expect((await tx.select({ loginId: users.loginId }).from(users).where(eq(users.id, accounts[1]!.id)))[0]?.loginId).toBe(digits + '22');
      await expect(lecturers.update(lecturer.id, { nik: digits + '03' })).rejects.toThrow('Nomor Induk sudah digunakan');
      expect((await lecturers.get(lecturer.id)).nik).toBe(digits + '22');
      expect((await tx.select({ loginId: users.loginId }).from(users).where(eq(users.id, accounts[0]!.id)))[0]?.loginId).toBe(digits + '21');
      expect((await lecturers.get(optional.id)).programStudi).toBeNull();
      expect((await lecturers.list({ search: prefix, limit: 1, page: 2 })).meta.total).toBe(2);
      expect((await lecturers.list({ search: lecturer.nidn! })).data[0]?.id).toBe(lecturer.id);
      for (const is_active of [false, true]) {
        await lecturers.update(lecturer.id, { is_active });
        const list = await lecturers.list({ program_studi_id: program!.id, is_active: String(is_active) as 'true' | 'false' });
        expect(list.data[0]?.id).toBe(lecturer.id);
      }
      await tx.update(programStudi).set({ isActive: false }).where(eq(programStudi.id, program!.id));
      await tx.update(kurikulum).set({ isActive: false }).where(eq(kurikulum.id, curriculum!.id));
      await students.update(first.id, { nama: 'Riwayat', status: 'LULUS' });
      expect((await students.get(first.id)).status).toBe('LULUS');
      expect((await tx.select({ active: users.isActive }).from(users).where(eq(users.id, accounts[0]!.id)))[0]?.active).toBe(true);
      await lecturers.update(lecturer.id, { nama: 'Riwayat', is_active: false });
      await expect(students.create({ ...body, nim: digits + '99' })).rejects.toThrow('program studi aktif');
      await expect(lecturers.create({ kode_dosen: prefix + 'NEW', nama: 'New', program_studi_id: program!.id })).rejects.toThrow('program studi aktif');
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await createMahasiswaRepository(db).list({ search: prefix })).meta.total).toBe(0);
    expect((await createDosenRepository(db).list({ search: prefix })).meta.total).toBe(0);
  } finally { await client.end(); }
}, 20000);
