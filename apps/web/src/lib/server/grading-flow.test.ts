import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_GRADING_E2E !== '1')('SvelteKit grading grid renders and preserves validation and confirmation feedback', async () => {
  const origin = Bun.env.GRADING_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Grading E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD; if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => { const headers = new Headers(options.headers); headers.set('accept', 'text/html'); return fetch(origin + path, { redirect: 'manual', ...options, headers }); };
  expect((await request('/akademik/kelas-kuliah')).headers.get('location')).toBe('/login');
  const login = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: '99000002', password }) }); expect(login.status).toBe(303);
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  try {
    const classes = await request('/akademik/kelas-kuliah', { headers: { cookie } }); const listHtml = await classes.text(); const classId = /edit=([0-9a-f-]{36})/.exec(listHtml)?.[1]; expect(classId).toBeDefined();
    const path = '/akademik/kelas-kuliah/' + classId; const detail = await request(path, { headers: { cookie } }); expect(detail.status).toBe(200); const html = await detail.text();
    for (const label of ['Penilaian', 'Komponen nilai', 'Daftar nilai mahasiswa', 'Belum dinilai', 'Bobot aktif', 'Finalisasi nilai kelas']) expect(html).toContain(label);
    const post = (body: Record<string, string>, requestOrigin = origin) => request(path + '?/grading', { method: 'POST', headers: { cookie, origin: requestOrigin }, body: new URLSearchParams(body) });
    const invalid = await post({ mode: 'component-create', nama: 'Nilai Form Dipertahankan', bobot: '0', urutan: '1' }); expect(invalid.status).toBe(400); expect(await invalid.text()).toContain('Nilai Form Dipertahankan');
    const unconfirmed = await post({ mode: 'finalize' }); expect(unconfirmed.status).toBe(400); expect(await unconfirmed.text()).toContain('Konfirmasikan finalisasi');
    expect((await post({ mode: 'finalize', confirm: 'yes' }, 'https://evil.test')).status).toBe(403);
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
