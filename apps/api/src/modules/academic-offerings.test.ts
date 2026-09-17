import type { SchedulingRepository } from './jadwal/jadwal.repository';
import { expect, test } from 'bun:test';
import type { semester, kelasKuliah, kelasDosen, dosen, mataKuliah, programStudi } from '@kampusia/db/schema';
import { createApp } from '../app';
import { pagination } from '../utils/master-data';
import { academicWrite } from '../utils/academic-write';
import { createAuthService } from './auth/auth.service';
import { createSessionStore } from './auth/auth.session';
import type { AuthRecord, Role } from './auth/auth.model';
import { createSemesterService } from './semester/semester.service';
import type { SemesterRepository } from './semester/semester.repository';
import { createKelasKuliahService } from './kelas-kuliah/kelas-kuliah.service';
import type { KelasKuliahRepository } from './kelas-kuliah/kelas-kuliah.repository';
import { createKelasDosenService } from './kelas-dosen/kelas-dosen.service';
import type { KelasDosenRepository } from './kelas-dosen/kelas-dosen.repository';
type Term = typeof semester.$inferSelect;
type Class = typeof kelasKuliah.$inferSelect;
type Assignment = typeof kelasDosen.$inferSelect;
const stamps = () => ({ id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() });
const origin = 'http://localhost:5173';
const missing = '00000000-0000-4000-8000-000000000099';
const read = async <T>(response: Response) => await response.json() as { data: T; meta: { page: number; limit: number; total: number }; message: string };
const termBody = (year = 2026, jenis: 'GANJIL' | 'GENAP' = 'GANJIL') => ({ kode: `${year}${jenis === 'GANJIL' ? 1 : 2}`, nama: `Semester ${year} ${jenis}`, tahun_mulai: year, jenis, tanggal_mulai: `${year}-01-01`, tanggal_selesai: `${year}-06-30` });
function duplicate(found: boolean, constraint_name: string) { if (found) throw new Error('Duplicate', { cause: { code: '23505', constraint_name } }); }
function setup(role: Role = 'AKADEMIK') {
  const terms: Term[] = []; const classes: Class[] = []; const assignments: Assignment[] = [];
  const programs: (typeof programStudi.$inferSelect)[] = [{ ...stamps(), fakultasId: missing, kode: 'IF', nama: 'Informatika', jenjang: 'S1', isActive: true }];
  const courses: (typeof mataKuliah.$inferSelect)[] = [{ ...stamps(), kode: 'IF101', nama: 'Basis Data', sks: 3, isActive: true }];
  const lecturers: (typeof dosen.$inferSelect)[] = ['A', 'B'].map(kodeDosen => ({ ...stamps(), kodeDosen, nama: kodeDosen, nidn: null, userId: null, programStudiId: null, isActive: true }));
  const history = new Set<string>(); const selections = new Set<string>(); const scheduled = new Set<string>(); const finalized = new Set<string>(); const enrollments = new Map<string, number>();
  const eligible = new Set<string>();
  const relatedAssignments = (id: string) => assignments.filter(row => row.kelasKuliahId === id).map(row => ({ ...row, dosen: lecturers.find(item => item.id === row.dosenId)! }));
  const relatedClass = (row: Class) => ({ ...row, semester: terms.find(item => item.id === row.semesterId)!, programStudi: programs.find(item => item.id === row.programStudiId)!, mataKuliah: courses.find(item => item.id === row.mataKuliahId)!, dosen: relatedAssignments(row.id) });
  function slice<T>(rows: T[], query: { page?: number; limit?: number }) { const { page, limit } = pagination(query); return { data: rows.slice((page - 1) * limit, page * limit), meta: { page, limit, total: rows.length } }; }
  const termRepository: SemesterRepository = {
    findById: async id => terms.find(row => row.id === id),
    list: async query => slice(terms.filter(row => (!query.jenis || row.jenis === query.jenis) && (!query.tahun_mulai || row.tahunMulai === query.tahun_mulai) && (query.is_active === undefined || row.isActive === (query.is_active === 'true')) && (!query.search || (row.kode + row.nama).toLowerCase().includes(query.search.toLowerCase()))), query),
    transaction: async operation => {
      const snapshot = structuredClone(terms);
      try { return await operation({
        lockActivation: async () => {}, findById: async id => terms.find(row => row.id === id), hasHistory: async id => history.has(id),
        deactivate: async () => { terms.forEach(row => row.isActive = false); },
        create: async input => {
          duplicate(terms.some(row => row.kode === input.kode), 'semester_kode_unique');
          duplicate(terms.some(row => row.tahunMulai === input.tahunMulai && row.jenis === input.jenis), 'semester_tahun_mulai_jenis_unique');
          const row = {
            ...stamps(),
            ...input,
            krsMulaiAt: input.krsMulaiAt ?? null,
            krsSelesaiAt: input.krsSelesaiAt ?? null,
            isActive: input.isActive ?? false,
          };
          terms.push(row); return row;
        },
        update: async (id, input) => {
          const row = terms.find(row => row.id === id)!; const next = { ...row, ...input };
          duplicate(terms.some(row => row.id !== id && row.kode === next.kode), 'semester_kode_unique');
          duplicate(terms.some(row => row.id !== id && row.tahunMulai === next.tahunMulai && row.jenis === next.jenis), 'semester_tahun_mulai_jenis_unique');
          return Object.assign(row, input);
        },
      }); } catch (error) { terms.splice(0, terms.length, ...snapshot); throw error; }
    },
  };
  const scheduling: SchedulingRepository = {
    lockClass: async id => classes.find(row => row.id === id), term: async id => terms.find(row => row.id === id),
    room: async () => ({ ...stamps(), kode: 'R', nama: 'Room', gedung: null, kapasitas: 30, isActive: true }),
    slots: async id => scheduled.has(id) ? [{ ...stamps(), kelasKuliahId: id, ruanganId: missing, hari: 1, jamMulai: '08:00', jamSelesai: '10:00' }] : [],
    lecturers: async ids => assignments.filter(row => ids.includes(row.kelasKuliahId)), candidates: async () => [], approvedPeerClasses: async () => [], hasApprovalHistory: async () => false,
    create: async () => { throw new Error('Not used'); }, update: async () => { throw new Error('Not used'); }, remove: async () => {},
  };
  const classRepository: KelasKuliahRepository = {
    findById: async id => { const row = classes.find(row => row.id === id); return row ? { ...relatedClass(row), jumlahMahasiswa: enrollments.get(id) ?? 0, jumlahJadwal: scheduled.has(id) ? 1 : 0 } : undefined; },
    list: async query => slice(classes.filter(row => (!query.semester_id || row.semesterId === query.semester_id) && (!query.program_studi_id || row.programStudiId === query.program_studi_id) && (!query.mata_kuliah_id || row.mataKuliahId === query.mata_kuliah_id) && (!query.status || row.status === query.status) && (!query.search || (row.namaKelas + courses[0]!.kode + courses[0]!.nama).toLowerCase().includes(query.search.toLowerCase()))).map(relatedClass), query),
    transaction: async operation => operation({ scheduling,
      findById: async id => classes.find(row => row.id === id), lockSemester: async id => terms.find(row => row.id === id), lockProgram: async id => programs.find(row => row.id === id), lockCourse: async id => courses.find(row => row.id === id), hasCurriculum: async id => eligible.has(id),
      hasSelections: async id => selections.has(id), hasActiveDetails: async id => selections.has(id), hasFinalizedResults: async id => finalized.has(id), scheduledMeetingHasAttendance: async () => false, cancelScheduledMeetings: async () => {}, enrollmentCount: async id => enrollments.get(id) ?? 0,
      schedules: async id => scheduled.has(id) ? [{ ...stamps(), kelasKuliahId: id, ruanganId: missing, hari: 1, jamMulai: '08:00', jamSelesai: '10:00', roomCapacity: 30 }] : [], assignments: async id => relatedAssignments(id),
      create: async input => { duplicate(classes.some(row => row.semesterId === input.semesterId && row.programStudiId === input.programStudiId && row.mataKuliahId === input.mataKuliahId && row.namaKelas === input.namaKelas), 'kelas_kuliah_offering_unique'); const row = { ...stamps(), ...input, status: input.status ?? 'DRAFT' }; classes.push(row); return row; },
      update: async (id, input) => Object.assign(classes.find(row => row.id === id)!, input),
    }),
  };
  const assignmentRepository: KelasDosenRepository = {
    findClass: async id => classes.find(row => row.id === id), list: async (id, query) => slice(relatedAssignments(id), query),
    transaction: async operation => operation({ scheduling, lockClass: async id => classes.find(row => row.id === id), lockDosen: async id => lecturers.find(row => row.id === id), assignments: async id => relatedAssignments(id), hasSchedule: async id => scheduled.has(id),
      create: async (kelasKuliahId, dosenId, isKoordinator) => { const row = { ...stamps(), kelasKuliahId, dosenId, isKoordinator }; assignments.push(row); return row; },
      update: async (id, isKoordinator) => Object.assign(assignments.find(row => row.id === id)!, { isKoordinator }), remove: async id => { assignments.splice(assignments.findIndex(row => row.id === id), 1); },
    }),
  };
  const user: AuthRecord = { ...stamps(), email: 'test@kampusia.test', passwordHash: 'test', role, isActive: true };
  const sessions = createSessionStore(); const token = sessions.create(user.id, user.passwordHash);
  const services = { semester: createSemesterService(termRepository), kelasKuliah: createKelasKuliahService(classRepository), kelasDosen: createKelasDosenService(assignmentRepository) };
  const app = createApp(createAuthService({ findById: async () => user, findByEmail: async () => user }, sessions), { webOrigin: origin, production: false }, services);
  const request = (path: string, method = 'GET', body?: unknown, cookie = token, source = origin) => app.handle(new Request('http://localhost' + path, { method, headers: { origin: source, cookie: 'kampusia_session=' + cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const term = async (year = 2026) => services.semester.create(termBody(year));
  const classBody = (semester_id: string, nama_kelas = 'A') => ({ semester_id, mata_kuliah_id: courses[0]!.id, program_studi_id: programs[0]!.id, nama_kelas, kapasitas: 30 });
  const kelas = async () => services.kelasKuliah.create(classBody((await term()).id));
  return { request, term, kelas, classBody, services, terms, classes, assignments, lecturers, courses, programs, history, selections, scheduled, finalized, enrollments, eligible, user };
}

test('Semester API create, detail, update, list, filtering and pagination', async () => {
  const ctx = setup(); const response = await ctx.request('/semester', 'POST', termBody()); expect(response.status).toBe(201);
  const row = (await read<Term>(response)).data; expect(row.isActive).toBe(false);
  expect((await ctx.request('/semester/' + row.id)).status).toBe(200);
  expect((await ctx.request('/semester/' + row.id, 'PATCH', { nama: ' Koreksi ' })).status).toBe(200);
  await ctx.term(2027);
  expect((await read<Term[]>(await ctx.request('/semester?limit=1&page=2'))).meta).toEqual({ page: 2, limit: 1, total: 2 });
  const filtered = await read<Term[]>(await ctx.request('/semester?jenis=GANJIL&tahun_mulai=2026&is_active=false&search=koreksi'));
  expect(filtered.data[0]?.id).toBe(row.id); expect(filtered.meta.total).toBe(1);
});
test('Semester duplicates, code/jenis relationship, calendar dates and date range rejected', async () => {
  const ctx = setup(); await ctx.term();
  expect((await ctx.request('/semester', 'POST', termBody())).status).toBe(409);
  for (const changes of [{ kode: '20262' }, { jenis: 'PENDEK' }, { tahun_mulai: 9999 }, { tanggal_mulai: '2026-07-01' }, { tanggal_mulai: '2026-02-30' }, { nama: ' ' }]) expect((await ctx.request('/semester', 'POST', { ...termBody(), ...changes })).status).toBe(400);
  const failure = { code: '23505', constraint_name: 'semester_tahun_mulai_jenis_unique' };
  await expect(academicWrite(async () => { throw failure; })).rejects.toThrow('Tahun mulai dan jenis');
});
test('Semester activation atomically replaces active term and failed write restores previous term', async () => {
  const ctx = setup(); const a = await ctx.term(); const b = await ctx.term(2027);
  for (const id of [a.id, b.id]) expect((await ctx.request('/semester/' + id, 'PATCH', { is_active: true })).status).toBe(200);
  expect(ctx.terms.filter(row => row.isActive).map(row => row.id)).toEqual([b.id]);
  expect((await ctx.request('/semester', 'POST', { ...termBody(), is_active: true })).status).toBe(409);
  expect(ctx.terms.filter(row => row.isActive).map(row => row.id)).toEqual([b.id]);
  await ctx.services.semester.update(b.id, { is_active: false }); expect(ctx.terms.some(row => row.isActive)).toBe(false);
});
test('Semester historical identity/date mutation rejected; unchanged identity and activation allowed', async () => {
  const ctx = setup(); const row = await ctx.term(); ctx.history.add(row.id);
  for (const changes of [{ nama: 'Changed' }, { tanggal_selesai: '2026-07-01' }, { kode: '20262', jenis: 'GENAP' }]) expect((await ctx.request('/semester/' + row.id, 'PATCH', changes)).status).toBe(409);
  expect((await ctx.request('/semester/' + row.id, 'PATCH', { nama: row.nama, is_active: true })).status).toBe(200);
});
test('Kelas API create/list/detail/update, normalized identity, duplicate, combined filters and pagination', async () => {
  const ctx = setup(); const term = await ctx.term();
  const response = await ctx.request('/kelas-kuliah', 'POST', ctx.classBody(term.id, ' a ')); expect(response.status).toBe(201);
  const row = (await read<Class>(response)).data; expect(row.namaKelas).toBe('A'); expect(row.status).toBe('DRAFT');
  expect((await ctx.request('/kelas-kuliah', 'POST', ctx.classBody(term.id))).status).toBe(409);
  await ctx.services.kelasKuliah.create(ctx.classBody(term.id, 'B'));
  expect((await ctx.request('/kelas-kuliah/' + row.id, 'PATCH', { kapasitas: 20, status: 'DITUTUP' })).status).toBe(200);
  expect((await ctx.request('/kelas-kuliah/' + row.id)).status).toBe(200);
  const result = await read<Class[]>(await ctx.request(`/kelas-kuliah?semester_id=${term.id}&program_studi_id=${row.programStudiId}&mata_kuliah_id=${row.mataKuliahId}&search=basis&limit=1&page=2`));
  expect(result.meta).toEqual({ page: 2, limit: 1, total: 2 });
  expect((await read<Class[]>(await ctx.request('/kelas-kuliah?status=DITUTUP'))).data[0]?.id).toBe(row.id);
});
test('Kelas validates missing references, inactive program/course, blank name and integer capacity', async () => {
  const ctx = setup(); const body = ctx.classBody((await ctx.term()).id);
  for (const changes of [{ semester_id: missing }, { mata_kuliah_id: missing }, { program_studi_id: missing }, { nama_kelas: ' ' }, { kapasitas: 0 }, { kapasitas: -1 }, { kapasitas: 1.5 }, { kapasitas: 2147483648 }]) expect((await ctx.request('/kelas-kuliah', 'POST', { ...body, ...changes })).status).toBe(400);
  for (const row of [ctx.programs[0]!, ctx.courses[0]!]) { row.isActive = false; expect((await ctx.request('/kelas-kuliah', 'POST', body)).status).toBe(400); row.isActive = true; }
});
test('Kelas opening requires curriculum, active lecturer and schedule, then succeeds with a validated schedule', async () => {
  const ctx = setup(); const row = await ctx.kelas(); const path = '/kelas-kuliah/' + row.id;
  expect((await read(await ctx.request(path, 'PATCH', { status: 'DIBUKA' }))).message).toContain('kurikulum');
  ctx.eligible.add(row.mataKuliahId);
  expect((await read(await ctx.request(path, 'PATCH', { status: 'DIBUKA' }))).message).toContain('dosen aktif');
  await ctx.services.kelasDosen.add(row.id, { dosen_id: ctx.lecturers[0]!.id });
  expect((await read(await ctx.request(path, 'PATCH', { status: 'DIBUKA' }))).message).toContain('jadwal');
  ctx.scheduled.add(row.id);
  expect((await ctx.request(path, 'PATCH', { status: 'DIBUKA' })).status).toBe(200);
  expect(row.status).toBe('DIBUKA');
});
test('Kelas preserves selections, approved capacity, room capacity and cancellation safety', async () => {
  const ctx = setup(); const row = await ctx.kelas(); const other = await ctx.term(2027); ctx.selections.add(row.id); ctx.enrollments.set(row.id, 25);
  const path = '/kelas-kuliah/' + row.id;
  for (const changes of [{ semester_id: other.id }, { mata_kuliah_id: missing }, { program_studi_id: missing }, { kapasitas: 24 }, { status: 'DIBATALKAN' }]) expect((await ctx.request(path, 'PATCH', changes)).status).toBe(409);
  expect((await ctx.request(path, 'PATCH', { kapasitas: 25 })).status).toBe(200);
  ctx.scheduled.add(row.id);
  expect((await ctx.request(path, 'PATCH', { kapasitas: 31 })).status).toBe(409);
  expect((await ctx.request(path, 'PATCH', { status: 'DITUTUP' })).status).toBe(200);
});
test('Kelas with finalized results cannot be cancelled through the ordinary workflow', async () => {
  const ctx = setup(); const row = await ctx.kelas(); ctx.finalized.add(row.id);
  const response = await ctx.request('/kelas-kuliah/' + row.id, 'PATCH', { status: 'DIBATALKAN' });
  expect(response.status).toBe(409); expect((await read(response)).message).toContain('hasil studi final');
});
test('Kelas Dosen API list/add, duplicate, inactive, missing, coordinator uniqueness and safe removal', async () => {
  const ctx = setup(); const row = await ctx.kelas(); const path = `/kelas-kuliah/${row.id}/dosen`;
  expect((await ctx.request(path, 'POST', { dosen_id: missing })).status).toBe(400);
  ctx.lecturers[0]!.isActive = false; expect((await ctx.request(path, 'POST', { dosen_id: ctx.lecturers[0]!.id })).status).toBe(400); ctx.lecturers[0]!.isActive = true;
  const response = await ctx.request(path, 'POST', { dosen_id: ctx.lecturers[0]!.id, is_koordinator: true }); expect(response.status).toBe(201);
  const a = (await read<Assignment>(response)).data;
  expect((await ctx.request(path, 'POST', { dosen_id: a.dosenId })).status).toBe(409);
  expect((await ctx.request(path, 'POST', { dosen_id: ctx.lecturers[1]!.id, is_koordinator: true })).status).toBe(409);
  const b = await ctx.services.kelasDosen.add(row.id, { dosen_id: ctx.lecturers[1]!.id });
  expect((await read<Assignment[]>(await ctx.request(path + '?limit=1&page=2'))).meta).toEqual({ page: 2, limit: 1, total: 2 });
  expect((await ctx.request(path + '/' + b.id, 'PATCH', { is_koordinator: true })).status).toBe(409);
  expect((await ctx.request(path + '/' + a.id, 'PATCH', { is_koordinator: false })).status).toBe(200);
  expect((await ctx.request(path + '/' + b.id, 'PATCH', { is_koordinator: true })).status).toBe(200);
  expect((await ctx.request(path + '/' + a.id, 'DELETE')).status).toBe(200);
  expect((await ctx.request(path + '/' + b.id, 'DELETE')).status).toBe(200);
  expect(ctx.lecturers).toHaveLength(2);
});
test('Kelas Dosen scopes assignment IDs, protects opened class and validates scheduled additions', async () => {
  const ctx = setup(); const row = await ctx.kelas(); const other = await ctx.services.kelasKuliah.create(ctx.classBody(row.semesterId, 'B'));
  const a = await ctx.services.kelasDosen.add(row.id, { dosen_id: ctx.lecturers[0]!.id });
  for (const method of ['PATCH', 'DELETE']) expect((await ctx.request(`/kelas-kuliah/${other.id}/dosen/${a.id}`, method, method === 'PATCH' ? { is_koordinator: true } : undefined)).status).toBe(404);
  row.status = 'DIBUKA'; ctx.scheduled.add(row.id);
  expect((await ctx.request(`/kelas-kuliah/${row.id}/dosen/${a.id}`, 'DELETE')).status).toBe(409);
  expect((await ctx.request(`/kelas-kuliah/${row.id}/dosen`, 'POST', { dosen_id: ctx.lecturers[1]!.id })).status).toBe(201);
  expect((await ctx.request(`/kelas-kuliah/${row.id}/dosen/${a.id}`, 'PATCH', { is_koordinator: true })).status).toBe(200);
});
for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) test('offering routes enforce role ' + role, async () => {
  const ctx = setup(role); const row = await ctx.kelas(); const a = await ctx.services.kelasDosen.add(row.id, { dosen_id: ctx.lecturers[0]!.id }); const allowed = ['ADMIN', 'AKADEMIK'].includes(role);
  const routes = [ ['/semester', 'GET'], ['/semester/' + row.semesterId, 'GET'], ['/semester', 'POST', termBody(2027)], ['/semester/' + row.semesterId, 'PATCH', { is_active: true }], ['/kelas-kuliah', 'GET'], ['/kelas-kuliah/' + row.id, 'GET'], ['/kelas-kuliah', 'POST', ctx.classBody(row.semesterId, 'B')], ['/kelas-kuliah/' + row.id, 'PATCH', { kapasitas: 20 }], ['/kelas-kuliah/' + row.id, 'PATCH', { status: 'DITUTUP' }], [`/kelas-kuliah/${row.id}/dosen`, 'GET'], [`/kelas-kuliah/${row.id}/dosen`, 'POST', { dosen_id: ctx.lecturers[1]!.id }], [`/kelas-kuliah/${row.id}/dosen/${a.id}`, 'PATCH', { is_koordinator: true }], [`/kelas-kuliah/${row.id}/dosen/${a.id}`, 'DELETE'] ] as const;
  for (const [path, method, body] of routes) expect((await ctx.request(path, method, body)).status).toBe(allowed ? method === 'POST' ? 201 : 200 : 403);
});
test('offering routes enforce sessions, origin, validation, no hard deletes and scoped missing IDs', async () => {
  const ctx = setup(); const row = await ctx.kelas();
  for (const path of ['/semester', '/kelas-kuliah', `/kelas-kuliah/${row.id}/dosen`]) {
    expect((await ctx.request(path, 'GET', undefined, '')).status).toBe(401);
    for (const query of ['page=0', 'page=1.5', 'limit=101']) expect((await ctx.request(path + '?' + query)).status).toBe(400);
  }
  for (const path of ['/semester/' + row.semesterId, '/kelas-kuliah/' + row.id]) {
    expect((await ctx.request(path, 'DELETE')).status).toBe(404);
    expect((await ctx.request(path, 'PATCH', {})).status).toBe(400);
    expect((await ctx.request(path, 'PATCH', path.startsWith('/semester') ? { is_active: true } : { kapasitas: 20 }, undefined, 'https://evil.test')).status).toBe(403);
  }
  expect((await ctx.request(`/kelas-kuliah/${missing}/dosen`)).status).toBe(404);
  ctx.user.isActive = false;
  expect((await ctx.request('/semester')).status).toBe(401);
});
test('serializable write retries whole operation and bounds persistent conflicts', async () => {
  let calls = 0; expect(await academicWrite(async () => { calls++; if (calls < 3) throw { code: '40001' }; return 'ok'; })).toBe('ok'); expect(calls).toBe(3);
  calls = 0; await expect(academicWrite(async () => { calls++; throw { code: '40P01' }; })).rejects.toThrow('Data berubah'); expect(calls).toBe(3);
});
