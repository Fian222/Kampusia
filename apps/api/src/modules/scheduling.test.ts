import { expect, test } from 'bun:test';
import type { jadwalKuliah, kelasKuliah, semester, ruangan } from '@kampusia/db/schema';
import { createApp } from '../app';
import { createAuthService } from './auth/auth.service';
import { createSessionStore } from './auth/auth.session';
import type { AuthRecord, Role } from './auth/auth.model';
import { createJadwalService, hasWeekday, validateClassSchedules } from './jadwal/jadwal.service';
import type { JadwalRepository, SchedulingRepository } from './jadwal/jadwal.repository';
import { createRuanganService } from './ruangan/ruangan.service';
import type { RuanganRepository } from './ruangan/ruangan.repository';
import { pagination } from '../utils/master-data';
type Slot = typeof jadwalKuliah.$inferSelect;
type Class = typeof kelasKuliah.$inferSelect;
type Term = typeof semester.$inferSelect;
type Room = typeof ruangan.$inferSelect;
const stamps = () => ({ id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() });
const missing = crypto.randomUUID();
const origin = 'http://localhost:5173';
function setup(role: Role = 'AKADEMIK') {
  const terms: Term[] = [{ ...stamps(), kode: '20261', nama: 'Term', tahunMulai: 2026, jenis: 'GANJIL', tanggalMulai: '2026-08-24', tanggalSelesai: '2027-01-15', krsMulaiAt: null, krsSelesaiAt: null, isActive: true }];
  const classes: Class[] = ['A', 'B'].map(namaKelas => ({ ...stamps(), namaKelas, kapasitas: 30, status: 'DRAFT', semesterId: terms[0]!.id, mataKuliahId: missing, programStudiId: missing }));
  const rooms: Room[] = ['R1', 'R2'].map(kode => ({ ...stamps(), kode, nama: kode, gedung: null, kapasitas: 40, isActive: true }));
  const slots: Slot[] = []; const assignments: { kelasKuliahId: string; dosenId: string }[] = [];
  const peers = new Set<string>(); const history = new Set<string>();
  const tx: SchedulingRepository = {
    lockClass: async id => classes.find(row => row.id === id), term: async id => terms.find(row => row.id === id), room: async id => rooms.find(row => row.id === id),
    slots: async id => slots.filter(row => row.kelasKuliahId === id), lecturers: async ids => assignments.filter(row => ids.includes(row.kelasKuliahId)),
    approvedPeerClasses: async () => [...peers].map(id => ({ id })), hasApprovalHistory: async id => history.has(id),
    candidates: async (slot, dates, classId) => slots.flatMap(row => {
      const kelas = classes.find(item => item.id === row.kelasKuliahId)!; const term = terms.find(item => item.id === kelas.semesterId)!;
      return (kelas.status !== 'DIBATALKAN' || kelas.id === classId) && row.hari === slot.hari && row.jamMulai < slot.jamSelesai && slot.jamMulai < row.jamSelesai && term.tanggalMulai <= dates.tanggalSelesai && dates.tanggalMulai <= term.tanggalSelesai ? [{ ...row, tanggalMulai: term.tanggalMulai, tanggalSelesai: term.tanggalSelesai }] : [];
    }),
    create: async input => { const row = { ...stamps(), ...input }; slots.push(row); return row; },
    update: async (id, input) => Object.assign(slots.find(row => row.id === id)!, input, { updatedAt: new Date() }),
    remove: async id => { slots.splice(slots.findIndex(row => row.id === id), 1); },
  };
  function slice<T>(rows: T[], query: { page?: number; limit?: number }) { const { page, limit } = pagination(query); return { data: rows.slice((page - 1) * limit, page * limit), meta: { page, limit, total: rows.length } }; }
  const repository: JadwalRepository = {
    findClass: tx.lockClass, transaction: async operation => operation(tx),
    list: async (id, query) => slice(slots.filter(row => row.kelasKuliahId === id).map(row => ({ ...row, ruangan: rooms.find(room => room.id === row.ruanganId)! })), query),
  };
  const roomRepository: RuanganRepository = {
    findById: tx.room,
    list: async query => slice(rooms.filter(row => (query.is_active === undefined || row.isActive === (query.is_active === 'true')) && (!query.search || (row.kode + row.nama).toLowerCase().includes(query.search.toLowerCase()))), query),
    transaction: async operation => operation({
      findById: tx.room,
      schedules: async id => slots.filter(row => row.ruanganId === id).map(row => { const kelas = classes.find(item => item.id === row.kelasKuliahId)!; const term = terms.find(item => item.id === kelas.semesterId)!; return { ...row, kapasitas: kelas.kapasitas, status: kelas.status, tanggalMulai: term.tanggalMulai, tanggalSelesai: term.tanggalSelesai }; }),
      create: async input => {
        if (rooms.some(row => row.kode === input.kode)) throw { code: '23505', constraint_name: 'ruangan_kode_unique' };
        const row = { ...stamps(), ...input, isActive: input.isActive ?? true, gedung: input.gedung ?? null }; rooms.push(row); return row;
      },
      update: async (id, input) => {
        if (input.kode && rooms.some(row => row.id !== id && row.kode === input.kode)) throw { code: '23505', constraint_name: 'ruangan_kode_unique' };
        return Object.assign(rooms.find(row => row.id === id)!, input);
      },
    }),
  };
  const services = { jadwal: createJadwalService(repository), ruangan: createRuanganService(roomRepository, () => new Date('2026-09-12T05:00:00Z')) };
  const user: AuthRecord = { ...stamps(), email: 'test@kampusia.test', passwordHash: 'test', role, isActive: true };
  const sessions = createSessionStore(); const token = sessions.create(user.id, user.passwordHash);
  const app = createApp(createAuthService({ findById: async () => user, findByEmail: async () => user }, sessions), { webOrigin: origin, production: false }, services);
  const request = (path: string, method = 'GET', body?: unknown, cookie = token, source = origin) => app.handle(new Request('http://localhost' + path, { method, headers: { origin: source, cookie: 'kampusia_session=' + cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const body = { ruangan_id: rooms[0]!.id, hari: 1, jam_mulai: '08:00', jam_selesai: '10:00' };
  const path = `/kelas-kuliah/${classes[0]!.id}/jadwal`;
  return { terms, classes, rooms, slots, assignments, peers, history, services, request, body, path, user, repository, tx };
}

test('Jadwal list/create/update/remove and parent-scoped IDs', async () => {
  const c = setup(); const response = await c.request(c.path, 'POST', c.body); expect(response.status).toBe(201);
  const row = c.slots[0]!;
  expect((await c.request(c.path + '?limit=1')).status).toBe(200);
  expect((await c.request(c.path + '/' + row.id, 'PATCH', { jam_mulai: '09:00' })).status).toBe(200);
  expect(row.jamMulai).toBe('09:00:00');
  const other = `/kelas-kuliah/${c.classes[1]!.id}/jadwal/${row.id}`;
  expect((await c.request(other, 'PATCH', { hari: 2 })).status).toBe(404);
  expect((await c.request(other, 'DELETE')).status).toBe(404);
  expect((await c.request(c.path + '/' + row.id, 'DELETE')).status).toBe(200); expect(c.slots).toHaveLength(0);
});
test('Jadwal rejects invalid class, room, inactive room, weekday, times, capacity and empty patch', async () => {
  const c = setup();
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) expect((await c.request(`/kelas-kuliah/${missing}/jadwal${['PATCH', 'DELETE'].includes(method) ? '/' + missing : ''}`, method, ['POST', 'PATCH'].includes(method) ? c.body : undefined)).status).toBe(404);
  for (const change of [{ ruangan_id: missing }, { hari: 0 }, { hari: 8 }, { hari: 1.5 }, { jam_mulai: '10:00' }, { jam_mulai: '23:00', jam_selesai: '01:00' }, { jam_mulai: '24:00' }, { jam_mulai: '08:70' }, { jam_mulai: '8:00' }, { jam_mulai: '08:00:00.0', jam_selesai: '08:00:00' }]) expect((await c.request(c.path, 'POST', { ...c.body, ...change })).status).toBe(400);
  c.rooms[0]!.isActive = false; expect((await c.request(c.path, 'POST', c.body)).status).toBe(400); c.rooms[0]!.isActive = true;
  c.rooms[0]!.kapasitas = 29; expect((await c.request(c.path, 'POST', c.body)).status).toBe(400); c.rooms[0]!.kapasitas = 30;
  await c.services.jadwal.add(c.classes[0]!.id, c.body);
  expect((await c.request(c.path + '/' + c.slots[0]!.id, 'PATCH', {})).status).toBe(400);
});
for (const resource of ['room', 'class', 'lecturer', 'student'] as const) test('Jadwal detects ' + resource + ' conflicts and allows adjacency', async () => {
  const c = setup(); await c.services.jadwal.add(c.classes[0]!.id, c.body);
  const target = resource === 'class' ? c.classes[0]! : c.classes[1]!;
  if (resource === 'lecturer') c.assignments.push(...c.classes.map(row => ({ kelasKuliahId: row.id, dosenId: missing })));
  if (resource === 'student') c.peers.add(c.classes[0]!.id);
  const body = { ...c.body, ruangan_id: resource === 'room' ? c.rooms[0]!.id : c.rooms[1]!.id, jam_mulai: '09:30', jam_selesai: '11:00' };
  const response = await c.request(`/kelas-kuliah/${target.id}/jadwal`, 'POST', body); expect(response.status).toBe(409);
  const text = await response.text(); expect(text).toContain({ room: 'ruangan', class: 'kelas yang sama', lecturer: 'dosen', student: 'KRS mahasiswa' }[resource]);
  expect((await c.request(`/kelas-kuliah/${target.id}/jadwal`, 'POST', { ...body, jam_mulai: '10:00', jam_selesai: '12:00' })).status).toBe(201);
});
test('Weekday occurrence handles inclusive boundaries, Sunday and intersecting dates without shared weekday', () => {
  expect(hasWeekday('2026-09-14', '2026-09-14', 1)).toBe(true);
  expect(hasWeekday('2026-09-13', '2026-09-13', 7)).toBe(true);
  expect(hasWeekday('2026-09-15', '2026-09-20', 1)).toBe(false);
  expect(hasWeekday('2026-09-15', '2026-09-21', 1)).toBe(true);
});
test('Schedules across semesters use shared occurrences, not semester identity or mere date intersection', async () => {
  const c = setup(); const term = c.terms[0]!; term.tanggalMulai = '2026-09-14'; term.tanggalSelesai = '2026-09-20';
  await c.services.jadwal.add(c.classes[0]!.id, c.body);
  const second = { ...term, id: crypto.randomUUID(), tanggalMulai: '2026-09-15', tanggalSelesai: '2026-09-21' }; c.terms.push(second); c.classes[1]!.semesterId = second.id;
  const slot = await c.services.jadwal.add(c.classes[1]!.id, c.body); // Intersection Tue–Sun has no Monday.
  second.tanggalMulai = '2026-09-14';
  await expect(c.services.jadwal.update(c.classes[1]!.id, slot.id, { hari: 1 })).rejects.toThrow('ruangan');
  second.tanggalMulai = '2027-09-01'; second.tanggalSelesai = '2027-12-01';
  await c.services.jadwal.update(c.classes[1]!.id, slot.id, { hari: 1 });
  second.tanggalMulai = '2026-09-15'; second.tanggalSelesai = '2026-09-20';
  await expect(c.services.jadwal.update(c.classes[1]!.id, slot.id, { hari: 1 })).rejects.toThrow('pertemuan');
});
for (const status of ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'] as const) test('Schedule reservations for class status ' + status, async () => {
  const c = setup(); c.classes[0]!.status = status; await c.services.jadwal.add(c.classes[0]!.id, c.body);
  expect((await c.request(`/kelas-kuliah/${c.classes[1]!.id}/jadwal`, 'POST', c.body)).status).toBe(status === 'DIBATALKAN' ? 201 : 409);
});
test('Schedule deletion protects opened classes and retained approval history', async () => {
  const c = setup(); const id = c.classes[0]!.id; const slot = await c.services.jadwal.add(id, c.body); c.classes[0]!.status = 'DIBUKA';
  await expect(c.services.jadwal.remove(id, slot.id)).rejects.toThrow('setidaknya satu');
  c.classes[0]!.status = 'DITUTUP'; c.history.add(id);
  await expect(c.services.jadwal.remove(id, slot.id)).rejects.toThrow('riwayat KRS');
});
test('Ruangan API list/search/pagination, create, duplicate, detail, update, deactivate/reactivate', async () => {
  const c = setup(); expect((await c.request('/ruangan', 'POST', { kode: ' r3 ', nama: 'Room', gedung: ' A ', kapasitas: 50 })).status).toBe(201);
  const room = c.rooms[2]!; expect(room.kode).toBe('R3'); expect(room.gedung).toBe('A');
  expect((await c.request('/ruangan', 'POST', { kode: 'r3', nama: 'Room', kapasitas: 40 })).status).toBe(409);
  expect((await c.request('/ruangan/' + room.id)).status).toBe(200);
  expect((await c.request('/ruangan/' + room.id, 'PATCH', { gedung: null, nama: 'Updated', kapasitas: 60 })).status).toBe(200);
  for (const is_active of [false, true]) expect((await c.request('/ruangan/' + room.id, 'PATCH', { is_active })).status).toBe(200);
  const response = await c.request('/ruangan?search=updated&is_active=true&limit=1'); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ meta: { total: 1, limit: 1, page: 1 }, data: [{ kode: 'R3' }] });
  expect((await c.request('/ruangan/' + room.id, 'DELETE')).status).toBe(404);
});
test('Ruangan invalid capacity and unsafe changes rejected; historical/cancelled schedules retain rooms', async () => {
  const c = setup();
  for (const kapasitas of [0, -1, 1.5, 2147483648]) expect((await c.request('/ruangan', 'POST', { kode: 'X', nama: 'X', kapasitas })).status).toBe(400);
  const room = c.rooms[0]!; await c.services.jadwal.add(c.classes[0]!.id, c.body);
  await expect(c.services.ruangan.update(room.id, { kapasitas: 29 })).rejects.toThrow('kapasitas kelas');
  await expect(c.services.ruangan.update(room.id, { is_active: false })).rejects.toThrow('mendatang');
  c.classes[0]!.status = 'DIBATALKAN'; await c.services.ruangan.update(room.id, { is_active: false }); await c.services.ruangan.update(room.id, { is_active: true });
  c.classes[0]!.status = 'DITUTUP'; c.terms[0]!.tanggalSelesai = '2026-09-01';
  await c.services.ruangan.update(room.id, { is_active: false }); expect(c.slots).toHaveLength(1);
});
for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) test('Scheduling and room endpoints enforce role ' + role, async () => {
  const c = setup(role); const allowed = ['ADMIN', 'AKADEMIK'].includes(role);
  const slot = await c.services.jadwal.add(c.classes[0]!.id, c.body);
  for (const [path, method, body] of [[c.path, 'GET'], [c.path, 'POST', { ...c.body, hari: 2 }], [c.path + '/' + slot.id, 'PATCH', { hari: 3 }], [c.path + '/' + slot.id, 'DELETE'], ['/ruangan', 'GET'], ['/ruangan/' + c.rooms[0]!.id, 'GET'], ['/ruangan', 'POST', { kode: 'NEW', nama: 'Room', kapasitas: 40 }], ['/ruangan/' + c.rooms[0]!.id, 'PATCH', { nama: 'New' }]] as const) expect((await c.request(path, method, body)).status).toBe(allowed ? method === 'POST' ? 201 : 200 : 403);
});
test('Scheduling sessions, inactive users, origin and list validation remain enforced', async () => {
  const c = setup();
  for (const path of [c.path, '/ruangan']) {
    expect((await c.request(path, 'GET', undefined, '')).status).toBe(401);
    expect((await c.request(path + '?limit=101')).status).toBe(400);
    expect((await c.request(path, 'POST', path === c.path ? c.body : { kode: 'R', nama: 'Room', kapasitas: 40 }, undefined, 'https://untrusted.test')).status).toBe(403);
  }
  c.user.isActive = false; expect((await c.request(c.path)).status).toBe(401);
});
test('Schedule write retries the complete transaction and caps repeated serialization failures', async () => {
  const c = setup(); let attempts = 0;
  const service = createJadwalService({ ...c.repository, transaction: async operation => { attempts++; if (attempts < 3) throw { code: '40001' }; return c.repository.transaction(operation); } });
  await service.add(c.classes[0]!.id, c.body); expect(attempts).toBe(3); expect(c.slots).toHaveLength(1);
  attempts = 0;
  const blocked = createJadwalService({ ...c.repository, transaction: async () => { attempts++; throw { code: '40001' }; } });
  await expect(blocked.add(c.classes[0]!.id, { ...c.body, hari: 2 })).rejects.toThrow('Data berubah bersamaan'); expect(attempts).toBe(3); expect(c.slots).toHaveLength(1);
});

test('Restoring a cancelled class validates overlaps among its own retained slots', async () => {
  const c = setup(); const kelas = c.classes[0]!; kelas.status = 'DIBATALKAN';
  await c.services.jadwal.add(kelas.id, c.body);
  await c.services.jadwal.add(kelas.id, { ...c.body, ruangan_id: c.rooms[1]!.id, jam_mulai: '09:00' });
  await expect(validateClassSchedules(c.tx, { ...kelas, status: 'DRAFT' })).rejects.toThrow('kelas yang sama');
});
