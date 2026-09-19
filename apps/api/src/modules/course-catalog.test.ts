import { expect, test } from 'bun:test';
import type { mataKuliah, kurikulum, kurikulumMatkul, programStudi } from '@kampusia/db/schema';
import { createApp } from '../app';
import { pagination, type ListQuery } from '../utils/master-data';
import type { AuthRecord, Role } from './auth/auth.model';
import { createAuthService } from './auth/auth.service';
import { createSessionStore } from './auth/auth.session';
import type { MataKuliahRepository } from './mata-kuliah/mata-kuliah.repository';
import { createMataKuliahService } from './mata-kuliah/mata-kuliah.service';
import type { KurikulumRepository } from './kurikulum/kurikulum.repository';
import { createKurikulumService } from './kurikulum/kurikulum.service';
import type { KurikulumMatkulRepository } from './kurikulum-matkul/kurikulum-matkul.repository';
import { createKurikulumMatkulService } from './kurikulum-matkul/kurikulum-matkul.service';

type Course = typeof mataKuliah.$inferSelect;
type Curriculum = typeof kurikulum.$inferSelect;
type Membership = typeof kurikulumMatkul.$inferSelect;
const missing = '00000000-0000-4000-8000-000000000099';
const origin = 'http://localhost:5173';
const stamps = () => ({ id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() });
const read = async <T>(response: Response) => await response.json() as { data: T; meta: { page: number; limit: number; total: number }; message: string };
function setup(role: Role = 'AKADEMIK') {
  const courses: Course[] = [];
  const curricula: Curriculum[] = [];
  const memberships: Membership[] = [];
  const programs: (typeof programStudi.$inferSelect)[] = [
    { ...stamps(), fakultasId: crypto.randomUUID(), kode: 'IF', nama: 'Informatika', jenjang: 'S1', isActive: true },
    { ...stamps(), fakultasId: crypto.randomUUID(), kode: 'SI', nama: 'Sistem Informasi', jenjang: 'S1', isActive: true },
  ];
  const assigned = new Set<string>();
  const offerings = new Set<string>();
  function duplicate(found: boolean, constraint: string) {
    if (found) throw new Error('Write failed', { cause: { code: '23505', constraint_name: constraint } });
  }
  function list<T extends { kode: string; nama: string; isActive: boolean }>(rows: T[], query: ListQuery) {
    const { page, limit } = pagination(query);
    const filtered = rows.filter(row => (query.is_active === undefined || row.isActive === (query.is_active === 'true')) && (!query.search?.trim() || [row.kode, row.nama].some(text => text.toLowerCase().includes(query.search!.trim().toLowerCase())))).sort((a, b) => a.kode.localeCompare(b.kode));
    return { data: filtered.slice((page - 1) * limit, page * limit), meta: { page, limit, total: filtered.length } };
  }
  const related = (row: Curriculum) => ({ ...row, programStudi: programs.find(program => program.id === row.programStudiId)! });
  const courseRepository: MataKuliahRepository = {
    list: async query => list(courses, query), findById: async id => courses.find(row => row.id === id),
    transaction: async operation => operation({
      findById: async id => courses.find(row => row.id === id),
      hasHistory: async id => memberships.some(row => row.mataKuliahId === id) || offerings.has(id),
      create: async input => {
        duplicate(courses.some(row => row.kode === input.kode), 'mata_kuliah_kode_unique');
        const row = { ...stamps(), ...input, isActive: input.isActive ?? true }; courses.push(row); return row;
      },
      update: async (id, input) => {
        duplicate(courses.some(row => row.kode === input.kode && row.id !== id), 'mata_kuliah_kode_unique');
        return Object.assign(courses.find(row => row.id === id)!, input);
      },
    }),
  };
  const curriculumRepository: KurikulumRepository = {
    list: async query => list(curricula.filter(row => (!query.program_studi_id || row.programStudiId === query.program_studi_id) && (query.tahun_berlaku === undefined || row.tahunBerlaku === query.tahun_berlaku)).map(related), query),
    findById: async id => { const row = curricula.find(row => row.id === id); return row ? related(row) : undefined; },
    transaction: async operation => operation({
      findById: async id => curricula.find(row => row.id === id), lockProgram: async id => programs.find(row => row.id === id),
      hasStudents: async id => assigned.has(id),
      hasOfferingHistory: async id => memberships.some(row => row.kurikulumId === id && offerings.has(row.mataKuliahId)),
      create: async input => {
        duplicate(curricula.some(row => row.kode === input.kode && row.programStudiId === input.programStudiId), 'kurikulum_program_studi_id_kode_unique');
        const row = { ...stamps(), ...input, isActive: input.isActive ?? true }; curricula.push(row); return row;
      },
      update: async (id, input) => {
        const row = curricula.find(row => row.id === id)!;
        duplicate(curricula.some(other => other.id !== id && other.kode === (input.kode ?? row.kode) && other.programStudiId === (input.programStudiId ?? row.programStudiId)), 'kurikulum_program_studi_id_kode_unique');
        return Object.assign(row, input);
      },
    }),
  };
  const membershipRepository: KurikulumMatkulRepository = {
    findKurikulum: async id => curricula.find(row => row.id === id),
    list: async (id, query) => {
      const joined = memberships.filter(row => row.kurikulumId === id).map(row => ({ ...row, mataKuliah: courses.find(course => course.id === row.mataKuliahId)! }));
      const result = list(joined.map(row => ({ ...row, kode: row.mataKuliah.kode, nama: row.mataKuliah.nama, isActive: row.mataKuliah.isActive })), query);
      return { ...result, data: result.data.map(({ kode: _kode, nama: _nama, isActive: _active, ...row }) => row) };
    },
    transaction: async operation => operation({
      lockKurikulum: async id => curricula.find(row => row.id === id), lockMataKuliah: async id => courses.find(row => row.id === id),
      hasStudents: async id => assigned.has(id), hasOfferingHistory: async id => offerings.has(id),
      findMembership: async (id, membershipId) => memberships.find(row => row.kurikulumId === id && row.id === membershipId),
      create: async input => {
        duplicate(memberships.some(row => row.kurikulumId === input.kurikulumId && row.mataKuliahId === input.mataKuliahId), 'kurikulum_matkul_kurikulum_id_mata_kuliah_id_unique');
        const row = { ...stamps(), ...input, semesterRekomendasi: input.semesterRekomendasi ?? null, isWajib: input.isWajib ?? true }; memberships.push(row); return row;
      },
      update: async (id, input) => Object.assign(memberships.find(row => row.id === id)!, input),
      remove: async id => { memberships.splice(memberships.findIndex(row => row.id === id), 1); },
    }),
  };
  const user: AuthRecord = { ...stamps(), loginId: '99000002', email: 'test@kampusia.test', passwordHash: 'unused-test-hash', role, isActive: true };
  const sessions = createSessionStore(); const token = sessions.create(user.id, user.passwordHash);
  const auth = createAuthService({ findById: async () => user, findByLoginId: async () => user }, sessions);
  const app = createApp(auth, { webOrigin: origin, production: false }, { mataKuliah: createMataKuliahService(courseRepository), kurikulum: createKurikulumService(curriculumRepository), kurikulumMatkul: createKurikulumMatkulService(membershipRepository) });
  const request = (path: string, method = 'GET', body?: unknown, cookie = token, source = origin) => app.handle(new Request('http://localhost' + path, { method, headers: { origin: source, cookie: 'kampusia_session=' + cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const course = async (kode = 'IF101') => (await read<Course>(await request('/mata-kuliah', 'POST', { kode, nama: 'Basis Data', sks: 3 }))).data;
  const curriculum = async (kode = 'K26') => (await read<Curriculum>(await request('/kurikulum', 'POST', { kode, nama: 'Kurikulum 2026', program_studi_id: programs[0]!.id, tahun_berlaku: 2026 }))).data;
  return { request, course, curriculum, courses, curricula, memberships, programs, assigned, offerings, user };
}

test('course create normalizes codes and names; duplicate create/update and blanks are rejected', async () => {
  const ctx = setup();
  const response = await ctx.request('/mata-kuliah', 'POST', { kode: ' if001 ', nama: ' Basis Data ', sks: 3 });
  expect(response.status).toBe(201); const row = (await read<Course>(response)).data;
  expect(row.kode).toBe('IF001'); expect(row.nama).toBe('Basis Data'); expect(row.isActive).toBe(true);
  expect((await ctx.request('/mata-kuliah', 'POST', { kode: 'If001', nama: 'Lain', sks: 2 })).status).toBe(409);
  const other = await ctx.course('OTHER');
  expect((await ctx.request('/mata-kuliah/' + other.id, 'PATCH', { kode: 'if001' })).status).toBe(409);
  for (const body of [{ kode: ' ', nama: 'Valid', sks: 3 }, { kode: 'OK', nama: '  ', sks: 3 }]) expect((await ctx.request('/mata-kuliah', 'POST', body)).status).toBe(400);
});

test('course rejects missing, non-integer, nonpositive and overflowing SKS on create/update', async () => {
  const ctx = setup(); const row = await ctx.course();
  for (const sks of [undefined, null, 0, -1, 1.5, 32768, 'invalid']) {
    expect((await ctx.request('/mata-kuliah', 'POST', { kode: 'INVALID', nama: 'Invalid', sks })).status).toBe(400);
    if (sks !== undefined) expect((await ctx.request('/mata-kuliah/' + row.id, 'PATCH', { sks })).status).toBe(400);
  }
  expect((await ctx.request('/mata-kuliah/' + row.id, 'PATCH', { sks: 32767 })).status).toBe(200);
});

test('course list/detail/update/status retain records and implement search/filter/pagination', async () => {
  const ctx = setup(); const a = await ctx.course('A'); const b = await ctx.course('B'); await ctx.course('C');
  expect((await ctx.request('/mata-kuliah/' + a.id, 'PATCH', { nama: 'Algoritma', kode: ' a1 ', sks: 4 })).status).toBe(200);
  const detail = (await read<Course>(await ctx.request('/mata-kuliah/' + a.id))).data;
  expect(detail.kode).toBe('A1'); expect(detail.sks).toBe(4);
  expect((await ctx.request('/mata-kuliah/' + b.id, 'PATCH', { is_active: false })).status).toBe(200);
  const page = await read<Course[]>(await ctx.request('/mata-kuliah?limit=1&page=2'));
  expect(page.meta).toEqual({ page: 2, limit: 1, total: 3 }); expect(page.data[0]?.id).toBe(b.id);
  expect((await read<Course[]>(await ctx.request('/mata-kuliah?search=algoritma&is_active=true'))).data[0]?.id).toBe(a.id);
  expect((await read<Course[]>(await ctx.request('/mata-kuliah?is_active=false&search=b'))).meta.total).toBe(1);
  expect((await ctx.request('/mata-kuliah/' + b.id, 'PATCH', { is_active: true })).status).toBe(200);
  expect((await read<Course[]>(await ctx.request('/mata-kuliah?is_active=false'))).meta.total).toBe(0);
});

for (const history of ['membership', 'offering'] as const) test('course identity/SKS protected by ' + history + ' history, status and unchanged values remain writable', async () => {
  const ctx = setup(); const course = await ctx.course(); const curriculum = await ctx.curriculum();
  if (history === 'offering') ctx.offerings.add(course.id);
  else expect((await ctx.request(`/kurikulum/${curriculum.id}/mata-kuliah`, 'POST', { mata_kuliah_id: course.id })).status).toBe(201);
  const path = '/mata-kuliah/' + course.id;
  for (const body of [{ kode: 'NEW' }, { nama: 'Changed' }, { sks: 4 }]) expect((await ctx.request(path, 'PATCH', body)).status).toBe(409);
  expect((await ctx.request(path, 'PATCH', { kode: course.kode.toLowerCase(), nama: course.nama, sks: course.sks })).status).toBe(200);
  for (const is_active of [false, true]) expect((await ctx.request(path, 'PATCH', { is_active })).status).toBe(200);
});

test('curriculum validates programs and year, normalizes identifiers and scopes duplicates by program', async () => {
  const ctx = setup(); const body = { kode: ' k26 ', nama: ' Kurikulum ', program_studi_id: ctx.programs[0]!.id, tahun_berlaku: 2026 };
  expect((await ctx.request('/kurikulum', 'POST', { ...body, program_studi_id: missing })).status).toBe(400);
  ctx.programs[0]!.isActive = false;
  for (const is_active of [false, true]) expect((await ctx.request('/kurikulum', 'POST', { ...body, is_active })).status).toBe(400);
  ctx.programs[0]!.isActive = true;
  for (const tahun_berlaku of [1899, 10000, 2026.5, null, undefined]) expect((await ctx.request('/kurikulum', 'POST', { ...body, tahun_berlaku })).status).toBe(400);
  for (const changes of [{ kode: ' ' }, { nama: ' ' }]) expect((await ctx.request('/kurikulum', 'POST', { ...body, ...changes })).status).toBe(400);
  const response = await ctx.request('/kurikulum', 'POST', body); expect(response.status).toBe(201);
  const row = (await read<Curriculum>(response)).data; expect(row.kode).toBe('K26'); expect(row.nama).toBe('Kurikulum');
  expect((await ctx.request('/kurikulum', 'POST', body)).status).toBe(409);
  expect((await ctx.request('/kurikulum', 'POST', { ...body, program_studi_id: ctx.programs[1]!.id })).status).toBe(201);
  expect((await ctx.request('/kurikulum/' + row.id, 'PATCH', { program_studi_id: ctx.programs[1]!.id })).status).toBe(409);
});

test('curriculum list, combined filters, pagination, detail, update and activation', async () => {
  const ctx = setup(); const a = await ctx.curriculum('A'); await ctx.curriculum('B'); const c = await ctx.curriculum('C');
  const path = '/kurikulum/' + c.id;
  expect((await ctx.request(path, 'PATCH', { nama: 'Versi Lama', tahun_berlaku: 2025, is_active: false })).status).toBe(200);
  const detail = (await read<Curriculum & { programStudi: { id: string } }>(await ctx.request(path))).data;
  expect(detail.tahunBerlaku).toBe(2025); expect(detail.programStudi.id).toBe(ctx.programs[0]!.id);
  const result = await read<Curriculum[]>(await ctx.request(`/kurikulum?program_studi_id=${a.programStudiId}&tahun_berlaku=2026&is_active=true&search=kurikulum&limit=1&page=2`));
  expect(result.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(result.data[0]?.kode).toBe('B');
  expect((await read<Curriculum[]>(await ctx.request('/kurikulum?is_active=false'))).data[0]?.id).toBe(c.id);
  expect((await ctx.request(path, 'PATCH', { program_studi_id: missing })).status).toBe(400);
  ctx.programs[0]!.isActive = false;
  expect((await ctx.request(path, 'PATCH', { nama: 'Koreksi' })).status).toBe(200);
  expect((await ctx.request(path, 'PATCH', { is_active: true })).status).toBe(400);
  ctx.programs[0]!.isActive = true;
  expect((await ctx.request(path, 'PATCH', { is_active: true })).status).toBe(200);
  expect((await read<Curriculum[]>(await ctx.request('/kurikulum?is_active=true'))).meta.total).toBe(3);
  expect((await ctx.request(path, 'PATCH', { program_studi_id: ctx.programs[1]!.id })).status).toBe(200);
});

test('assigned curriculum preserves identity and program; deactivation leaves students and memberships intact', async () => {
  const ctx = setup(); const curriculum = await ctx.curriculum(); ctx.assigned.add(curriculum.id);
  const path = '/kurikulum/' + curriculum.id;
  for (const body of [{ kode: 'NEW' }, { nama: 'New' }, { tahun_berlaku: 2027 }, { program_studi_id: ctx.programs[1]!.id }]) expect((await ctx.request(path, 'PATCH', body)).status).toBe(409);
  for (const is_active of [false, true]) expect((await ctx.request(path, 'PATCH', { is_active })).status).toBe(200);
  expect(ctx.assigned.has(curriculum.id)).toBe(true);
});

test('membership add/list/duplicate, optional semester, edit requirements and safe removal', async () => {
  const ctx = setup(); const curriculum = await ctx.curriculum(); const course = await ctx.course(); const path = `/kurikulum/${curriculum.id}/mata-kuliah`;
  const response = await ctx.request(path, 'POST', { mata_kuliah_id: course.id }); expect(response.status).toBe(201);
  const row = (await read<Membership>(response)).data; expect(row.isWajib).toBe(true); expect(row.semesterRekomendasi).toBeNull();
  expect((await ctx.request(path, 'POST', { mata_kuliah_id: course.id })).status).toBe(409);
  const list = await read<(Membership & { mataKuliah: Course })[]>(await ctx.request(path + '?search=basis&limit=1'));
  expect(list.meta.total).toBe(1); expect(list.data[0]?.mataKuliah.sks).toBe(3);
  const detail = path + '/' + row.id;
  expect((await ctx.request(detail, 'PATCH', { semester_rekomendasi: 5 })).status).toBe(200);
  expect(ctx.memberships[0]?.semesterRekomendasi).toBe(5); expect(ctx.memberships[0]?.isWajib).toBe(true);
  expect((await ctx.request(detail, 'PATCH', { is_wajib: false })).status).toBe(200); expect(ctx.memberships[0]?.isWajib).toBe(false);
  expect((await ctx.request(detail, 'PATCH', { semester_rekomendasi: null })).status).toBe(200); expect(ctx.memberships[0]?.semesterRekomendasi).toBeNull();
  expect((await ctx.request(detail, 'DELETE')).status).toBe(200); expect(ctx.memberships).toHaveLength(0); expect(ctx.courses).toHaveLength(1);
});

test('membership rejects missing/inactive course, inactive curriculum, invalid recommendation and cross-curriculum IDs', async () => {
  const ctx = setup(); const curriculum = await ctx.curriculum(); const course = await ctx.course(); const path = `/kurikulum/${curriculum.id}/mata-kuliah`;
  expect((await ctx.request(path, 'POST', { mata_kuliah_id: missing })).status).toBe(400);
  ctx.courses[0]!.isActive = false;
  expect((await ctx.request(path, 'POST', { mata_kuliah_id: course.id })).status).toBe(400);
  ctx.courses[0]!.isActive = true; ctx.curricula[0]!.isActive = false;
  expect((await ctx.request(path, 'POST', { mata_kuliah_id: course.id })).status).toBe(400);
  ctx.curricula[0]!.isActive = true;
  const row = (await read<Membership>(await ctx.request(path, 'POST', { mata_kuliah_id: course.id }))).data;
  for (const semester_rekomendasi of [0, -1, 1.5, 32768, 'invalid']) {
    expect((await ctx.request(path, 'POST', { mata_kuliah_id: course.id, semester_rekomendasi })).status).toBe(400);
    expect((await ctx.request(path + '/' + row.id, 'PATCH', { semester_rekomendasi })).status).toBe(400);
  }
  const other = await ctx.curriculum('OTHER');
  for (const method of ['PATCH', 'DELETE']) expect((await ctx.request(`/kurikulum/${other.id}/mata-kuliah/${row.id}`, method, method === 'PATCH' ? { is_wajib: false } : undefined)).status).toBe(404);
  expect(ctx.memberships).toHaveLength(1);
});

test('assigned curriculum rejects membership additions, requirement edits and removal; unchanged patch is allowed', async () => {
  const ctx = setup(); const curriculum = await ctx.curriculum(); const course = await ctx.course(); const path = `/kurikulum/${curriculum.id}/mata-kuliah`;
  const row = (await read<Membership>(await ctx.request(path, 'POST', { mata_kuliah_id: course.id, semester_rekomendasi: 3 }))).data;
  ctx.assigned.add(curriculum.id); const other = await ctx.course('OTHER');
  expect((await ctx.request(path, 'POST', { mata_kuliah_id: other.id })).status).toBe(409);
  for (const body of [{ semester_rekomendasi: 5 }, { semester_rekomendasi: null }, { is_wajib: false }]) expect((await ctx.request(path + '/' + row.id, 'PATCH', body)).status).toBe(409);
  expect((await ctx.request(path + '/' + row.id, 'PATCH', { semester_rekomendasi: 3, is_wajib: true })).status).toBe(200);
  expect((await ctx.request(path + '/' + row.id, 'DELETE')).status).toBe(409);
  expect(ctx.memberships[0]?.semesterRekomendasi).toBe(3);
});

test('offering history prevents membership removal and curriculum identity mutation', async () => {
  const ctx = setup(); const curriculum = await ctx.curriculum(); const course = await ctx.course(); const path = `/kurikulum/${curriculum.id}/mata-kuliah`;
  const row = (await read<Membership>(await ctx.request(path, 'POST', { mata_kuliah_id: course.id }))).data;
  ctx.offerings.add(course.id);
  expect((await ctx.request(path + '/' + row.id, 'DELETE')).status).toBe(409);
  expect((await ctx.request('/kurikulum/' + curriculum.id, 'PATCH', { tahun_berlaku: 2027 })).status).toBe(409);
});

for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) test('all catalog and membership routes enforce role ' + role, async () => {
  const ctx = setup(role); const allowed = role === 'ADMIN' || role === 'AKADEMIK';
  const courseResponse = await ctx.request('/mata-kuliah', 'POST', { kode: 'A', nama: 'A', sks: 3 }); expect(courseResponse.status).toBe(allowed ? 201 : 403);
  const curriculumResponse = await ctx.request('/kurikulum', 'POST', { kode: 'A', nama: 'A', program_studi_id: ctx.programs[0]!.id, tahun_berlaku: 2026 }); expect(curriculumResponse.status).toBe(allowed ? 201 : 403);
  const courseId = allowed ? (await read<Course>(courseResponse)).data.id : missing;
  const curriculumId = allowed ? (await read<Curriculum>(curriculumResponse)).data.id : missing;
  for (const [resource, id] of [['mata-kuliah', courseId], ['kurikulum', curriculumId]]) {
    expect((await ctx.request('/' + resource)).status).toBe(allowed ? 200 : 403);
    expect((await ctx.request('/' + resource + '/' + id)).status).toBe(allowed ? 200 : 403);
    expect((await ctx.request('/' + resource + '/' + id, 'PATCH', { is_active: false })).status).toBe(allowed ? 200 : 403);
    if (allowed) await ctx.request('/' + resource + '/' + id, 'PATCH', { is_active: true });
  }
  const path = `/kurikulum/${curriculumId}/mata-kuliah`;
  expect((await ctx.request(path)).status).toBe(allowed ? 200 : 403);
  const memberResponse = await ctx.request(path, 'POST', { mata_kuliah_id: courseId }); expect(memberResponse.status).toBe(allowed ? 201 : 403);
  const memberId = allowed ? (await read<Membership>(memberResponse)).data.id : missing;
  expect((await ctx.request(path + '/' + memberId, 'PATCH', { is_wajib: false })).status).toBe(allowed ? 200 : 403);
  expect((await ctx.request(path + '/' + memberId, 'DELETE')).status).toBe(allowed ? 200 : 403);
});

test('catalog routes reject unauthenticated/inactive accounts, cross-origin writes, invalid queries, empty patches and missing IDs', async () => {
  const ctx = setup(); const course = await ctx.course(); const curriculum = await ctx.curriculum(); const path = `/kurikulum/${curriculum.id}/mata-kuliah`;
  const member = (await read<Membership>(await ctx.request(path, 'POST', { mata_kuliah_id: course.id }))).data;
  const requests = [
    ['/mata-kuliah', 'GET', undefined], ['/mata-kuliah/' + course.id, 'GET', undefined], ['/mata-kuliah', 'POST', { kode: 'X', nama: 'X', sks: 3 }], ['/mata-kuliah/' + course.id, 'PATCH', { is_active: false }],
    ['/kurikulum', 'GET', undefined], ['/kurikulum/' + curriculum.id, 'GET', undefined], ['/kurikulum', 'POST', { kode: 'X', nama: 'X', tahun_berlaku: 2026, program_studi_id: ctx.programs[0]!.id }], ['/kurikulum/' + curriculum.id, 'PATCH', { is_active: false }],
    [path, 'GET', undefined], [path, 'POST', { mata_kuliah_id: course.id }], [path + '/' + member.id, 'PATCH', { is_wajib: false }], [path + '/' + member.id, 'DELETE', undefined],
  ] as const;
  for (const [url, method, body] of requests) {
    expect((await ctx.request(url, method, body, '')).status).toBe(401);
    if (method !== 'GET') expect((await ctx.request(url, method, body, undefined, 'https://evil.test')).status).toBe(403);
  }
  for (const base of ['/mata-kuliah', '/kurikulum', path]) {
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'is_active=maybe']) expect((await ctx.request(base + '?' + query)).status).toBe(400);
    expect((await ctx.request(base + '/' + missing, 'PATCH', {})).status).toBe(400);
    expect((await ctx.request(base + '/' + missing, 'PATCH', base === path ? { is_wajib: false } : { nama: 'Missing' })).status).toBe(404);
  }
  expect((await ctx.request(`/kurikulum/${missing}/mata-kuliah`)).status).toBe(404);
  expect((await ctx.request('/mata-kuliah/' + missing)).status).toBe(404);
  expect((await ctx.request('/kurikulum/' + missing)).status).toBe(404);
  expect((await ctx.request('/mata-kuliah/' + course.id, 'DELETE')).status).toBe(404);
  expect((await ctx.request('/kurikulum/' + curriculum.id, 'DELETE')).status).toBe(404);
  ctx.user.isActive = false;
  for (const [url, method, body] of requests) expect((await ctx.request(url, method, body)).status).toBe(401);
});
