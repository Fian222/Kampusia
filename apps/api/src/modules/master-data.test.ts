import { expect, test } from 'bun:test';
import type { fakultas, programStudi } from '@kampusia/db/schema';
import { createApp } from '../app';
import type { AuthRecord, Role } from './auth/auth.model';
import { createAuthService } from './auth/auth.service';
import { createSessionStore } from './auth/auth.session';
import { createFakultasService } from './fakultas/fakultas.service';
import type { FakultasRepository } from './fakultas/fakultas.repository';
import { createProgramStudiService } from './program-studi/program-studi.service';
import type { ProgramStudiRepository } from './program-studi/program-studi.repository';
import { pagination, type ListQuery } from '../utils/master-data';

type Faculty = typeof fakultas.$inferSelect;
type Program = typeof programStudi.$inferSelect;
const missing = '00000000-0000-4000-8000-000000000099';
const origin = 'http://localhost:5173';
type ProgramList = Awaited<ReturnType<ProgramStudiRepository['list']>>;
const readList = async (response: Response) => await response.json() as ProgramList;
const readRow = async (response: Response) => await response.json() as { data: Faculty };
const readError = async (response: Response) => await response.json() as { message: string };

function setup(role: Role = 'AKADEMIK') {
  const faculties: Faculty[] = [];
  const programs: Program[] = [];
  function duplicate(rows: { id: string; kode: string }[], kode: string | undefined, constraint: string, id?: string) {
    if (rows.some(row => row.kode === kode && row.id !== id)) {
      throw new Error('Database write failed', { cause: { code: '23505', constraint_name: constraint } });
    }
  }
  function list<T extends { kode: string; nama: string; isActive: boolean }>(rows: T[], query: ListQuery) {
    const { page, limit } = pagination(query);
    const matching = rows.filter(row => (query.is_active === undefined || row.isActive === (query.is_active === 'true'))
      && (!query.search || [row.kode, row.nama].some(value => value.toLowerCase().includes(query.search!.trim().toLowerCase()))))
      .sort((a, b) => a.kode.localeCompare(b.kode));
    return { data: matching.slice((page - 1) * limit, page * limit), meta: { page, limit, total: matching.length } };
  }
  const facultyRepository: FakultasRepository = {
    list: async query => list(faculties, query),
    findById: async id => faculties.find(row => row.id === id),
    create: async input => {
      duplicate(faculties, input.kode, 'fakultas_kode_unique');
      const row = { ...input, id: crypto.randomUUID(), isActive: input.isActive ?? true, createdAt: new Date(), updatedAt: new Date() };
      faculties.push(row); return row;
    },
    update: async (id, input) => {
      duplicate(faculties, input.kode, 'fakultas_kode_unique', id);
      const row = faculties.find(row => row.id === id);
      return row ? Object.assign(row, input) : undefined;
    },
  };
  const related = (row: Program) => {
    const faculty = faculties.find(item => item.id === row.fakultasId)!;
    return { ...row, fakultas: { id: faculty.id, kode: faculty.kode, nama: faculty.nama, isActive: faculty.isActive } };
  };
  const programRepository: ProgramStudiRepository = {
    list: async query => list(programs.filter(row => (!query.fakultas_id || row.fakultasId === query.fakultas_id) && (!query.jenjang || row.jenjang === query.jenjang)).map(related), query),
    findById: async id => { const row = programs.find(item => item.id === id); return row ? related(row) : undefined; },
    transaction: async operation => operation({
      findById: async id => programs.find(row => row.id === id),
      lockFakultas: async id => faculties.find(row => row.id === id),
      create: async input => {
        duplicate(programs, input.kode, 'program_studi_kode_unique');
        const row = { ...input, id: crypto.randomUUID(), isActive: input.isActive ?? true, createdAt: new Date(), updatedAt: new Date() };
        programs.push(row); return row;
      },
      update: async (id, input) => {
        duplicate(programs, input.kode, 'program_studi_kode_unique', id);
        return Object.assign(programs.find(row => row.id === id)!, input);
      },
    }),
  };
  const user: AuthRecord = { id: crypto.randomUUID(), loginId: null, email: 'test@kampusia.test', passwordHash: 'unused-test-hash', role, isActive: true, createdAt: new Date(), updatedAt: new Date() };
  const sessions = createSessionStore();
  const token = sessions.create(user.id, user.passwordHash);
  const auth = createAuthService({ findByEmail: async () => user, findById: async () => user }, sessions);
  const app = createApp(auth, { webOrigin: origin, production: false }, { fakultas: createFakultasService(facultyRepository), programStudi: createProgramStudiService(programRepository) });
  const request = (path: string, method = 'GET', body?: unknown, cookie = token, source = origin) => app.handle(new Request('http://localhost' + path, {
    method, headers: { origin: source, cookie: 'kampusia_session=' + cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const faculty = () => facultyRepository.create({ kode: 'FT', nama: 'Teknik' });
  return { request, faculty, faculties, programs, user };
}

test('fakultas list includes inactive records and supports search, filtering and pagination', async () => {
  const ctx = setup();
  for (const [kode, nama, is_active] of [['A', 'Teknik', true], ['B', 'Bahasa', false], ['C', 'Teknik Sipil', true]] as const) {
    expect((await ctx.request('/fakultas', 'POST', { kode, nama, is_active })).status).toBe(201);
  }
  expect((await readList(await ctx.request('/fakultas'))).meta.total).toBe(3);
  const page = await readList(await ctx.request('/fakultas?limit=1&page=2'));
  expect(page.data[0]!.kode).toBe('B'); expect(page.meta).toEqual({ page: 2, limit: 1, total: 3 });
  expect((await readList(await ctx.request('/fakultas?search=teknik&is_active=true'))).meta.total).toBe(2);
  expect((await readList(await ctx.request('/fakultas?is_active=false'))).data[0]!.kode).toBe('B');
  expect((await readList(await ctx.request('/fakultas?page=99'))).data).toEqual([]);
});

test('fakultas create normalizes code/name and rejects duplicate and blank values', async () => {
  const ctx = setup();
  const result = await ctx.request('/fakultas', 'POST', { kode: ' ft ', nama: ' Teknik ' });
  expect(result.status).toBe(201);
  const row = (await readRow(result)).data;
  expect(row.kode).toBe('FT'); expect(row.nama).toBe('Teknik'); expect(row.isActive).toBe(true);
  const duplicate = await ctx.request('/fakultas', 'POST', { kode: 'Ft', nama: 'Lain' });
  expect(duplicate.status).toBe(409); expect((await readError(duplicate)).message).toBe('Kode fakultas sudah digunakan.');
  for (const body of [{ kode: ' ', nama: 'Valid' }, { kode: 'OK', nama: '\t ' }]) expect((await ctx.request('/fakultas', 'POST', body)).status).toBe(400);
});

test('fakultas detail, update, duplicate update, deactivation and reactivation retain data', async () => {
  const ctx = setup(); const row = await ctx.faculty();
  expect((await ctx.request('/fakultas/' + row.id)).status).toBe(200);
  expect((await ctx.request('/fakultas/' + row.id, 'PATCH', { kode: ' new ', nama: 'Teknik Baru' })).status).toBe(200);
  expect(row.kode).toBe('NEW');
  await ctx.request('/fakultas', 'POST', { kode: 'OTHER', nama: 'Lain' });
  expect((await ctx.request('/fakultas/' + row.id, 'PATCH', { kode: 'other' })).status).toBe(409);
  expect((await ctx.request('/fakultas/' + row.id, 'PATCH', { is_active: false })).status).toBe(200);
  expect(row.isActive).toBe(false); expect((await ctx.request('/fakultas/' + row.id)).status).toBe(200);
  expect((await ctx.request('/fakultas/' + row.id, 'PATCH', { is_active: true })).status).toBe(200);
  expect(row.isActive).toBe(true);
});

test('program studi create, list, related faculty and combined filters/pagination', async () => {
  const ctx = setup(); const faculty = await ctx.faculty();
  for (const [kode, jenjang, is_active] of [['A', 'S1', true], ['B', 'S2', false], ['C', 'S1', true]] as const) {
    const response = await ctx.request('/program-studi', 'POST', { kode: ' ' + kode.toLowerCase() + ' ', nama: ' Informatika ', fakultas_id: faculty.id, jenjang, is_active });
    expect(response.status).toBe(201); expect((await readRow(response)).data.kode).toBe(kode);
  }
  const all = await readList(await ctx.request('/program-studi')); expect(all.meta.total).toBe(3);
  expect(all.data[0]!.fakultas).toEqual({ id: faculty.id, kode: 'FT', nama: 'Teknik', isActive: true });
  const filtered = await readList(await ctx.request(`/program-studi?fakultas_id=${faculty.id}&jenjang=S1&is_active=true&search=informatika&limit=1&page=2`));
  expect(filtered.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(filtered.data[0]!.kode).toBe('C');
  expect((await readList(await ctx.request('/program-studi?is_active=false'))).data[0]!.kode).toBe('B');
  expect((await readList(await ctx.request('/program-studi?fakultas_id=' + missing))).data).toEqual([]);
});

test('program studi rejects missing/inactive faculties, invalid jenjang, blanks and global duplicate kode', async () => {
  const ctx = setup(); const faculty = await ctx.faculty();
  const body = { kode: 'IF', nama: 'Informatika', fakultas_id: faculty.id, jenjang: 'S1' };
  expect((await ctx.request('/program-studi', 'POST', { ...body, fakultas_id: missing })).status).toBe(400);
  faculty.isActive = false;
  for (const is_active of [true, false]) expect((await ctx.request('/program-studi', 'POST', { ...body, is_active })).status).toBe(400);
  faculty.isActive = true;
  const { jenjang: _jenjang, ...withoutJenjang } = body;
  expect((await ctx.request('/program-studi', 'POST', withoutJenjang)).status).toBe(400);
  expect((await ctx.request('/program-studi', 'POST', { ...body, jenjang: 'S4' })).status).toBe(400);
  expect((await ctx.request('/program-studi', 'POST', { ...body, nama: '  ' })).status).toBe(400);
  expect((await ctx.request('/program-studi', 'POST', { ...body, kode: '  ' })).status).toBe(400);
  expect((await ctx.request('/program-studi', 'POST', body)).status).toBe(201);
  const other = await readRow(await ctx.request('/fakultas', 'POST', { kode: 'OTHER', nama: 'Lain' }));
  const duplicate = await ctx.request('/program-studi', 'POST', { ...body, kode: ' if ', fakultas_id: other.data.id });
  expect(duplicate.status).toBe(409); expect((await readError(duplicate)).message).toBe('Kode program studi sudah digunakan.');
});

test('program studi update validates changed assignment and preserves inactive faculty history', async () => {
  const ctx = setup(); const faculty = await ctx.faculty();
  const created = await readRow(await ctx.request('/program-studi', 'POST', { kode: 'IF', nama: 'Informatika', fakultas_id: faculty.id, jenjang: 'S1' }));
  const path = '/program-studi/' + created.data.id;
  expect((await ctx.request(path)).status).toBe(200);
  expect((await ctx.request(path, 'PATCH', { kode: ' ti ', nama: 'Teknik Informatika', jenjang: 'D4' })).status).toBe(200);
  expect(ctx.programs[0]!.kode).toBe('TI');
  expect((await ctx.request(path, 'PATCH', { fakultas_id: missing })).status).toBe(400);
  expect((await ctx.request(path, 'PATCH', { jenjang: 'invalid' })).status).toBe(400);
  const other = await readRow(await ctx.request('/fakultas', 'POST', { kode: 'OTHER', nama: 'Lain', is_active: false }));
  expect((await ctx.request(path, 'PATCH', { fakultas_id: other.data.id })).status).toBe(400);
  faculty.isActive = false;
  expect((await ctx.request(path, 'PATCH', { nama: 'Koreksi', fakultas_id: faculty.id })).status).toBe(200);
  expect((await ctx.request(path, 'PATCH', { is_active: false })).status).toBe(200);
  expect((await ctx.request(path)).status).toBe(200);
  expect((await ctx.request(path, 'PATCH', { is_active: true })).status).toBe(400);
  faculty.isActive = true;
  expect((await ctx.request(path, 'PATCH', { is_active: true })).status).toBe(200);
  await ctx.request('/fakultas/' + other.data.id, 'PATCH', { is_active: true });
  expect((await ctx.request(path, 'PATCH', { fakultas_id: other.data.id })).status).toBe(200);
});

for (const module of ['fakultas', 'program-studi']) {
  test(module + ' rejects unauthenticated reads/writes, cross-origin writes, malformed input and missing records', async () => {
    const ctx = setup(); const faculty = await ctx.faculty();
    const body = { kode: 'OK', nama: 'Valid', fakultas_id: faculty.id, jenjang: 'S1' };
    for (const [method, suffix, input] of [['GET', '', undefined], ['GET', '/' + missing, undefined], ['POST', '', body], ['PATCH', '/' + missing, { nama: 'New' }]] as const) {
      expect((await ctx.request('/' + module + suffix, method, input, '')).status).toBe(401);
    }
    expect((await ctx.request('/' + module, 'POST', body, undefined, 'https://evil.test')).status).toBe(403);
    expect((await ctx.request('/' + module + '/' + missing, 'PATCH', { nama: 'New' }, undefined, 'https://evil.test')).status).toBe(403);
    expect((await ctx.request('/' + module + '/' + missing)).status).toBe(404);
    expect((await ctx.request('/' + module + '/' + missing, 'PATCH', { nama: 'New' })).status).toBe(404);
    expect((await ctx.request('/' + module + '/' + missing, 'PATCH', {})).status).toBe(400);
    expect((await ctx.request('/' + module + '/not-uuid')).status).toBe(400);
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'is_active=maybe']) expect((await ctx.request('/' + module + '?' + query)).status).toBe(400);
    expect((await ctx.request('/' + module + '/' + faculty.id, 'DELETE')).status).toBe(404);
  });
  for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) {
    test(module + ' enforces server-side role permissions for ' + role, async () => {
      const ctx = setup(role); const faculty = await ctx.faculty();
      const allowed = role === 'ADMIN' || role === 'AKADEMIK';
      expect((await ctx.request('/' + module)).status).toBe(allowed ? 200 : 403);
      const created = await ctx.request('/' + module, 'POST', { kode: 'TEST', nama: 'Test', fakultas_id: faculty.id, jenjang: 'S1' });
      expect(created.status).toBe(allowed ? 201 : 403);
      const id = allowed ? (await readRow(created)).data.id : missing;
      expect((await ctx.request('/' + module + '/' + id)).status).toBe(allowed ? 200 : 403);
      expect((await ctx.request('/' + module + '/' + id, 'PATCH', { is_active: false })).status).toBe(allowed ? 200 : 403);
      ctx.user.isActive = false;
      expect((await ctx.request('/' + module)).status).toBe(401);
    });
  }
}
