import { expect, test } from 'bun:test';
import type { krs, krsDetail, mahasiswa, semester } from '@kampusia/db/schema';
import { createKrsService } from './krs.service';
import { getMaximumCreditsFromIps } from './credit-limit-policy';
import type { KrsTransaction } from './krs.repository';
import { createApp } from '../../app';
import type { AuthUser } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
const uuid = () => crypto.randomUUID();
const common = () => ({ id: uuid(), createdAt: new Date(), updatedAt: new Date() });
function fixture() {
  const now = new Date('2026-09-18T05:00:00.000Z');
  const user: AuthUser = { id: uuid(), email: 'student@test.local', role: 'MAHASISWA' };
  const admin: AuthUser = { id: uuid(), email: 'admin@test.local', role: 'AKADEMIK' };
  const adviserUser: AuthUser = { id: uuid(), email: 'adviser@test.local', role: 'DOSEN' };
  const adviserId = uuid();
  const adviserAccount = { id: adviserUser.id, role: 'DOSEN' as const, isActive: true };
  const adviserProfile = { ...common(), id: adviserId, userId: adviserUser.id as string | null, programStudiId: null as string | null, nik: null as string | null, kodeDosen: 'PA', nidn: null as string | null, nama: 'Adviser', isActive: true };
  const owner: typeof mahasiswa.$inferSelect = { ...common(), userId: user.id, programStudiId: uuid(), kurikulumId: uuid(), dosenPaId: adviserId, nim: '001', nama: 'Student', angkatan: 2026, status: 'AKTIF' };
  const term: typeof semester.$inferSelect = { ...common(), kode: '20261', nama: 'Ganjil', tahunMulai: 2026, jenis: 'GANJIL', tanggalMulai: '2026-08-24', tanggalSelesai: '2027-01-15', krsMulaiAt: new Date('2026-09-01T00:00:00Z'), krsSelesaiAt: new Date('2026-10-01T00:00:00Z'), isActive: true };
  const terms: (typeof semester.$inferSelect)[] = [term];
  const academicResults = new Map<string, { sks: number; nilaiIndeks: string }[]>();
  const unfinishedResults = new Map<string, number>();
  const plans: (typeof krs.$inferSelect)[] = []; const details: (typeof krsDetail.$inferSelect)[] = [];
  const classes: Awaited<ReturnType<KrsTransaction['classes']>> = [0, 1, 2].map(i => {
    const course = { ...common(), kode: `MK${i}`, nama: `Course ${i}`, sks: 3, isActive: true };
    const id = uuid(); const lecturer = { ...common(), dosen: { id: uuid(), kodeDosen: 'D', nama: 'Teacher', isActive: true }, kelasKuliahId: id, dosenId: uuid(), isKoordinator: true };
    const room = { ...common(), kode: 'R', nama: 'Room', gedung: null, kapasitas: 40, isActive: true };
    return { ...common(), id, semesterId: term.id, programStudiId: owner.programStudiId, mataKuliahId: course.id, namaKelas: 'A', kapasitas: 1, status: 'DIBUKA', mataKuliah: course, dosen: [lecturer], jadwal: [{ ...common(), kelasKuliahId: id, ruanganId: room.id, hari: i + 1, jamMulai: '08:00:00', jamSelesai: '10:00:00', ruangan: room }], jumlahMahasiswa: 0, sisaKapasitas: 1 };
  });
  const members = classes.map(row => ({ id: row.mataKuliahId }));
  let inactive = false; const locks: string[][] = []; const finalized = new Set<string>();
  const tx: KrsTransaction = {
    actor: async id => ({ id, role: id === admin.id ? admin.role : id === adviserUser.id ? adviserUser.role : user.role, isActive: !inactive }),
    student: async id => id === user.id ? owner : { ...owner, id: uuid(), userId: id }, studentById: async () => owner,
    adviser: async id => id === adviserId ? { ...adviserProfile, account: adviserProfile.userId ? adviserAccount : null } : undefined,
    lecturerByUser: async id => id === adviserUser.id ? adviserProfile : undefined,
    term: async id => terms.find(item => item.id === id),
    previousTerm: async target => terms.filter(item => item.id !== target.id && item.tanggalSelesai < target.tanggalMulai && (item.tahunMulai < target.tahunMulai || (item.tahunMulai === target.tahunMulai && target.jenis === 'GENAP' && item.jenis === 'GANJIL'))).sort((a, b) => b.tahunMulai - a.tahunMulai || (b.jenis === 'GENAP' ? 2 : 1) - (a.jenis === 'GENAP' ? 2 : 1) || b.tanggalSelesai.localeCompare(a.tanggalSelesai))[0],
    academicResults: async (studentId, semesterId) => academicResults.get(`${studentId}:${semesterId}`) ?? [],
    unfinishedResultCount: async (studentId, semesterId) => unfinishedResults.get(`${studentId}:${semesterId}`) ?? 0,
    activeTerm: async () => term.isActive ? term : null,
    program: async () => ({ isActive: true, facultyActive: true }), memberships: async () => members,
    lockPlan: async id => plans.find(row => row.id === id), findPlan: async (studentId, termId) => plans.find(row => row.mahasiswaId === studentId && row.semesterId === termId),
    lockAdvisedPlan: async (id, lecturerId) => plans.find(row => row.id === id && owner.dosenPaId === lecturerId),
    lockClasses: async ids => { locks.push(ids); }, finalizedClassIds: async ids => ids.filter(id => finalized.has(id)), details: async id => details.filter(row => row.krsId === id),
    classes: async ids => classes.filter(row => ids.includes(row.id)).map(row => { const count = details.filter(detail => detail.kelasKuliahId === row.id && detail.status === 'AKTIF' && plans.some(plan => plan.id === detail.krsId && plan.status === 'DISETUJUI')).length; return { ...row, jumlahMahasiswa: count, sisaKapasitas: row.kapasitas - count }; }),
    detail: async id => { const plan = plans.find(row => row.id === id); if (!plan) return undefined; const rows = details.filter(row => row.krsId === id).map(row => ({ ...row, kelas: classes.find(kelas => kelas.id === row.kelasKuliahId)! })); const totalSks = rows.reduce((sum, row) => sum + (row.status === 'AKTIF' ? row.kelas.mataKuliah.sks : 0), 0); return { ...plan, mahasiswa: owner, semester: term, programStudi: { id: owner.programStudiId, kode: 'IF', nama: 'IF' }, dosenPa: { id: adviserId, kodeDosen: 'PA', nama: 'Adviser', isActive: true }, details: rows, totalSks, remainingSks: Math.max(0, plan.batasSks - totalSks) }; },
    list: async () => ({ data: [], meta: { page: 1, limit: 20, total: 0 } }), available: async () => ({ data: classes, meta: { page: 1, limit: 20, total: classes.length } }),
    create: async (mahasiswaId, semesterId, batasSks) => { const row: typeof krs.$inferSelect = { ...common(), mahasiswaId, semesterId, batasSks, status: 'DRAFT', diajukanAt: null, disetujuiAt: null, disetujuiOleh: null, ditolakAt: null, ditolakOleh: null, alasanPenolakan: null, dibukaKembaliAt: null, dibukaKembaliOleh: null, dibatalkanAt: null, dibatalkanOleh: null, alasanPembatalan: null }; plans.push(row); return row; },
    update: async (id, changes) => { const row = plans.find(row => row.id === id)!; Object.assign(row, changes, { updatedAt: new Date() }); return row; },
    add: async (krsId, kelasKuliahId) => { const row: typeof krsDetail.$inferSelect = { ...common(), krsId, kelasKuliahId, status: 'AKTIF' }; details.push(row); return row; },
    selection: async (id, status) => { const row = details.find(row => row.id === id)!; row.status = status; return row; },
    cancelDetails: async id => { details.filter(row => row.krsId === id).forEach(row => row.status = 'DIBATALKAN'); },
  };
  const repository = { transaction: <T>(fn: (tx: KrsTransaction) => Promise<T>) => fn(tx) };
  const service = createKrsService(repository, 6, getMaximumCreditsFromIps, () => new Date(now));
  const draft = () => service.create(user, term.id);
  const selected = async () => { const plan = await draft(); await service.add(user, plan.id, classes[0]!.id); return plan; };
  const submitted = async () => { const plan = await selected(); await service.submit(user, plan.id); return plan; };
  function addPreviousTerm(year: number, jenis: 'GANJIL' | 'GENAP', dates: [string, string], results: { sks: number; nilaiIndeks: string }[] = []) {
    const previous: typeof semester.$inferSelect = { ...common(), kode: `${year}${jenis === 'GANJIL' ? '1' : '2'}`, nama: `${jenis} ${year}`, tahunMulai: year, jenis, tanggalMulai: dates[0], tanggalSelesai: dates[1], krsMulaiAt: null, krsSelesaiAt: null, isActive: false };
    terms.push(previous); academicResults.set(`${owner.id}:${previous.id}`, results); return previous;
  }
  return { user, admin, adviserUser, adviserId, adviserAccount, adviserProfile, owner, term, terms, plans, details, classes, members, finalized, academicResults, unfinishedResults, tx, repository, service, locks, draft, selected, submitted, addPreviousTerm, deactivate: () => { inactive = true; } };
}

test('KRS creates/gets the same draft with server-assigned limit; missing policy fails closed', async () => {
  const f = fixture(); const plan = await f.draft(); expect((await f.draft()).id).toBe(plan.id); expect(plan.batasSks).toBe(6); expect(plan.batasSksSource).toBe('INITIAL_FALLBACK'); expect(plan.diajukanAt).toBeNull();
  const other = fixture(); await expect(createKrsService(other.repository).create(other.user, other.term.id)).rejects.toThrow('belum dikonfigurasi');
});
test('KRS resolves the latest valid prior semester, reuses stored finalized indexes, and excludes the target term', async () => {
  const f = fixture();
  f.addPreviousTerm(2024, 'GENAP', ['2025-01-01', '2025-06-30'], [{ sks: 3, nilaiIndeks: '1.00' }]);
  const previous = f.addPreviousTerm(2025, 'GENAP', ['2026-01-01', '2026-06-30'], [{ sks: 2, nilaiIndeks: '2.49' }, { sks: 3, nilaiIndeks: '3.00' }]);
  f.academicResults.set(`${f.owner.id}:${f.term.id}`, [{ sks: 20, nilaiIndeks: '4.00' }]);
  const plan = await f.service.create(f.user, f.term.id);
  expect(plan).toMatchObject({ batasSks: 21, batasSksSource: 'PREVIOUS_IPS', previousIps: '2.80', fallbackReason: null });
  expect(plan.previousSemester?.id).toBe(previous.id);
});
test('KRS falls back with no prior semester, no finalized result, or unfinished prior result', async () => {
  const first = fixture(); expect((await first.draft()).fallbackReason).toBe('NO_PREVIOUS_SEMESTER');
  const empty = fixture(); const emptyTerm = empty.addPreviousTerm(2025, 'GENAP', ['2026-01-01', '2026-06-30']);
  expect((await empty.draft()).fallbackReason).toBe('NO_FINALIZED_RESULTS');
  const unfinished = fixture(); const prior = unfinished.addPreviousTerm(2025, 'GENAP', ['2026-01-01', '2026-06-30'], [{ sks: 3, nilaiIndeks: '4.00' }]);
  unfinished.unfinishedResults.set(`${unfinished.owner.id}:${prior.id}`, 1);
  expect(await unfinished.draft()).toMatchObject({ batasSks: 6, batasSksSource: 'INITIAL_FALLBACK', fallbackReason: 'UNFINISHED_RESULTS', previousSemester: { id: prior.id } });
  expect(emptyTerm.id).toBeDefined();
});
test('complete previous IPS does not require the initial fallback configuration', async () => {
  const f = fixture(); f.addPreviousTerm(2025, 'GENAP', ['2026-01-01', '2026-06-30'], [{ sks: 3, nilaiIndeks: '3.00' }]);
  expect(await createKrsService(f.repository).create(f.user, f.term.id)).toMatchObject({ batasSks: 24, batasSksSource: 'PREVIOUS_IPS' });
});
test('calculated KRS limit is enforced and later result/policy changes do not rewrite its snapshot', async () => {
  const f = fixture(); const previous = f.addPreviousTerm(2025, 'GENAP', ['2026-01-01', '2026-06-30'], [{ sks: 3, nilaiIndeks: '4.00' }]);
  const initialPolicy = createKrsService(f.repository, 6, () => 6); const plan = await initialPolicy.create(f.user, f.term.id);
  await initialPolicy.add(f.user, plan.id, f.classes[0]!.id); await initialPolicy.add(f.user, plan.id, f.classes[1]!.id);
  await expect(initialPolicy.add(f.user, plan.id, f.classes[2]!.id)).rejects.toThrow('9 SKS melebihi batas 6');
  f.academicResults.set(`${f.owner.id}:${previous.id}`, [{ sks: 3, nilaiIndeks: '1.00' }]);
  const changedPolicy = createKrsService(f.repository, 6, () => 3); const retained = await changedPolicy.create(f.user, f.term.id);
  expect(retained).toMatchObject({ id: plan.id, batasSks: 6, batasSksSource: 'EXISTING_SNAPSHOT' });
});
test('KRS ownership scopes all student mutations and semester reads', async () => {
  const f = fixture(); const plan = await f.selected(); const stranger = { ...f.user, id: uuid() };
  for (const action of [() => f.service.add(stranger, plan.id, f.classes[1]!.id), () => f.service.remove(stranger, plan.id, f.details[0]!.id), () => f.service.submit(stranger, plan.id), () => f.service.reopen(stranger, plan.id)]) await expect(action()).rejects.toThrow('KRS tidak ditemukan');
  const context = await f.service.bySemester(stranger, f.term.id);
  expect(context.krs).toBeNull();
  expect(context.dosenPa).toMatchObject({ id: f.adviserId, kodeDosen: 'PA', nama: 'Adviser', isActive: true });
});
test('KRS valid selection, duplicate class/course prevention and cancelled detail reactivation', async () => {
  const f = fixture(); const plan = await f.selected(); const detail = f.details[0]!;
  await expect(f.service.add(f.user, plan.id, f.classes[0]!.id)).rejects.toThrow('sudah dipilih');
  f.classes[1]!.mataKuliahId = f.classes[0]!.mataKuliahId;
  await expect(f.service.add(f.user, plan.id, f.classes[1]!.id)).rejects.toThrow('kelas lain');
  await f.service.remove(f.user, plan.id, detail.id); expect(detail.status).toBe('DIBATALKAN');
  expect((await f.service.add(f.user, plan.id, f.classes[0]!.id)).id).toBe(detail.id); expect(f.details).toHaveLength(1);
});
test('KRS cannot add or reactivate enrollment in a finalized class', async () => {
  const f = fixture(); const plan = await f.draft(); f.finalized.add(f.classes[0]!.id);
  await expect(f.service.add(f.user, plan.id, f.classes[0]!.id)).rejects.toThrow('difinalisasi');
});
for (const [label, change, message] of [
  ['wrong semester', (f: ReturnType<typeof fixture>) => { f.classes[0]!.semesterId = uuid(); }, 'Semester kelas'],
  ['wrong program', (f: ReturnType<typeof fixture>) => { f.classes[0]!.programStudiId = uuid(); }, 'Program studi kelas'],
  ['outside curriculum', (f: ReturnType<typeof fixture>) => { f.members.length = 0; }, 'kurikulum'],
  ['closed class', (f: ReturnType<typeof fixture>) => { f.classes[0]!.status = 'DITUTUP'; }, 'DIBUKA'],
  ['cancelled class', (f: ReturnType<typeof fixture>) => { f.classes[0]!.status = 'DIBATALKAN'; }, 'DIBUKA'],
  ['inactive course', (f: ReturnType<typeof fixture>) => { f.classes[0]!.mataKuliah.isActive = false; }, 'aktif'],
  ['inactive room', (f: ReturnType<typeof fixture>) => { f.classes[0]!.jadwal[0]!.ruangan.isActive = false; }, 'ruangan'],
  ['inactive lecturer', (f: ReturnType<typeof fixture>) => { f.classes[0]!.dosen[0]!.dosen.isActive = false; }, 'dosen aktif'],
] as const) test(`KRS rejects ${label} on add and revalidates on submission/approval`, async () => {
  const f = fixture(); const plan = await f.draft(); change(f); await expect(f.service.add(f.user, plan.id, f.classes[0]!.id)).rejects.toThrow(message);
  const g = fixture(); const pending = await g.submitted(); change(g); await expect(g.service.approve(g.admin, pending.id)).rejects.toThrow(message); expect(pending.status).toBe('DIAJUKAN');
  pending.status = 'DRAFT'; pending.diajukanAt = null; await expect(g.service.submit(g.user, pending.id)).rejects.toThrow(message);
});
test('KRS dynamically validates SKS and ignores cancelled details', async () => {
  const f = fixture(); const plan = await f.selected(); await f.service.add(f.user, plan.id, f.classes[1]!.id);
  await expect(f.service.add(f.user, plan.id, f.classes[2]!.id)).rejects.toThrow('9 SKS melebihi batas 6');
  await f.service.remove(f.user, plan.id, f.details[0]!.id); await f.service.add(f.user, plan.id, f.classes[2]!.id);
  expect((await f.service.bySemester(f.user, f.term.id)).krs).toMatchObject({ totalSks: 6, remainingSks: 0 });
  plan.batasSks = 3; await expect(f.service.submit(f.user, plan.id)).rejects.toThrow('SKS');
});
test('KRS rejects schedule overlap but permits adjacent slots using Jadwal semantics', async () => {
  const f = fixture(); const plan = await f.selected(); const slot = f.classes[1]!.jadwal[0]!; slot.hari = 1; slot.jamMulai = '09:00';
  await expect(f.service.add(f.user, plan.id, f.classes[1]!.id)).rejects.toThrow('Jadwal bentrok');
  slot.jamMulai = '10:00'; slot.jamSelesai = '12:00'; await f.service.add(f.user, plan.id, f.classes[1]!.id);
  slot.jamMulai = '09:00'; await expect(f.service.submit(f.user, plan.id)).rejects.toThrow('Jadwal bentrok');
});
test('KRS empty submission and ineligible students/semesters are rejected', async () => {
  const f = fixture(); const plan = await f.draft(); await expect(f.service.submit(f.user, plan.id)).rejects.toThrow('setidaknya satu');
  f.owner.status = 'CUTI'; await expect(f.service.add(f.user, plan.id, f.classes[0]!.id)).rejects.toThrow('AKTIF'); f.owner.status = 'AKTIF';
  f.term.isActive = false; await expect(f.service.add(f.user, plan.id, f.classes[0]!.id)).rejects.toThrow('semester aktif');
  const g = fixture(); const pending = await g.submitted(); g.owner.status = 'LULUS'; await expect(g.service.approve(g.admin, pending.id)).rejects.toThrow('AKTIF');
});
test('KRS period uses configured half-open boundaries and fails closed when missing', async () => {
  const before = fixture(); before.term.krsMulaiAt = new Date('2026-09-18T05:00:00.001Z');
  await expect(before.draft()).rejects.toThrow('belum dibuka');
  const opening = fixture(); opening.term.krsMulaiAt = new Date('2026-09-18T05:00:00.000Z');
  expect((await opening.draft()).status).toBe('DRAFT');
  const closing = fixture(); closing.term.krsSelesaiAt = new Date('2026-09-18T05:00:00.000Z');
  await expect(closing.draft()).rejects.toThrow('ditutup');
  const missing = fixture(); missing.term.krsMulaiAt = null; missing.term.krsSelesaiAt = null;
  await expect(missing.draft()).rejects.toThrow('belum dijadwalkan');
});
test('Kosongkan KRS retains parent, limit and details and permits reactivation', async () => {
  const f = fixture(); const plan = await f.selected(); const detail = f.details[0]!;
  await f.service.clear(f.user, plan.id);
  expect(plan.status).toBe('DRAFT'); expect(plan.batasSks).toBe(6); expect(detail.status).toBe('DIBATALKAN'); expect(f.details).toHaveLength(1);
  await f.service.add(f.user, plan.id, f.classes[0]!.id);
  expect(detail.status).toBe('AKTIF'); expect(f.details).toHaveLength(1);
});
test('submission requires a complete active Dosen PA account', async () => {
  const missing = fixture(); const missingPlan = await missing.selected(); missing.owner.dosenPaId = null;
  await expect(missing.service.submit(missing.user, missingPlan.id)).rejects.toThrow('belum ditetapkan');
  const inactive = fixture(); const inactivePlan = await inactive.selected(); inactive.adviserProfile.isActive = false;
  await expect(inactive.service.submit(inactive.user, inactivePlan.id)).rejects.toThrow('tidak aktif');
  const unlinked = fixture(); const unlinkedPlan = await unlinked.selected(); unlinked.adviserProfile.userId = null;
  await expect(unlinked.service.submit(unlinked.user, unlinkedPlan.id)).rejects.toThrow('belum terhubung');
  const inactiveAccount = fixture(); const inactiveAccountPlan = await inactiveAccount.selected(); inactiveAccount.adviserAccount.isActive = false;
  await expect(inactiveAccount.service.submit(inactiveAccount.user, inactiveAccountPlan.id)).rejects.toThrow('Akun Dosen PA tidak aktif');
  const wrongRole = fixture(); const wrongRolePlan = await wrongRole.selected(); wrongRole.adviserAccount.role = 'AKADEMIK' as 'DOSEN';
  await expect(wrongRole.service.submit(wrongRole.user, wrongRolePlan.id)).rejects.toThrow('peran DOSEN');
  const valid = fixture(); expect((await valid.submitted()).status).toBe('DIAJUKAN');
});
test('Dosen PA review is ownership scoped and rejection metadata is retained for correction', async () => {
  const f = fixture(); const plan = await f.submitted();
  await f.service.reject(f.adviserUser, plan.id, '  Jadwal perlu diperbaiki  ');
  expect(plan).toMatchObject({ status: 'DITOLAK', ditolakOleh: f.adviserUser.id, alasanPenolakan: 'Jadwal perlu diperbaiki' });
  const rejectedAt = plan.ditolakAt; await f.service.reopenRejected(f.user, plan.id);
  expect(plan).toMatchObject({ status: 'DRAFT', diajukanAt: null, ditolakAt: rejectedAt, alasanPenolakan: 'Jadwal perlu diperbaiki', batasSks: 6 });
  const other = fixture(); const pending = await other.submitted(); other.owner.dosenPaId = uuid();
  await expect(other.service.approve(other.adviserUser, pending.id)).rejects.toThrow('KRS tidak ditemukan');
});
test('administrative cancellation is reasoned, terminal, and allowed after period close', async () => {
  const f = fixture(); const plan = await f.submitted(); f.term.krsSelesaiAt = new Date('2026-09-18T05:00:00.000Z');
  await f.service.cancel(f.admin, plan.id, ' Koreksi registrasi ');
  expect(plan).toMatchObject({ status: 'DIBATALKAN', dibatalkanOleh: f.admin.id, alasanPembatalan: 'Koreksi registrasi', batasSks: 6 });
  expect(f.details[0]!.status).toBe('DIBATALKAN');
  await expect(f.service.cancel(f.admin, plan.id, 'lagi')).rejects.toThrow('final');
});
test('KRS rejection/reopen/resubmission timestamps and invalid transitions', async () => {
  const f = fixture(); const plan = await f.submitted(); const submittedAt = plan.diajukanAt;
  await expect(f.service.add(f.user, plan.id, f.classes[1]!.id)).rejects.toThrow('DRAFT');
  await expect(f.service.remove(f.user, plan.id, f.details[0]!.id)).rejects.toThrow('DRAFT');
  await f.service.reject(f.admin, plan.id); expect(plan.diajukanAt).toBe(submittedAt); expect(plan.disetujuiAt).toBeNull(); expect(plan.disetujuiOleh).toBeNull();
  await expect(f.service.approve(f.admin, plan.id)).rejects.toThrow('DIAJUKAN');
  await f.service.reopen(f.user, plan.id); expect(plan.status).toBe('DRAFT'); expect(plan.diajukanAt).toBeNull();
  await f.service.submit(f.user, plan.id); expect(plan.diajukanAt).not.toBe(submittedAt);
});
test('KRS approval, student immutability, administrative reopen and terminal cancellation', async () => {
  const f = fixture(); const plan = await f.submitted(); await f.service.approve(f.admin, plan.id);
  expect(plan.status).toBe('DISETUJUI'); expect(plan.disetujuiOleh).toBe(f.admin.id); expect(plan.disetujuiAt).toBeInstanceOf(Date);
  await expect(f.service.submit(f.user, plan.id)).rejects.toThrow('DRAFT'); await expect(f.service.reopen(f.user, plan.id)).rejects.toThrow('DITOLAK');
  f.term.isActive = false; await expect(f.service.reopen(f.admin, plan.id, true)).rejects.toThrow('semester aktif'); f.term.isActive = true;
  const originalApprover = plan.disetujuiOleh; await f.service.reopen(f.admin, plan.id, true); expect(plan.disetujuiOleh).toBe(originalApprover); expect(plan.dibukaKembaliOleh).toBe(f.admin.id); expect(plan.diajukanAt).toBeNull(); expect(f.details[0]!.status).toBe('AKTIF');
  expect(plan.batasSks).toBe(6);
  await f.service.submit(f.user, plan.id); await f.service.approve(f.admin, plan.id); const approvedAt = plan.disetujuiAt;
  await f.service.cancel(f.admin, plan.id); expect(plan.disetujuiAt).toBe(approvedAt); expect(plan.disetujuiOleh).toBe(f.admin.id); expect(f.details[0]!.status).toBe('DIBATALKAN');
  await expect(f.draft()).rejects.toThrow('DIBATALKAN'); await expect(f.service.cancel(f.admin, plan.id)).rejects.toThrow('final');
});
test('KRS capacity counts only approved active details, and cancel/reopen release seats', async () => {
  const f = fixture(); const plan = await f.submitted();
  const other = { ...plan, id: uuid(), mahasiswaId: uuid(), status: 'DRAFT' as const };
  f.plans.push(other); f.details.push({ ...f.details[0]!, id: uuid(), krsId: other.id });
  await f.service.approve(f.admin, plan.id); expect((await f.tx.classes([f.classes[0]!.id]))[0]!.jumlahMahasiswa).toBe(1);
  await f.service.reopen(f.admin, plan.id, true); expect((await f.tx.classes([f.classes[0]!.id]))[0]!.jumlahMahasiswa).toBe(0);
  await f.service.submit(f.user, plan.id); const competing = f.plans[1]!; competing.status = 'DISETUJUI';
  await expect(f.service.approve(f.admin, plan.id)).rejects.toThrow('penuh'); competing.status = 'DIAJUKAN';
  await f.service.approve(f.admin, plan.id); await f.service.cancel(f.admin, plan.id); expect((await f.tx.classes([f.classes[0]!.id]))[0]!.jumlahMahasiswa).toBe(0);
});
test('KRS service enforces admin role and live account status', async () => {
  const f = fixture(); const plan = await f.submitted();
  for (const user of [f.user, { ...f.admin, role: 'DOSEN' as const }]) for (const action of [() => f.service.approve(user, plan.id), () => f.service.reject(user, plan.id), () => f.service.cancel(user, plan.id), () => f.service.reopen(user, plan.id, true), () => f.service.list(user, {}), () => f.service.get(user, plan.id)]) await expect(action()).rejects.toThrow(/akses|izin KRS/);
  f.deactivate(); await expect(f.service.approve(f.admin, plan.id)).rejects.toThrow('izin KRS');
});
test('KRS API rejects missing session, other roles, foreign ownership, CSRF; credit-limit payload cannot change policy', async () => {
  const f = fixture(); const plan = await f.selected(); let current: AuthUser | null = f.user;
  const auth: AuthService = { current: async () => current, login: async () => { throw new Error('unused'); }, logout: () => {} };
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', production: false }, { krs: f.service });
  const request = (path: string, method = 'GET', body?: object, origin = 'http://localhost:5173') => app.handle(new Request('http://localhost' + path, { method, headers: { origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  expect((await request('/mahasiswa/me/krs')).status).toBe(200);
  expect((await request(`/mahasiswa/me/krs/${f.term.id}`)).status).toBe(200);
  expect((await request('/krs')).status).toBe(403);
  expect((await request(`/mahasiswa/me/krs/${f.term.id}`, 'POST', { batas_sks: 100 })).status).toBe(200);
  expect(plan.batasSks).toBe(6);
  expect((await request(`/mahasiswa/me/krs/${plan.id}/clear`, 'POST', {})).status).toBe(200);
  expect(f.details[0]!.status).toBe('DIBATALKAN'); await f.service.add(f.user, plan.id, f.classes[0]!.id);
  expect((await request(`/mahasiswa/me/krs/${plan.id}/submit`, 'POST', {}, 'http://evil.test')).status).toBe(403);
  current = { ...f.user, id: uuid() }; expect((await request(`/mahasiswa/me/krs/${plan.id}/submit`, 'POST', {})).status).toBe(404);
  current = f.user; expect((await request(`/mahasiswa/me/krs/${plan.id}/submit`, 'POST', {})).status).toBe(200);
  current = f.adviserUser; expect((await request('/dosen/me/krs')).status).toBe(200); expect((await request(`/dosen/me/krs/${plan.id}`)).status).toBe(200);
  expect((await request(`/dosen/me/krs/${plan.id}/reject`, 'POST', { alasan: '' })).status).toBe(400);
  expect((await request(`/dosen/me/krs/${plan.id}/reject`, 'POST', { alasan: 'Perbaiki jadwal' })).status).toBe(200);
  current = { ...f.admin, role: 'DOSEN' }; expect((await request(`/krs/${plan.id}/approve`, 'POST', {})).status).toBe(403);
  current = f.admin; expect((await request('/krs')).status).toBe(200); expect((await request(`/krs/${plan.id}`)).status).toBe(200);
  current = null; expect((await request('/mahasiswa/me/krs')).status).toBe(401);
});
