import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_OFFERING_E2E !== '1')('SvelteKit semester and class lists, editing, lecturers, validation and origin protection', async () => {
  const origin = Bun.env.OFFERING_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Offering E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); headers.set('accept', 'text/html');
    return fetch(origin + path, { redirect: 'manual', ...options, headers });
  };
  const paths = ['/akademik/semester', '/akademik/kelas-kuliah'];
  for (const path of paths) expect((await request(path)).headers.get('location')).toBe('/login');
  const login = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: '99000002', password }) });
  expect(login.status).toBe(303);
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  try {
    let classId = '';
    for (const path of paths) {
      const response = await request(path, { headers: { cookie } }); expect(response.status).toBe(200);
      const html = await response.text(); expect(html).toContain('Simpan'); expect(html).not.toContain('passwordHash');
      expect(html).toContain(path.endsWith('semester') ? 'Semester akademik aktif' : 'Basis Data');
      const id = /edit=([0-9a-f-]{36})/.exec(html)?.[1]; expect(id).toBeDefined();
      if (path.endsWith('kelas-kuliah')) classId = id!;
      const edit = await request(path + '?edit=' + id, { headers: { cookie } }); expect(edit.status).toBe(200); expect(await edit.text()).toContain('Batal edit');
      const empty = await request(path + '?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } }); expect(empty.status).toBe(200); expect(await empty.text()).toContain('Tidak ada');
      const invalid = await request(path, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'save', nama: 'Preserved Name', jenis: 'INVALID', status: 'INVALID' }) });
      expect(invalid.status).toBe(400); expect(await invalid.text()).toContain('Pilih');
      const forged = await request(path, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'save', id: id! }) }); expect(forged.status).toBe(403);
    }
    const detailPath = '/akademik/kelas-kuliah/' + classId;
    const detail = await request(detailPath, { headers: { cookie } }); expect(detail.status).toBe(200);
    const html = await detail.text(); expect(html).toContain('Koordinator'); expect(html).toContain('Dosen Pengajar'); expect(html).toContain('Jadwal');
    const id = /name="assignment_id" value="([0-9a-f-]{36})"/.exec(html)?.[1]; expect(id).toBeDefined();
    const detailAction = detailPath + '?/detail';
    const removal = await request(detailAction, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'remove', assignment_id: id! }) }); expect(removal.status).toBe(400); expect(await removal.text()).toContain('Konfirmasikan');
    const invalid = await request(detailAction, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams({ mode: 'add', is_koordinator: 'invalid' }) }); expect(invalid.status).toBe(400);
    const forged = await request(detailAction, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'remove', assignment_id: id!, confirm: 'yes' }) }); expect(forged.status).toBe(403);
    for (const selector of ['semester', 'program', 'course']) {
      const result = await request(paths[1] + `?${selector}_search=NO-MATCH-${crypto.randomUUID()}`, { headers: { cookie } }); expect(result.status).toBe(200);
    }
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
