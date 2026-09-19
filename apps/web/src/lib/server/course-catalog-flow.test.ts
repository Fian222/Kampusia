import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_CATALOG_E2E !== '1')('SvelteKit catalog pages render lists, curriculum memberships and validation without changing academic records', async () => {
  const origin = Bun.env.CATALOG_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Catalog E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); headers.set('accept', 'text/html');
    return fetch(origin + path, { redirect: 'manual', ...options, headers });
  };
  const paths = ['/akademik/mata-kuliah', '/akademik/kurikulum'];
  for (const path of paths) expect((await request(path)).headers.get('location')).toBe('/login');
  const login = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: '99000002', password }) });
  expect(login.status).toBe(303);
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  try {
    let curriculumId = '';
    for (const path of paths) {
      const response = await request(path, { headers: { cookie } }); expect(response.status).toBe(200);
      const html = await response.text(); expect(html).toContain('DEV-'); expect(html).toContain('Simpan'); expect(html).not.toContain('passwordHash');
      expect(html).toContain(path.endsWith('kurikulum') ? 'Tahun Berlaku' : 'SKS');
      const id = /edit=([0-9a-f-]{36})/.exec(html)?.[1]; expect(id).toBeDefined();
      if (path.endsWith('kurikulum')) curriculumId = id!;
      const edit = await request(path + '?edit=' + id, { headers: { cookie } }); expect(edit.status).toBe(200); expect(await edit.text()).toContain('Batal edit');
      const empty = await request(path + '?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } }); expect(empty.status).toBe(200); expect(await empty.text()).toContain('Tidak ada data yang cocok');
      const invalid = await request(path, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', kode: ' ', nama: 'Preserved Name' }) });
      expect(invalid.status).toBe(400); const invalidHtml = await invalid.text(); expect(invalidHtml).toContain('Kode dan nama wajib diisi'); expect(invalidHtml).toContain('Preserved Name');
      const forged = await request(path, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'status', id: id!, is_active: 'false' }) }); expect(forged.status).toBe(403);
    }
    const detailPath = '/akademik/kurikulum/' + curriculumId;
    const detail = await request(detailPath, { headers: { cookie } }); expect(detail.status).toBe(200);
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('Basis Data'); expect(detailHtml).toContain('Semester Rekomendasi'); expect(detailHtml).toContain('Wajib/Pilihan'); expect(detailHtml).toContain('Tambah Mata Kuliah');
    const memberId = /name="membership_id" value="([0-9a-f-]{36})"/.exec(detailHtml)?.[1]; expect(memberId).toBeDefined();
    const invalidSemester = await request(detailPath, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'update', membership_id: memberId!, semester_rekomendasi: '0', is_wajib: 'true' }) });
    expect(invalidSemester.status).toBe(400); expect(await invalidSemester.text()).toContain('Semester rekomendasi harus kosong');
    const missingCourse = await request(detailPath, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'add', semester_rekomendasi: '3', is_wajib: 'true' }) });
    expect(missingCourse.status).toBe(400); expect(await missingCourse.text()).toContain('Pilih mata kuliah aktif');
    const forgedRemove = await request(detailPath, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'remove', membership_id: memberId! }) }); expect(forgedRemove.status).toBe(403);
    const emptyMembers = await request(detailPath + '?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } }); expect(emptyMembers.status).toBe(200); expect(await emptyMembers.text()).toContain('Tidak ada mata kuliah yang cocok');
    const invalidSks = await request(paths[0]!, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', kode: 'INVALID', nama: 'Invalid', sks: '1.5' }) }); expect(invalidSks.status).toBe(400); expect(await invalidSks.text()).toContain('SKS harus berupa bilangan bulat');
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
