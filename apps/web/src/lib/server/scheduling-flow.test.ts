import { expect, test } from 'bun:test';

test.skipIf(Bun.env.RUN_SCHEDULING_E2E !== '1')('SvelteKit room and schedule forms render and preserve validation feedback', async () => {
  const origin = Bun.env.SCHEDULING_WEB_ORIGIN ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Scheduling E2E requires a local web server.');
  const password = Bun.env.SEED_PASSWORD;
  if (!password) throw new Error('SEED_PASSWORD is required.');
  const request = (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers); headers.set('accept', 'text/html');
    return fetch(origin + path, { redirect: 'manual', ...options, headers });
  };
  expect((await request('/akademik/ruangan')).headers.get('location')).toBe('/login');
  const login = await request('/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ login_id: '99000002', password }) });
  expect(login.status).toBe(303);
  const cookie = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!;
  const post = (path: string, body: Record<string, string>) => request(path, { method: 'POST', headers: { cookie, origin }, body: new URLSearchParams(body) });
  try {
    const rooms = await request('/akademik/ruangan', { headers: { cookie } }); expect(rooms.status).toBe(200);
    const roomHtml = await rooms.text(); expect(roomHtml).toContain('DEV-R101'); expect(roomHtml).toContain('Gedung');
    const roomId = /edit=([0-9a-f-]{36})/.exec(roomHtml)?.[1]; expect(roomId).toBeDefined();
    const roomEdit = await request('/akademik/ruangan?edit=' + roomId, { headers: { cookie } }); expect(roomEdit.status).toBe(200); expect(await roomEdit.text()).toContain('Batal edit');
    const invalidRoom = await post('/akademik/ruangan', { mode: 'save', kode: 'FORM-TEST', nama: 'Preserved room', kapasitas: '0' }); expect(invalidRoom.status).toBe(400); expect(await invalidRoom.text()).toContain('Preserved room');
    const unconfirmed = await post('/akademik/ruangan', { mode: 'status', id: roomId!, is_active: 'false' }); expect(unconfirmed.status).toBe(400); expect(await unconfirmed.text()).toContain('Konfirmasikan');
    const empty = await request('/akademik/ruangan?search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } }); expect(await empty.text()).toContain('Tidak ada ruangan');
    const classes = await request('/akademik/kelas-kuliah', { headers: { cookie } }); const classHtml = await classes.text();
    const classId = /edit=([0-9a-f-]{36})/.exec(classHtml)?.[1]; expect(classId).toBeDefined();
    const path = '/akademik/kelas-kuliah/' + classId;
    const detail = await request(path, { headers: { cookie } }); expect(detail.status).toBe(200);
    const html = await detail.text();
    for (const label of ['Jadwal Kuliah', 'Jam Mulai', 'Jam Selesai', 'Ruangan', 'Gedung', 'Atur Jadwal', 'Edit Jadwal', 'Simpan status']) expect(html).toContain(label);
    expect(html).not.toContain('menunggu validasi');
    const scheduleId = /name="jadwal_id" value="([0-9a-f-]{36})"/.exec(html)?.[1]; expect(scheduleId).toBeDefined();
    const detailAction = path + '?/detail';
    const invalid = await post(detailAction, { mode: 'schedule-save', ruangan_id: roomId!, hari: '1', jam_mulai: '12:00', jam_selesai: '08:00' }); expect(invalid.status).toBe(400);
    const invalidHtml = await invalid.text(); expect(invalidHtml).toContain('Jam mulai harus lebih awal'); expect(invalidHtml).toContain('value="12:00"');
    const removal = await post(detailAction, { mode: 'schedule-remove', jadwal_id: scheduleId! }); expect(removal.status).toBe(400); expect(await removal.text()).toContain('Konfirmasikan');
    const status = await post(detailAction, { mode: 'status', status: 'DIBUKA' }); expect(status.status).toBe(400); expect(await status.text()).toContain('Konfirmasikan');
    const selector = await request(path + '?room_search=NO-MATCH-' + crypto.randomUUID(), { headers: { cookie } }); expect(selector.status).toBe(200); expect(await selector.text()).toContain('Edit Jadwal');
    for (const target of ['/akademik/ruangan', detailAction]) expect((await request(target, { method: 'POST', headers: { cookie, origin: 'https://evil.test' }, body: new URLSearchParams({ mode: 'save' }) })).status).toBe(403);
  } finally { await request('/logout', { method: 'POST', headers: { cookie, origin } }); }
}, 60000);
