import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_PROFILE_E2E !== '1')('SvelteKit profile pages render lists, filters, edit forms and validation without modifying records', async () => {
  const origin = Bun.env.PROFILE_WEB_ORIGIN ?? 'http://localhost:5173';
  const url = new URL(origin);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Profile E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); headers.set('accept', 'text/html');
    return fetch(origin + path, { redirect: 'manual', ...options, headers });
  };
  for (const path of ['/akademik/mahasiswa', '/akademik/dosen']) expect((await request(path)).headers.get('location')).toBe('/login');
  const login = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ email: 'akademik@kampusia.test', password }) });
  expect(login.status).toBe(303);
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  try {
    for (const [path, identifier] of [['/akademik/mahasiswa', 'DEV20260001'], ['/akademik/dosen', 'DEV-DOS-']] as const) {
      const response = await request(path, { headers: { cookie } });
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(identifier); expect(html).toContain('Program Studi'); expect(html).toContain('Simpan');
      expect(html).not.toContain('passwordHash');
      const id = /edit=([0-9a-f-]{36})/.exec(html)?.[1]; expect(id).toBeDefined();
      const edit = await request(path + '?edit=' + id, { headers: { cookie } });
      expect(edit.status).toBe(200); expect(await edit.text()).toContain('Batal edit');
      const empty = await request(path + '?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } });
      expect(empty.status).toBe(200); expect(await empty.text()).toContain('Data tidak ditemukan');
      const invalid = await request(path, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', nama: ' ' }) });
      expect(invalid.status).toBe(400); expect(await invalid.text()).toContain('Nama wajib diisi.');
      const forged = await request(path, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'save', id: id!, nama: 'Forbidden' }) });
      expect(forged.status).toBe(403);
    }
    const invalidYear = await request('/akademik/mahasiswa', { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', nama: 'Preserved Name', nim: 'Preserved NIM', angkatan: '1800', status: 'AKTIF' }) });
    expect(invalidYear.status).toBe(400); const invalidHtml = await invalidYear.text();
    expect(invalidHtml).toContain('Angkatan harus berupa tahun'); expect(invalidHtml).toContain('Preserved Name');
    const curricula = await request('/akademik/mahasiswa?curriculum_search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } });
    expect(curricula.status).toBe(200); expect(await curricula.text()).toContain('Kurikulum tidak ditemukan');
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
