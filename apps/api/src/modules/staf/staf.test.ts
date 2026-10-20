import { expect, test } from 'bun:test';
import { createApp } from '../../app';
import { createAuthService } from '../auth/auth.service';
import { createSessionStore } from '../auth/auth.session';
import type { AuthRecord, Role } from '../auth/auth.model';
import type { StafRepository, StafTransaction } from './staf.repository';
import { createStafService } from './staf.service';

const origin = 'http://localhost:5173';
type Account = AuthRecord;

function setup(role: Role = 'ADMIN') {
  const stamp = () => ({ createdAt: new Date(), updatedAt: new Date() });
  const accounts: Account[] = [
    { id: crypto.randomUUID(), loginId: '90000001', email: 'admin@kampusia.test', passwordHash: 'hash-admin', role, isActive: true, mustChangePassword: false, ...stamp() },
    { id: crypto.randomUUID(), loginId: '90000002', email: null, passwordHash: 'hash-akademik', role: 'AKADEMIK', isActive: true, mustChangePassword: false, ...stamp() },
    { id: crypto.randomUUID(), loginId: '20260001', email: null, passwordHash: 'hash-student', role: 'MAHASISWA', isActive: true, mustChangePassword: false, ...stamp() },
  ];
  const actor = accounts[0]!;
  const safe = ({ id, passwordHash, ...account }: Account) => { void id; void passwordHash; return account; };
  const tx: StafTransaction = {
    lockActiveAdmins: async () => accounts.filter(row => row.role === 'ADMIN' && row.isActive).map(row => ({ id: row.id })),
    lockByLoginId: async loginId => { const row = accounts.find(item => item.loginId === loginId); return row && { id: row.id, ...safe(row) }; },
    create: async values => { const row: Account = { id: crypto.randomUUID(), ...values, isActive: true, mustChangePassword: true, ...stamp() }; accounts.push(row); return safe(row); },
    update: async (id, changes) => safe(Object.assign(accounts.find(row => row.id === id)!, changes)),
    resetPassword: async (id, passwordHash) => safe(Object.assign(accounts.find(row => row.id === id)!, { passwordHash, mustChangePassword: true })),
  };
  const repository: StafRepository = {
    list: async query => {
      const rows = accounts.filter(row => (query.role ? row.role === query.role : ['ADMIN', 'AKADEMIK'].includes(row.role))
        && (query.is_active === undefined || row.isActive === (query.is_active === 'true'))
        && (!query.search || row.loginId!.includes(query.search) || (row.email ?? '').includes(query.search)));
      return { data: rows.map(safe), meta: { page: 1, limit: 20, total: rows.length } };
    },
    transaction: async operation => operation(tx),
  };
  const sessions = createSessionStore();
  const token = sessions.create(actor.id, actor.passwordHash);
  const auth = createAuthService({ findByLoginId: async id => accounts.find(row => row.loginId === id), findById: async id => accounts.find(row => row.id === id) }, sessions);
  const service = createStafService(repository);
  const app = createApp(auth, { webOrigin: origin, production: false }, { staf: service });
  const request = (path: string, method = 'GET', body?: unknown, source = origin) => app.handle(new Request('http://localhost' + path, {
    method, headers: { origin: source, cookie: 'kampusia_session=' + token, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { accounts, actor, request, service };
}
const json = async (response: Response) => await response.json() as { success: boolean; message?: string; data?: Record<string, unknown> & { account?: Record<string, unknown>; temporaryPassword?: string }; meta?: { total: number } };

test('only an ADMIN can manage staff accounts, and mutations require the web origin', async () => {
  expect((await setup('AKADEMIK').request('/staf')).status).toBe(403);
  const ctx = setup();
  expect((await ctx.request('/staf', 'POST', { login_id: '90000003', role: 'AKADEMIK' }, 'https://evil.test')).status).toBe(403);
  const list = await json(await ctx.request('/staf'));
  expect(list.meta?.total).toBe(2);
  expect(JSON.stringify(list)).not.toContain('passwordHash');
  expect((await json(await ctx.request('/staf?role=AKADEMIK'))).meta?.total).toBe(1);
});

test('creating a staff account issues a one-time temporary password and rejects duplicates', async () => {
  const ctx = setup();
  const created = await ctx.request('/staf', 'POST', { login_id: ' 90000003 ', role: 'AKADEMIK', email: ' Staf@Kampusia.Test ' });
  expect(created.status).toBe(201);
  const body = await json(created);
  expect(body.data?.account).toMatchObject({ loginId: '90000003', email: 'staf@kampusia.test', role: 'AKADEMIK', isActive: true, mustChangePassword: true });
  expect(body.data?.account).not.toHaveProperty('id');
  expect(body.data?.temporaryPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  expect(ctx.accounts.at(-1)!.passwordHash).not.toBe(body.data?.temporaryPassword);
  expect((await json(await ctx.request('/staf', 'POST', { login_id: '20260001', role: 'AKADEMIK' }))).message).toBe('Nomor Induk sudah digunakan oleh akun lain.');
  expect((await ctx.request('/staf', 'POST', { login_id: '12A', role: 'AKADEMIK' })).status).toBe(400);
  expect((await json(await ctx.request('/staf', 'POST', { login_id: '90000004', role: 'AKADEMIK', email: 'bukan-email' }))).message).toBe('Format email tidak valid.');
  expect((await ctx.request('/staf', 'POST', { login_id: '90000005', role: 'DOSEN' })).status).toBe(400);
});

test('the last active ADMIN and the acting ADMIN cannot be demoted or deactivated', async () => {
  const ctx = setup();
  expect((await json(await ctx.request('/staf/90000001', 'PATCH', { is_active: false }))).message).toBe('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.');
  expect((await json(await ctx.request('/staf/90000001', 'PATCH', { role: 'AKADEMIK' }))).message).toBe('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.');
  expect((await ctx.request('/staf/90000002', 'PATCH', { role: 'ADMIN' })).status).toBe(200);
  expect((await ctx.request('/staf/90000002', 'PATCH', { is_active: false })).status).toBe(200);
  // Defense in depth: even if the actor's own ADMIN row changed concurrently, the last active ADMIN stays.
  ctx.accounts[1]!.isActive = true;
  ctx.accounts[0]!.isActive = false;
  await expect(ctx.service.update(ctx.actor, '90000002', { is_active: false })).rejects.toThrow('Minimal harus ada satu ADMIN aktif.');
  expect((await ctx.request('/staf/20260001', 'PATCH', { is_active: false })).status).toBe(401);
});

test('password reset issues a new temporary password for other staff only', async () => {
  const ctx = setup();
  expect((await json(await ctx.request('/staf/90000001/reset-password', 'POST'))).message).toBe('Gunakan menu Ganti kata sandi untuk akun Anda sendiri.');
  expect((await ctx.request('/staf/20260001/reset-password', 'POST')).status).toBe(404);
  const reset = await json(await ctx.request('/staf/90000002/reset-password', 'POST'));
  expect(reset.data?.account).toMatchObject({ loginId: '90000002', mustChangePassword: true });
  expect(reset.data?.temporaryPassword).toBeString();
  expect(ctx.accounts[1]!.passwordHash).not.toBe('hash-akademik');
  expect((await ctx.request('/staf/90000002', 'PATCH', {})).status).toBe(400);
});
