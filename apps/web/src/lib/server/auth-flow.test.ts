import { expect, test } from 'bun:test';

test.skipIf(process.env.RUN_AUTH_E2E !== '1')('seeded user can sign in through SvelteKit, access only its area, and sign out', async () => {
  const origin = 'http://localhost:5173';
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required for the opt-in auth smoke test.');
  const request = (path: string, options: RequestInit = {}) => fetch(origin + path, { redirect: 'manual', ...options });
  expect((await request('/')).headers.get('location')).toBe('/login');
  expect((await request('/akademik')).headers.get('location')).toBe('/login');
  expect((await request('/login')).status).toBe(200);
  const signedIn = await request('/login', {
    method: 'POST', headers: { origin, accept: 'text/html' },
    body: new URLSearchParams({ email: 'akademik@kampusia.test', password }),
  });
  expect(signedIn.status).toBe(303);
  expect(signedIn.headers.get('location')).toBe('/akademik');
  const session = signedIn.headers.getSetCookie().find(value => value.startsWith('kampusia_session='));
  expect(session).toContain('HttpOnly');
  const cookie = session!.split(';')[0]!;
  const dashboard = await request('/akademik', { headers: { cookie } });
  expect(dashboard.status).toBe(200);
  const html = await dashboard.text();
  expect(html).toContain('Selamat datang di Kampusia');
  expect(html).toContain('akademik@kampusia.test');
  expect(html).not.toContain(cookie.slice(cookie.indexOf('=') + 1));
  expect((await request('/admin', { headers: { cookie } })).status).toBe(403);
  expect((await request('/login', { headers: { cookie } })).headers.get('location')).toBe('/akademik');
  expect((await request('/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.test' } })).status).toBe(403);
  const signedOut = await request('/logout', { method: 'POST', headers: { cookie, origin } });
  expect(signedOut.status).toBe(303);
  expect(signedOut.headers.get('location')).toBe('/login');
  expect((await request('/akademik', { headers: { cookie } })).headers.get('location')).toBe('/login');
}, 30000);
