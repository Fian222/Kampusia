import { expect, test } from 'bun:test';
import { createDatabase } from '@kampusia/db';
import { createAuthRepository } from './auth.repository';
import { createAuthService } from './auth.service';

const demoAccounts = [
  { id: '20260000-0000-4000-8000-000100000002', loginId: '99000001', email: 'admin@kampusia.test', role: 'ADMIN' },
  { id: '20260000-0000-4000-8000-000100000001', loginId: '99000002', email: 'akademik@kampusia.test', role: 'AKADEMIK' },
  { id: '20260000-0000-4000-8000-000100000003', loginId: '99000003', email: 'dosen@kampusia.test', role: 'DOSEN' },
  { id: '20260000-0000-4000-8000-000100000004', loginId: '99202601', email: 'mahasiswa@kampusia.test', role: 'MAHASISWA' },
] as const;

test.skipIf(Bun.env.RUN_AUTH_DB_TESTS !== '1')('all seeded roles authenticate through numeric Nomor Induk', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') {
    throw new Error('Auth integration tests require the local kampusia database.');
  }
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const { db, client } = createDatabase(url.toString());
  try {
    const auth = createAuthService(createAuthRepository(db));
    for (const account of demoAccounts) {
      const result = await auth.login(account.loginId, password);
      expect(result.user).toEqual({ id: account.id, loginId: account.loginId, email: account.email, role: account.role });
      auth.logout(result.token);
    }
    await expect(auth.login(demoAccounts[1].email, password)).rejects.toMatchObject({ status: 400 });
  } finally {
    await client.end();
  }
}, 30000);
