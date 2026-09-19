import { beforeAll, expect, test } from 'bun:test';
import type { mahasiswa } from '@kampusia/db/schema';
import { createApp } from '../../app';
import { createAuthService } from './auth.service';
import { createSessionStore } from './auth.session';
import { sessionSeconds, type AuthRecord, type Role } from './auth.model';

let passwordHash: string;
beforeAll(async () => { passwordHash = await Bun.password.hash('TestPassword2026!', { algorithm: 'argon2id' }); });

function setup(role: Role = 'AKADEMIK', production = false, loginId = '00123456') {
  const record: AuthRecord = { id: '00000000-0000-4000-8000-000000000001', loginId, email: 'test@kampusia.test',
    role, passwordHash, isActive: true, mustChangePassword: false, createdAt: new Date(), updatedAt: new Date() };
  let now = Date.now();
  const service = createAuthService({
    findByLoginId: async value => value === record.loginId ? record : undefined,
    findById: async id => id === record.id ? record : undefined,
    updatePassword: async (id, nextHash) => {
      if (id !== record.id) return undefined;
      Object.assign(record, { passwordHash: nextHash, mustChangePassword: false, updatedAt: new Date() });
      return record;
    },
  }, createSessionStore(() => now));
  const origin = production ? 'https://kampusia.test' : 'http://localhost:5173';
  const app = createApp(service, { webOrigin: origin, production });
  const request = (path: string, method = 'GET', cookie?: string, body?: unknown, source = origin) => app.handle(new Request('http://localhost' + path, {
    method, headers: { origin: source, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
  const login = () => request('/auth/login', 'POST', undefined, { login_id: loginId, password: 'TestPassword2026!' });
  return { record, request, login, advance: () => { now += sessionSeconds * 1000 + 1; } };
}
const cookieOf = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]!;

test('valid leading-zero Nomor Induk login returns safe user and sets an HTTP-only cookie', async () => {
  const ctx = setup();
  const response = await ctx.login();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { id: ctx.record.id, loginId: '00123456', email: ctx.record.email, role: 'AKADEMIK', mustChangePassword: false } });
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
  expect(response.headers.get('set-cookie')).not.toContain('Secure');
  expect(response.headers.get('cache-control')).toBe('no-store');
});

test('unknown, null, incorrect-password, and inactive accounts return the same error', async () => {
  const ctx = setup();
  const wrong = await ctx.request('/auth/login', 'POST', undefined, { login_id: ctx.record.loginId, password: 'wrong' });
  const unknown = await ctx.request('/auth/login', 'POST', undefined, { login_id: '99999999', password: 'wrong' });
  ctx.record.isActive = false;
  const inactive = await ctx.login();
  ctx.record.isActive = true;
  ctx.record.loginId = null;
  const unmapped = await ctx.login();
  for (const response of [wrong, unknown, inactive, unmapped]) {
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, message: 'Nomor Induk atau kata sandi salah.' });
    expect(response.headers.get('set-cookie')).toBeNull();
  }
});

test('current-user endpoint and protected endpoint reject missing or forged sessions', async () => {
  const ctx = setup();
  for (const path of ['/auth/me', '/dashboard/akademik']) {
    expect((await ctx.request(path)).status).toBe(401);
    expect((await ctx.request(path, 'GET', 'kampusia_session=' + 'a'.repeat(64))).status).toBe(401);
  }
});

test('current-user endpoint returns only authenticated public fields', async () => {
  const ctx = setup();
  const cookie = cookieOf(await ctx.login());
  const response = await ctx.request('/auth/me', 'GET', cookie);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { id: ctx.record.id, loginId: ctx.record.loginId, email: ctx.record.email, role: 'AKADEMIK', mustChangePassword: false } });
});

for (const status of ['AKTIF', 'CUTI', 'NONAKTIF', 'LULUS', 'KELUAR'] as const) {
  test('student academic status ' + status + ' does not control login or session access', async () => {
    const ctx = setup('MAHASISWA');
    const profile: Pick<typeof mahasiswa.$inferSelect, 'userId' | 'status'> = {
      userId: ctx.record.id, status: 'AKTIF',
    };
    // The real repository selects only users. Supply a linked profile in this
    // test double too, so auth must ignore academic state even when available.
    Object.assign(ctx.record, { mahasiswa: profile });
    const initial = await ctx.login();
    expect(initial.status).toBe(200);
    const existingCookie = cookieOf(initial);

    profile.status = status;
    const current = await ctx.request('/auth/me', 'GET', existingCookie);
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({
      success: true, data: { id: ctx.record.id, loginId: ctx.record.loginId, email: ctx.record.email, role: 'MAHASISWA', mustChangePassword: false },
    });
    expect((await ctx.request('/dashboard/mahasiswa', 'GET', existingCookie)).status).toBe(200);

    const login = await ctx.login();
    expect(login.status).toBe(200);
    const newCookie = cookieOf(login);
    expect((await ctx.request('/auth/me', 'GET', newCookie)).status).toBe(200);
    expect((await ctx.request('/dashboard/mahasiswa', 'GET', newCookie)).status).toBe(200);
    expect((await ctx.request('/dashboard/akademik', 'GET', newCookie)).status).toBe(403);

    // Account deactivation must still deny authentication for every academic
    // status, including an academically AKTIF student.
    ctx.record.isActive = false;
    const denied = await ctx.login();
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ success: false, message: 'Nomor Induk atau kata sandi salah.' });
    expect(denied.headers.get('set-cookie')).toBeNull();
    expect((await ctx.request('/auth/me', 'GET', existingCookie)).status).toBe(401);
    expect((await ctx.request('/dashboard/mahasiswa', 'GET', newCookie)).status).toBe(401);
  });
}

test('logout expires cookie and revokes the old token; repeated logout is safe', async () => {
  const ctx = setup();
  const cookie = cookieOf(await ctx.login());
  const response = await ctx.request('/auth/logout', 'POST', cookie);
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  expect((await ctx.request('/auth/me', 'GET', cookie)).status).toBe(401);
  expect((await ctx.request('/auth/logout', 'POST', cookie)).status).toBe(200);
});

for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) {
  test(role + ' can access only its authorized dashboard', async () => {
    const ctx = setup(role);
    const cookie = cookieOf(await ctx.login());
    for (const area of ['admin', 'akademik', 'dosen', 'mahasiswa']) {
      expect((await ctx.request('/dashboard/' + area, 'GET', cookie)).status).toBe(area === role.toLowerCase() ? 200 : 403);
    }
  });
}

test('sessions expire and account deactivation and role changes take effect immediately', async () => {
  const ctx = setup();
  let cookie = cookieOf(await ctx.login());
  ctx.record.role = 'DOSEN';
  expect((await ctx.request('/dashboard/akademik', 'GET', cookie)).status).toBe(403);
  expect((await ctx.request('/dashboard/dosen', 'GET', cookie)).status).toBe(200);
  ctx.record.isActive = false;
  expect((await ctx.request('/auth/me', 'GET', cookie)).status).toBe(401);
  ctx.record.isActive = true;
  cookie = cookieOf(await ctx.login());
  ctx.advance();
  expect((await ctx.request('/auth/me', 'GET', cookie)).status).toBe(401);
});

test('login rotates a previous session and rejects cross-origin mutations', async () => {
  const ctx = setup();
  const first = cookieOf(await ctx.login());
  const next = await ctx.request('/auth/login', 'POST', first, { login_id: ctx.record.loginId, password: 'TestPassword2026!' });
  expect(next.status).toBe(200);
  expect(cookieOf(next)).not.toBe(first);
  expect((await ctx.request('/auth/me', 'GET', first)).status).toBe(401);
  expect((await ctx.request('/auth/logout', 'POST', cookieOf(next), undefined, 'https://evil.test')).status).toBe(403);
  expect((await ctx.request('/auth/login', 'POST', undefined, { login_id: ctx.record.loginId, password: 'TestPassword2026!' }, 'https://evil.test')).status).toBe(403);
});

test('production cookies are Secure and malformed input has safe validation errors', async () => {
  const ctx = setup('AKADEMIK', true);
  expect((await ctx.login()).headers.get('set-cookie')).toContain('Secure');
  expect((await ctx.request('/auth/login', 'POST', undefined, { login_id: '12A', password: 'x' })).status).toBe(400);
  expect((await ctx.request('/auth/login', 'POST', undefined, { email: ctx.record.email, password: 'TestPassword2026!' })).status).toBe(400);
  const response = await ctx.request('/auth/login', 'POST', undefined, { login_id: ctx.record.loginId });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ success: false, message: 'Periksa format dan kelengkapan data yang dikirim.' });
});

test('temporary-password account is restricted until password change rotates its session', async () => {
  const ctx = setup('MAHASISWA');
  ctx.record.mustChangePassword = true;
  const login = await ctx.login();
  const oldCookie = cookieOf(login);
  expect(((await login.clone().json()) as { data: { mustChangePassword: boolean } }).data.mustChangePassword).toBe(true);
  expect((await ctx.request('/auth/me', 'GET', oldCookie)).status).toBe(200);
  expect((await ctx.request('/dashboard/mahasiswa', 'GET', oldCookie)).status).toBe(403);
  const changed = await ctx.request('/auth/change-password', 'POST', oldCookie, { new_password: 'A-New-Password-2026!', confirmation: 'A-New-Password-2026!' });
  expect(changed.status).toBe(200);
  const newCookie = cookieOf(changed);
  expect(newCookie).not.toBe(oldCookie);
  expect(ctx.record.mustChangePassword).toBe(false);
  expect((await ctx.request('/auth/me', 'GET', oldCookie)).status).toBe(401);
  expect((await ctx.login()).status).toBe(401);
  expect((await ctx.request('/auth/login', 'POST', undefined, { login_id: ctx.record.loginId, password: 'A-New-Password-2026!' })).status).toBe(200);
  expect((await ctx.request('/dashboard/mahasiswa', 'GET', newCookie)).status).toBe(200);
});
