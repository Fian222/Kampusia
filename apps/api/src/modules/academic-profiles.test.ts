import { expect, test } from 'bun:test';
import type { dosen, fakultas, kurikulum, mahasiswa, programStudi } from '@kampusia/db/schema';
import { createApp } from '../app';
import type { AuthRecord, Role } from './auth/auth.model';
import { createAuthService } from './auth/auth.service';
import { createSessionStore } from './auth/auth.session';
import { createMahasiswaService } from './mahasiswa/mahasiswa.service';
import type { MahasiswaRepository } from './mahasiswa/mahasiswa.repository';
import { createDosenService } from './dosen/dosen.service';
import type { DosenRepository } from './dosen/dosen.repository';
import { pagination, type ListQuery } from '../utils/master-data';

type Student = typeof mahasiswa.$inferSelect;
type Lecturer = typeof dosen.$inferSelect;
type PublicStudent = Omit<Student, 'userId'>;
type PublicLecturer = Omit<Lecturer, 'userId'>;
const missing = '00000000-0000-4000-8000-000000000099';
const origin = 'http://localhost:5173';
const dates = () => ({ createdAt: new Date(), updatedAt: new Date() });
const readStudent = async (response: Response) => await response.json() as { data: PublicStudent };
const readLecturer = async (response: Response) => await response.json() as { data: PublicLecturer };
const readList = async (response: Response) => await response.json() as Awaited<ReturnType<MahasiswaRepository['list']>>;

function setup(role: Role = 'AKADEMIK') {
  const faculty: typeof fakultas.$inferSelect = { id: crypto.randomUUID(), kode: 'FT', nama: 'Teknik', isActive: true, ...dates() };
  const program: typeof programStudi.$inferSelect = { id: crypto.randomUUID(), fakultasId: faculty.id, kode: 'IF', nama: 'Informatika', jenjang: 'S1', isActive: true, ...dates() };
  const curriculum: typeof kurikulum.$inferSelect = { id: crypto.randomUUID(), programStudiId: program.id, kode: 'K26', nama: 'Kurikulum 2026', tahunBerlaku: 2026, isActive: true, ...dates() };
  const students: Student[] = [];
  const lecturers: Lecturer[] = [];
  const accounts: AuthRecord[] = [];
  const approved = new Set<string>();
  function duplicate<T extends { id: string }>(rows: T[], candidate: T, keys: Partial<Record<keyof T, string>>) {
    for (const key of Object.keys(keys) as (keyof T)[]) {
      if (candidate[key] != null && rows.some(row => row.id !== candidate.id && row[key] === candidate[key])) throw new Error('Write failed', { cause: { code: '23505', constraint_name: keys[key] } });
    }
  }
  function list<T extends { nama: string }>(rows: T[], query: ListQuery, identifiers: (row: T) => (string | null)[]) {
    const { page, limit } = pagination(query);
    const matching = rows.filter(row => !query.search?.trim() || [...identifiers(row), row.nama].some(value => value?.toLowerCase().includes(query.search!.trim().toLowerCase())))
      .sort((a, b) => identifiers(a)[0]!.localeCompare(identifiers(b)[0]!));
    return { data: matching.slice((page - 1) * limit, page * limit), meta: { page, limit, total: matching.length } };
  }
  const references = {
    lockProgram: async (id: string) => id === program.id ? program : undefined,
    lockUser: async (id: string) => accounts.find(user => user.id === id),
    lockUserByLoginId: async (loginId: string) => accounts.find(user => user.loginId === loginId),
    loginIdOwner: async (loginId: string) => { const account = accounts.find(user => user.loginId === loginId); return account ? { id: account.id } : undefined; },
    updateUserLoginId: async (id: string, loginId: string, updatedAt: Date) => {
      const account = accounts.find(user => user.id === id);
      if (account) Object.assign(account, { loginId, updatedAt });
      return account ? { id: account.id } : undefined;
    },
    createUser: async (input: Pick<AuthRecord, 'loginId' | 'passwordHash' | 'role' | 'isActive' | 'mustChangePassword'>) => {
      const account: AuthRecord = { id: crypto.randomUUID(), email: null, ...input, ...dates() };
      duplicate(accounts, account, { loginId: 'users_login_id_unique' });
      accounts.push(account);
      return { id: account.id, loginId: account.loginId, role: account.role, isActive: account.isActive };
    },
    updateAccountPassword: async (id: string, passwordHash: string, updatedAt: Date) => {
      const account = accounts.find(user => user.id === id);
      if (!account) return undefined;
      Object.assign(account, { passwordHash, mustChangePassword: true, updatedAt });
      return { id: account.id, loginId: account.loginId, role: account.role, isActive: account.isActive };
    },
    userLinks: async (id: string) => ({ mahasiswa: students.find(row => row.userId === id)?.id, dosen: lecturers.find(row => row.userId === id)?.id }),
  };
  const safeAccount = (userId: string | null) => { const account = accounts.find(item => item.id === userId); return account ? { loginId: account.loginId, email: account.email, isActive: account.isActive } : null; };
  const relatedStudent = (row: Student) => {
    const { userId, ...profile } = row;
    const adviser = lecturers.find(item => item.id === row.dosenPaId);
    return { ...profile, programStudi: program, fakultas: faculty, kurikulum: curriculum, dosenPa: adviser ? { id: adviser.id, kodeDosen: adviser.kodeDosen, nama: adviser.nama, isActive: adviser.isActive } : null, account: safeAccount(userId) };
  };
  const relatedLecturer = (row: Lecturer) => {
    const { userId, ...profile } = row;
    return { ...profile, programStudi: row.programStudiId ? program : null, account: safeAccount(userId) };
  };
  const studentConstraints = { nim: 'mahasiswa_nim_unique', userId: 'mahasiswa_user_id_unique' };
  const lecturerConstraints = { nik: 'dosen_nik_unique', kodeDosen: 'dosen_kode_dosen_unique', nidn: 'dosen_nidn_unique', userId: 'dosen_user_id_unique' };
  const studentRepository: MahasiswaRepository = {
    list: async query => list(students.filter(row => (!query.program_studi_id || row.programStudiId === query.program_studi_id) && (!query.kurikulum_id || row.kurikulumId === query.kurikulum_id) && (!query.angkatan || row.angkatan === query.angkatan) && (!query.status || row.status === query.status)).map(relatedStudent), query, row => [row.nim]),
    findById: async id => { const row = students.find(row => row.id === id); return row ? relatedStudent(row) : undefined; },
    kurikulumOptions: async query => list([curriculum].filter(row => (!query.program_studi_id || row.programStudiId === query.program_studi_id) && (query.is_active === undefined || row.isActive === (query.is_active === 'true'))), query, row => [row.kode]),
    transaction: async operation => operation({
      ...references,
      findById: async id => students.find(row => row.id === id),
      lockKurikulum: async id => id === curriculum.id ? curriculum : undefined,
      lockDosen: async id => lecturers.find(row => row.id === id),
      hasApprovedHistory: async id => approved.has(id),
      nimOwner: async nim => { const row = students.find(item => item.nim === nim); return row ? { id: row.id } : undefined; },
      create: async input => {
        const row: Student = { ...input, id: crypto.randomUUID(), userId: input.userId ?? null, dosenPaId: input.dosenPaId ?? null, status: input.status ?? 'AKTIF', ...dates() };
        duplicate(students, row, studentConstraints); students.push(row); return row;
      },
      update: async (id, input) => {
        const row = students.find(row => row.id === id)!;
        duplicate(students, { ...row, ...input }, studentConstraints); return Object.assign(row, input);
      },
      linkUser: async (id, userId, updatedAt) => {
        const row = students.find(row => row.id === id);
        if (!row || row.userId) return undefined;
        Object.assign(row, { userId, updatedAt }); return { id };
      },
    }),
  };
  const lecturerRepository: DosenRepository = {
    list: async query => list(lecturers.filter(row => (!query.program_studi_id || row.programStudiId === query.program_studi_id) && (query.is_active === undefined || row.isActive === (query.is_active === 'true'))).map(relatedLecturer), query, row => [row.kodeDosen, row.nidn]),
    findById: async id => { const row = lecturers.find(row => row.id === id); return row ? relatedLecturer(row) : undefined; },
    transaction: async operation => operation({
      ...references,
      findById: async id => lecturers.find(row => row.id === id),
      nikOwner: async nik => { const row = lecturers.find(item => item.nik === nik); return row ? { id: row.id } : undefined; },
      create: async input => {
        const row: Lecturer = { ...input, id: crypto.randomUUID(), userId: input.userId ?? null, programStudiId: input.programStudiId ?? null, nik: input.nik ?? null, nidn: input.nidn ?? null, isActive: input.isActive ?? true, ...dates() };
        duplicate(lecturers, row, lecturerConstraints); lecturers.push(row); return row;
      },
      update: async (id, input) => {
        const row = lecturers.find(row => row.id === id)!;
        duplicate(lecturers, { ...row, ...input }, lecturerConstraints); return Object.assign(row, input);
      },
      linkUser: async (id, userId, updatedAt) => {
        const row = lecturers.find(row => row.id === id);
        if (!row || row.userId) return undefined;
        Object.assign(row, { userId, updatedAt }); return { id };
      },
    }),
  };
  const user: AuthRecord = { id: crypto.randomUUID(), loginId: '99000002', email: 'test@kampusia.test', passwordHash: 'unused-test-hash', role, isActive: true, mustChangePassword: false, ...dates() };
  const sessions = createSessionStore();
  const token = sessions.create(user.id, user.passwordHash);
  const auth = createAuthService({
    findByLoginId: async loginId => [user, ...accounts].find(item => item.loginId === loginId),
    findById: async id => [user, ...accounts].find(item => item.id === id),
    updatePassword: async (id, passwordHash) => {
      const account = [user, ...accounts].find(item => item.id === id);
      if (!account) return undefined;
      Object.assign(account, { passwordHash, mustChangePassword: false, updatedAt: new Date() });
      return account;
    },
  }, sessions);
  const app = createApp(auth, { webOrigin: origin, production: false }, { mahasiswa: createMahasiswaService(studentRepository), dosen: createDosenService(lecturerRepository) });
  const request = (path: string, method = 'GET', body?: unknown, cookie = token, source = origin) => app.handle(new Request('http://localhost' + path, {
    method, headers: { origin: source, cookie: 'kampusia_session=' + cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }));
  const studentBody = { nim: ' 001001 ', nama: ' Ahmad ', program_studi_id: program.id, kurikulum_id: curriculum.id, angkatan: 2026 };
  const lecturerBody = { nik: ' 009001 ', kode_dosen: ' ds001 ', nama: ' Dosen Satu ', program_studi_id: program.id };
  const account = (role: Role, loginId = role === 'MAHASISWA' ? '001001' : role === 'DOSEN' ? '009001' : '99999999') => { const record = { ...user, id: crypto.randomUUID(), loginId, email: crypto.randomUUID() + '@kampusia.test', role }; accounts.push(record); return record; };
  return { request, studentBody, lecturerBody, students, lecturers, accounts, curriculum, program, approved, account, user };
}

test('mahasiswa preserves digit-string NIM/name, defaults status and permits no login', async () => {
  const ctx = setup();
  const response = await ctx.request('/mahasiswa', 'POST', ctx.studentBody);
  expect(response.status).toBe(201);
  const { data } = await readStudent(response);
  expect(data.nim).toBe('001001'); expect(data.nama).toBe('Ahmad'); expect(data.status).toBe('AKTIF'); expect(data).not.toHaveProperty('userId'); expect(ctx.students[0]?.userId).toBeNull();
  expect((await ctx.request('/mahasiswa/' + data.id)).status).toBe(200);
  expect((await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, nim: '001001' })).status).toBe(409);
});

test('mahasiswa rejects missing, inactive and mismatched academic references', async () => {
  const ctx = setup();
  for (const patch of [{ program_studi_id: missing }, { kurikulum_id: missing }]) expect((await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, ...patch })).status).toBe(400);
  ctx.curriculum.programStudiId = missing;
  expect((await ctx.request('/mahasiswa', 'POST', ctx.studentBody)).status).toBe(400);
  ctx.curriculum.programStudiId = ctx.program.id; ctx.curriculum.isActive = false;
  expect((await ctx.request('/mahasiswa', 'POST', ctx.studentBody)).status).toBe(400);
  ctx.curriculum.isActive = true; ctx.program.isActive = false;
  expect((await ctx.request('/mahasiswa', 'POST', ctx.studentBody)).status).toBe(400);
});

test('mahasiswa rejects invalid status, angkatan and blank identifiers', async () => {
  const ctx = setup();
  for (const patch of [{ status: 'INVALID' }, { angkatan: 1899 }, { angkatan: 10000 }, { angkatan: 2026.5 }, { nim: '  ' }, { nim: '12A' }, { nama: '\t' }]) expect((await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, ...patch })).status).toBe(400);
  for (const angkatan of [1900, 9999]) expect((await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, nim: String(angkatan), angkatan })).status).toBe(201);
});

test('mahasiswa list supports combined filters, search, related data and pagination', async () => {
  const ctx = setup();
  for (const [nim, status, angkatan] of [['101', 'CUTI', 2026], ['102', 'AKTIF', 2025], ['103', 'CUTI', 2026]] as const) await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, nim, status, angkatan });
  const page = await readList(await ctx.request(`/mahasiswa?program_studi_id=${ctx.program.id}&kurikulum_id=${ctx.curriculum.id}&angkatan=2026&status=CUTI&search=ahmad&limit=1&page=2`));
  expect(page.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(page.data[0]?.nim).toBe('103');
  expect(page.data[0]?.programStudi.nama).toBe('Informatika'); expect(page.data[0]?.kurikulum.nama).toBe('Kurikulum 2026');
  expect((await readList(await ctx.request('/mahasiswa?search=102'))).meta.total).toBe(1);
  for (const query of ['program_studi_id=' + missing, 'kurikulum_id=' + missing, 'angkatan=2000', 'status=LULUS', 'page=99']) expect((await readList(await ctx.request('/mahasiswa?' + query))).data).toEqual([]);
});

test('mahasiswa updates preserve omitted status and historical inactive references', async () => {
  const ctx = setup();
  const row = (await readStudent(await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, status: 'CUTI' }))).data;
  const path = '/mahasiswa/' + row.id;
  expect((await ctx.request(path, 'PATCH', { nama: 'Baru' })).status).toBe(200); expect(ctx.students[0]?.status).toBe('CUTI');
  expect((await ctx.request(path, 'PATCH', { program_studi_id: missing })).status).toBe(400);
  expect((await ctx.request(path, 'PATCH', { kurikulum_id: missing })).status).toBe(400);
  expect((await ctx.request(path, 'PATCH', { status: 'INVALID' })).status).toBe(400);
  await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, nim: '002002' });
  expect((await ctx.request(path, 'PATCH', { nim: '002002' })).status).toBe(409);
  ctx.approved.add(row.id);
  expect((await ctx.request(path, 'PATCH', { kurikulum_id: missing })).status).toBe(409);
  ctx.program.isActive = false; ctx.curriculum.isActive = false;
  expect((await ctx.request(path, 'PATCH', { nama: 'Riwayat', status: 'LULUS', program_studi_id: ctx.program.id, kurikulum_id: ctx.curriculum.id })).status).toBe(200);
  expect(ctx.students[0]?.status).toBe('LULUS'); expect(ctx.user.isActive).toBe(true);
});
test('mahasiswa assigns only an existing active Dosen PA and returns compact adviser data', async () => {
  const ctx = setup(); const adviser = (await readLecturer(await ctx.request('/dosen', 'POST', ctx.lecturerBody))).data;
  const response = await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, dosen_pa_id: adviser.id });
  expect(response.status).toBe(201); const student = (await readStudent(response)).data;
  const detail = (await ctx.request('/mahasiswa/' + student.id)).json() as Promise<{ data: Student & { dosenPa: { id: string; kodeDosen: string; nama: string; isActive: boolean } | null } }>;
  expect((await detail).data.dosenPa).toMatchObject({ id: adviser.id, kodeDosen: adviser.kodeDosen, nama: adviser.nama, isActive: true });
  expect((await ctx.request('/mahasiswa/' + student.id, 'PATCH', { dosen_pa_id: missing })).status).toBe(400);
  await ctx.request('/dosen/' + adviser.id, 'PATCH', { is_active: false });
  expect((await ctx.request('/mahasiswa/' + student.id, 'PATCH', { dosen_pa_id: adviser.id })).status).toBe(200);
  const other = (await readStudent(await ctx.request('/mahasiswa', 'POST', { ...ctx.studentBody, nim: '003003' }))).data;
  expect((await ctx.request('/mahasiswa/' + other.id, 'PATCH', { dosen_pa_id: adviser.id })).status).toBe(400);
});

test('dosen create normalizes identifiers, optional NIDN/homebase and duplicate constraints', async () => {
  const ctx = setup();
  const response = await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, nidn: ' n001 ' });
  expect(response.status).toBe(201);
  const row = (await readLecturer(response)).data;
  expect(row.kodeDosen).toBe('DS001'); expect(row.nidn).toBe('N001'); expect(row.nama).toBe('Dosen Satu');
  expect((await ctx.request('/dosen', 'POST', ctx.lecturerBody)).status).toBe(409);
  expect((await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, kode_dosen: 'SECOND', nidn: 'n001' })).status).toBe(409);
  for (const kode_dosen of ['SECOND', 'THIRD']) {
    const optional = await ctx.request('/dosen', 'POST', { kode_dosen, nama: 'Tanpa NIDN', nik: null });
    expect(optional.status).toBe(201); const { data } = await readLecturer(optional);
    expect(data.nidn).toBeNull(); expect(data.programStudiId).toBeNull(); expect(data).not.toHaveProperty('userId'); expect(ctx.lecturers.at(-1)?.userId).toBeNull();
  }
});

test('dosen rejects invalid homebase and blank optional NIDN', async () => {
  const ctx = setup();
  for (const patch of [{ program_studi_id: missing }, { nidn: '  ' }, { kode_dosen: ' ' }, { nama: ' ' }]) expect((await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, ...patch })).status).toBe(400);
  ctx.program.isActive = false;
  expect((await ctx.request('/dosen', 'POST', ctx.lecturerBody)).status).toBe(400);
});

test('dosen update, nullable fields, duplicate updates and activate/deactivate retain profile', async () => {
  const ctx = setup();
  const row = (await readLecturer(await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, nidn: 'N1' }))).data;
  const path = '/dosen/' + row.id;
  await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, nik: '009002', kode_dosen: 'SECOND', nidn: 'N2' });
  for (const patch of [{ kode_dosen: 'second' }, { nidn: 'n2' }]) expect((await ctx.request(path, 'PATCH', patch)).status).toBe(409);
  expect((await ctx.request(path, 'PATCH', { program_studi_id: missing })).status).toBe(400);
  ctx.program.isActive = false;
  expect((await ctx.request(path, 'PATCH', { nama: 'Koreksi', program_studi_id: ctx.program.id })).status).toBe(200);
  for (const is_active of [false, true]) {
    expect((await ctx.request(path, 'PATCH', { is_active })).status).toBe(200);
    expect((await readLecturer(await ctx.request(path))).data.isActive).toBe(is_active);
  }
  expect((await ctx.request(path, 'PATCH', { nidn: null, program_studi_id: null })).status).toBe(200);
  expect(ctx.lecturers[0]?.nidn).toBeNull(); expect(ctx.lecturers[0]?.programStudiId).toBeNull();
});

test('dosen list searches all identifiers and filters with pagination', async () => {
  const ctx = setup();
  for (const [kode_dosen, is_active] of [['A', false], ['B', true], ['C', false]] as const) await ctx.request('/dosen', 'POST', { ...ctx.lecturerBody, nik: null, kode_dosen, nidn: 'N' + kode_dosen, is_active });
  const page = await readList(await ctx.request(`/dosen?program_studi_id=${ctx.program.id}&is_active=false&search=dosen&limit=1&page=2`));
  expect(page.meta).toEqual({ page: 2, limit: 1, total: 2 }); expect(page.data).toHaveLength(1);
  expect((await readList(await ctx.request('/dosen?search=nb'))).meta.total).toBe(1);
  expect((await readList(await ctx.request('/dosen?program_studi_id=' + missing))).data).toEqual([]);
});

for (const kind of ['mahasiswa', 'dosen'] as const) {
  test(kind + ' resolves an exact compatible account automatically and synchronizes identity changes', async () => {
    const ctx = setup(); const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    const account = ctx.account(kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN');
    const response = await ctx.request('/' + kind, 'POST', body);
    expect(response.status).toBe(201);
    const row = (await readStudent(response)).data;
    const stored = kind === 'mahasiswa' ? ctx.students[0] : ctx.lecturers[0];
    expect(stored?.userId).toBe(account.id);
    expect(row).not.toHaveProperty('userId');
    const detail = await (await ctx.request('/' + kind + '/' + row.id)).json() as { data: Record<string, unknown> & { account: Record<string, unknown> } };
    expect(detail.data).not.toHaveProperty('userId');
    expect(detail.data.account).toEqual({ loginId: account.loginId, email: account.email, isActive: true });
    expect(detail.data.account).not.toHaveProperty('id');
    const changedIdentity = kind === 'mahasiswa' ? '001010' : '009010';
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', kind === 'mahasiswa' ? { nim: changedIdentity } : { nik: changedIdentity })).status).toBe(200);
    expect(account.loginId).toBe(changedIdentity);
    if (kind === 'dosen') expect((await ctx.request('/dosen/' + row.id, 'PATCH', { nik: null })).status).toBe(400);
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', { nama: 'Koreksi' })).status).toBe(200);
    expect(stored?.userId).toBe(account.id);
    expect(account.isActive).toBe(true);
  });

  test(kind + ' links a later exact account on update but never creates an account or accepts user_id', async () => {
    const ctx = setup(); const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    const initialAccountCount = ctx.accounts.length;
    const created = await ctx.request('/' + kind, 'POST', body);
    expect(created.status).toBe(201);
    const row = (await readStudent(created)).data;
    const stored = kind === 'mahasiswa' ? ctx.students[0]! : ctx.lecturers[0]!;
    expect(stored.userId).toBeNull();
    expect(ctx.accounts).toHaveLength(initialAccountCount);
    const account = ctx.account(kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN');
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', { nama: 'Dipicu ulang' })).status).toBe(200);
    expect(stored.userId).toBe(account.id);
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', { user_id: null })).status).toBe(400);
    expect(stored.userId).toBe(account.id);
  });

  test(kind + ' rejects an exact account with an incompatible role and ignores nonmatching identities', async () => {
    const ctx = setup(); const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    const expectedIdentity = kind === 'mahasiswa' ? '001001' : '009001';
    ctx.account(kind === 'mahasiswa' ? 'DOSEN' : 'MAHASISWA', expectedIdentity);
    expect((await ctx.request('/' + kind, 'POST', body)).status).toBe(400);
    expect(kind === 'mahasiswa' ? ctx.students : ctx.lecturers).toHaveLength(0);
    const clean = setup(); const cleanBody = kind === 'mahasiswa' ? clean.studentBody : clean.lecturerBody;
    clean.account(kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN', '00000000');
    expect((await clean.request('/' + kind, 'POST', cleanBody)).status).toBe(201);
    expect((kind === 'mahasiswa' ? clean.students[0] : clean.lecturers[0])?.userId).toBeNull();
  });

  test(kind + ' revalidates an existing account link before every profile update', async () => {
    const ctx = setup(); const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    const account = ctx.account(kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN');
    const row = (await readStudent(await ctx.request('/' + kind, 'POST', body))).data;
    account.loginId = '00000000';
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', { nama: 'Tidak boleh tersimpan' })).status).toBe(400);
    expect((kind === 'mahasiswa' ? ctx.students[0] : ctx.lecturers[0])?.nama).not.toBe('Tidak boleh tersimpan');
    account.loginId = kind === 'mahasiswa' ? '001001' : '009001';
    account.role = kind === 'mahasiswa' ? 'DOSEN' : 'MAHASISWA';
    expect((await ctx.request('/' + kind + '/' + row.id, 'PATCH', { nama: 'Tetap ditolak' })).status).toBe(400);
    expect((kind === 'mahasiswa' ? ctx.students[0] : ctx.lecturers[0])?.nama).not.toBe('Tetap ditolak');
  });

  test(kind + ' rejects unauthenticated access, cross-origin writes, malformed input and deletion', async () => {
    const ctx = setup(); const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    for (const [method, suffix, input] of [['GET', '', undefined], ['GET', '/' + missing, undefined], ['POST', '', body], ['PATCH', '/' + missing, { nama: 'Baru' }]] as const) expect((await ctx.request('/' + kind + suffix, method, input, '')).status).toBe(401);
    expect((await ctx.request('/' + kind, 'POST', body, undefined, 'https://evil.test')).status).toBe(403);
    expect((await ctx.request('/' + kind + '/' + missing, 'PATCH', { nama: 'Baru' }, undefined, 'https://evil.test')).status).toBe(403);
    expect((await ctx.request('/' + kind + '/' + missing)).status).toBe(404);
    expect((await ctx.request('/' + kind + '/' + missing, 'PATCH', { nama: 'Baru' })).status).toBe(404);
    expect((await ctx.request('/' + kind + '/' + missing, 'PATCH', {})).status).toBe(400);
    expect((await ctx.request('/' + kind + '/bad-id')).status).toBe(400);
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'program_studi_id=bad']) expect((await ctx.request('/' + kind + '?' + query)).status).toBe(400);
    expect((await ctx.request('/' + kind + '/' + missing, 'DELETE')).status).toBe(404);
  });
  for (const role of ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] as const) test(kind + ' protects master data for ' + role, async () => {
    const ctx = setup(role); const allowed = role === 'ADMIN' || role === 'AKADEMIK';
    const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    expect((await ctx.request('/' + kind)).status).toBe(allowed ? 200 : 403);
    const response = await ctx.request('/' + kind, 'POST', body);
    expect(response.status).toBe(allowed ? 201 : 403);
    const id = allowed ? (await readStudent(response)).data.id : missing;
    expect((await ctx.request('/' + kind + '/' + id, 'PATCH', { nama: 'Koreksi' })).status).toBe(allowed ? 200 : 403);
    expect((await ctx.request('/' + kind + '/' + id)).status).toBe(allowed ? 200 : 403);
  });
}

test('curriculum lookup is paginated and protected without curriculum management endpoints', async () => {
  const ctx = setup();
  const result = await readList(await ctx.request('/mahasiswa/kurikulum-options?limit=1&page=1&program_studi_id=' + ctx.program.id));
  expect(result.meta).toEqual({ page: 1, limit: 1, total: 1 });
  expect((await readList(await ctx.request('/mahasiswa/kurikulum-options?page=2'))).data).toEqual([]);
  expect((await setup('MAHASISWA').request('/mahasiswa/kurikulum-options')).status).toBe(403);
  expect((await ctx.request('/mahasiswa/kurikulum-options', 'POST', {})).status).toBe(404);
});

test('obsolete manual account lookup endpoints are not exposed', async () => {
  const ctx = setup();
  expect((await ctx.request('/mahasiswa/account-options')).status).not.toBe(200);
  expect((await ctx.request('/dosen/account-options')).status).not.toBe(200);
});

test('academic status CUTI/NONAKTIF/LULUS does not disable login or revoke student sessions', async () => {
  const ctx = setup(); const account = ctx.account('MAHASISWA');
  account.passwordHash = await Bun.password.hash('ProfileTestPassword2026!', { algorithm: 'argon2id' });
  const row = (await readStudent(await ctx.request('/mahasiswa', 'POST', ctx.studentBody))).data;
  for (const status of ['CUTI', 'NONAKTIF', 'LULUS']) {
    expect((await ctx.request('/mahasiswa/' + row.id, 'PATCH', { status })).status).toBe(200);
    const login = await ctx.request('/auth/login', 'POST', { login_id: account.loginId, password: 'ProfileTestPassword2026!' }, '');
    expect(login.status).toBe(200);
    const token = login.headers.getSetCookie().find(value => value.startsWith('kampusia_session='))!.split(';')[0]!.split('=')[1]!;
    expect((await ctx.request('/auth/me', 'GET', undefined, token)).status).toBe(200);
    account.isActive = false;
    expect((await ctx.request('/auth/me', 'GET', undefined, token)).status).toBe(401);
    account.isActive = true;
  }
});

test('account linking rejects an existing link in the other profile table', async () => {
  const ctx = setup(); const account = ctx.account('DOSEN');
  const row = (await readLecturer(await ctx.request('/dosen', 'POST', ctx.lecturerBody))).data;
  // Simulate legacy data made incompatible by a role change outside this service.
  account.role = 'MAHASISWA';
  const body = { ...ctx.studentBody, nim: '009001' };
  expect((await ctx.request('/mahasiswa', 'POST', body)).status).toBe(409);
  expect(ctx.lecturers.find(item => item.id === row.id)?.userId).toBe(account.id);
});

for (const role of ['ADMIN', 'AKADEMIK'] as const) for (const kind of ['mahasiswa', 'dosen'] as const) {
  test(`${role} provisions and resets a ${kind} account without changing its identity`, async () => {
    const ctx = setup(role);
    const body = kind === 'mahasiswa' ? ctx.studentBody : ctx.lecturerBody;
    const createdProfile = await ctx.request('/' + kind, 'POST', body);
    const profile = kind === 'mahasiswa' ? (await readStudent(createdProfile)).data : (await readLecturer(createdProfile)).data;
    const provision = await ctx.request(`/${kind}/${profile.id}/account`, 'POST');
    expect(provision.status).toBe(201);
    const provisioned = await provision.json() as { data: { account: { loginId: string; role: string; isActive: boolean }; temporaryPassword: string } };
    const identity = kind === 'mahasiswa' ? '001001' : '009001';
    expect(provisioned.data.account).toEqual({ loginId: identity, role: kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN', isActive: true });
    expect(provisioned.data.temporaryPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
    const account = ctx.accounts.find(item => item.loginId === identity)!;
    expect(account.mustChangePassword).toBe(true);
    expect(account.passwordHash).not.toContain(provisioned.data.temporaryPassword);
    expect(await Bun.password.verify(provisioned.data.temporaryPassword, account.passwordHash)).toBe(true);
    const originalId = account.id;
    const originalHash = account.passwordHash;
    expect((await ctx.request(`/${kind}/${profile.id}/account`, 'POST')).status).toBe(409);
    const reset = await ctx.request(`/${kind}/${profile.id}/account/reset`, 'POST');
    expect(reset.status).toBe(200);
    const resetData = await reset.json() as { data: { temporaryPassword: string } };
    expect(account.id).toBe(originalId);
    expect(account.loginId).toBe(identity);
    expect(account.passwordHash).not.toBe(originalHash);
    expect(await Bun.password.verify(provisioned.data.temporaryPassword, account.passwordHash)).toBe(false);
    expect(await Bun.password.verify(resetData.data.temporaryPassword, account.passwordHash)).toBe(true);
    expect(account.mustChangePassword).toBe(true);
  });
}

test('provisioning reuses an exact compatible account without changing its password', async () => {
  const ctx = setup();
  const profile = (await readStudent(await ctx.request('/mahasiswa', 'POST', ctx.studentBody))).data;
  const account = ctx.account('MAHASISWA');
  const originalHash = account.passwordHash;
  const response = await ctx.request(`/mahasiswa/${profile.id}/account`, 'POST');
  expect(response.status).toBe(201);
  expect(((await response.json()) as { data: unknown }).data).toMatchObject({ created: false, temporaryPassword: null, account: { loginId: '001001', role: 'MAHASISWA' } });
  expect(account.passwordHash).toBe(originalHash);
  expect(ctx.students[0]!.userId).toBe(account.id);
});

for (const role of ['DOSEN', 'MAHASISWA'] as const) test(`${role} cannot provision or reset academic accounts`, async () => {
  const ctx = setup();
  const profile = (await readStudent(await ctx.request('/mahasiswa', 'POST', ctx.studentBody))).data;
  ctx.user.role = role;
  expect((await ctx.request(`/mahasiswa/${profile.id}/account`, 'POST')).status).toBe(403);
  expect((await ctx.request(`/mahasiswa/${profile.id}/account/reset`, 'POST')).status).toBe(403);
});
