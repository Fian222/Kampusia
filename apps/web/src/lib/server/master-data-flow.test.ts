import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_MASTER_E2E !== '1')('SvelteKit master pages render seeded data, edit forms and validation without changing records', async () => {
  const origin = 'http://localhost:5173';
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set('accept', 'text/html');
    return fetch(origin + path, { redirect: 'manual', ...options, headers });
  };
  for (const path of ['/akademik/fakultas', '/akademik/program-studi']) expect((await request(path)).headers.get('location')).toBe('/login');
  const signedIn = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: '99000002', password }) });
  expect(signedIn.status).toBe(303);
  const cookie = signedIn.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  try {
    for (const [path, kode] of [['/akademik/fakultas', 'DEV-FT'], ['/akademik/program-studi', 'DEV-IF']]) {
      const response = await request(path!, { headers: { cookie } });
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(kode!); expect(html).toContain('Fakultas Teknik');
      expect(html).toContain('Nonaktifkan'); expect(html).toContain('Simpan');
      const id = /edit=([0-9a-f-]{36})/.exec(html)?.[1];
      expect(id).toBeDefined();
      const edit = await request(path + '?edit=' + id, { headers: { cookie } });
      expect(edit.status).toBe(200); expect(await edit.text()).toContain('Batal edit');
      const empty = await request(path + '?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } });
      expect(empty.status).toBe(200); expect(await empty.text()).toContain('Tidak ada data yang cocok');
      const invalid = await request(path!, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', kode: ' ', nama: 'Invalid' }) });
      expect(invalid.status).toBe(400); expect(await invalid.text()).toContain('Kode dan nama wajib diisi.');
      const forged = await request(path!, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'status', id: id!, is_active: 'false' }) });
      expect(forged.status).toBe(403);
    }
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 30000);
