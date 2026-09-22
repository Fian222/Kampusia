import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_GRADING_E2E !== '1')('SvelteKit grading workflow differentiates oversight from lecturer actions', async () => {
  const origin = Bun.env.GRADING_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Grading E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD; if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => { const headers = new Headers(options.headers); headers.set('accept', 'text/html'); return fetch(origin + path, { redirect: 'manual', ...options, headers }); };
  expect((await request('/akademik/kelas-kuliah')).headers.get('location')).toBe('/login');
  const login = async (loginId: string) => {
    const response = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: loginId, password }) });
    expect(response.status).toBe(303);
    return response.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  };
  let cookie = await login('99000002');
  try {
    const classes = await request('/akademik/kelas-kuliah', { headers: { cookie } }); const listHtml = await classes.text(); const classId = /\/akademik\/kelas-kuliah\/([0-9a-f-]{36})/.exec(listHtml)?.[1]; expect(classId).toBeDefined();
    const basePath = '/akademik/kelas-kuliah/' + classId; const detail = await request(basePath + '?tab=grading', { headers: { cookie } }); expect(detail.status).toBe(200); const html = await detail.text();
    for (const label of ['Pengawasan Penilaian', 'Komponen nilai', 'Daftar nilai mahasiswa', 'Bobot aktif', 'Mode pengawasan']) expect(html).toContain(label);
    expect(html).not.toContain('Tambah komponen');
    expect(html).not.toContain('Finalisasi Nilai');
    const post = (body: Record<string, string>, requestOrigin = origin) => request(basePath + '?/grading', { method: 'POST', headers: { cookie, origin: requestOrigin }, body: new URLSearchParams(body) });
    expect((await post({ mode: 'component-create', nama: 'Ditolak', bobot: '100', urutan: '1' })).status).toBe(403);
    await request('/logout', { method: 'POST', headers: { cookie, origin } });

    cookie = await login('99000003');
    const lecturerClasses = await request('/dosen/kelas-kuliah', { headers: { cookie } });
    const lecturerClassId = /\/dosen\/kelas-kuliah\/([0-9a-f-]{36})/.exec(await lecturerClasses.text())?.[1]; expect(lecturerClassId).toBeDefined();
    const lecturerPath = '/dosen/kelas-kuliah/' + lecturerClassId; const lecturerDetail = await request(lecturerPath, { headers: { cookie } }); expect(lecturerDetail.status).toBe(200); const lecturerHtml = await lecturerDetail.text();
    for (const label of ['Ringkasan', 'Pertemuan / Absensi', 'Penilaian', 'Tambah komponen', 'Daftar nilai mahasiswa']) expect(lecturerHtml).toContain(label);
    const lecturerPost = (body: Record<string, string>, requestOrigin = origin) => request(lecturerPath + '?/grading', { method: 'POST', headers: { cookie, origin: requestOrigin }, body: new URLSearchParams(body) });
    const invalid = await lecturerPost({ mode: 'component-create', nama: 'Nilai Form Dipertahankan', bobot: '0', urutan: '1' }); expect(invalid.status).toBe(400); expect(await invalid.text()).toContain('Nilai Form Dipertahankan');
    const unconfirmed = await lecturerPost({ mode: 'finalize' }); expect(unconfirmed.status).toBe(400); expect(await unconfirmed.text()).toContain('Konfirmasikan finalisasi');
    expect((await lecturerPost({ mode: 'finalize', confirm: 'yes' }, 'https://evil.test')).status).toBe(403);
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
