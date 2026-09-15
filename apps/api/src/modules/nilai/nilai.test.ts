import { expect, test } from 'bun:test';
import type { hasilStudi, kelasKuliah, komponenNilai, nilaiMahasiswa } from '@kampusia/db/schema';
import { createApp } from '../../app';
import type { AuthUser } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { weightedFinal } from './grading-policy';
import type { NilaiRepository, NilaiTransaction } from './nilai.repository';
import { createNilaiService } from './nilai.service';

const uuid = () => crypto.randomUUID();
const common = () => ({ id: uuid(), createdAt: new Date(), updatedAt: new Date() });
function fixture() {
  const admin: AuthUser = { id: uuid(), email: 'admin@test.local', role: 'ADMIN' };
  const academic: AuthUser = { id: uuid(), email: 'academic@test.local', role: 'AKADEMIK' };
  const lecturerUser: AuthUser = { id: uuid(), email: 'dosen@test.local', role: 'DOSEN' };
  const foreignLecturer: AuthUser = { id: uuid(), email: 'foreign@test.local', role: 'DOSEN' };
  const studentUser: AuthUser = { id: uuid(), email: 'student@test.local', role: 'MAHASISWA' };
  const users = [admin, academic, lecturerUser, foreignLecturer, studentUser];
  const kelas: typeof kelasKuliah.$inferSelect = { ...common(), semesterId: uuid(), mataKuliahId: uuid(), programStudiId: uuid(), namaKelas: 'A', kapasitas: 30, status: 'DITUTUP' };
  const classInfo = { ...kelas, semester: { id: kelas.semesterId, kode: '20261', nama: 'Ganjil' }, mataKuliah: { id: kelas.mataKuliahId, kode: 'IF101', nama: 'Basis Data', sks: 3 }, programStudi: { id: kelas.programStudiId, kode: 'IF', nama: 'Informatika' } };
  const lecturer = { id: uuid(), isActive: true };
  const students = [{ id: uuid(), nim: '001', nama: 'Ani', krsId: uuid(), detailId: uuid() }, { id: uuid(), nim: '002', nama: 'Budi', krsId: uuid(), detailId: uuid() }];
  const components: (typeof komponenNilai.$inferSelect)[] = [];
  const scores: (typeof nilaiMahasiswa.$inferSelect)[] = [];
  const results: (typeof hasilStudi.$inferSelect)[] = [];
  let effective = [...students]; let assigned = true; let coordinatorId: string | undefined = lecturer.id; let activeActor = true; let failResultUpdate = false;
  const tx = {
    actor: async (id: string) => { const user = users.find(row => row.id === id); return user ? { id, role: user.role, isActive: activeActor } : undefined; },
    lecturer: async (id: string) => id === lecturerUser.id ? lecturer : id === foreignLecturer.id ? { id: uuid(), isActive: true } : undefined,
    assignment: async (_classId: string, id: string) => assigned && id === lecturer.id ? { ...common(), kelasKuliahId: kelas.id, dosenId: id, isKoordinator: coordinatorId === id } : undefined,
    coordinator: async () => coordinatorId ? { dosenId: coordinatorId } : undefined,
    classInfo: async (id: string) => id === kelas.id ? classInfo : undefined,
    lockClass: async (id: string) => id === kelas.id ? kelas : undefined,
    relatedPlanIds: async (_id: string, studentId?: string) => effective.filter(row => !studentId || row.id === studentId).map(row => row.krsId), lockPlans: async () => {},
    effectiveRoster: async () => effective,
    components: async () => [...components].sort((a, b) => a.urutan - b.urutan || a.id.localeCompare(b.id)),
    component: async (id: string) => components.find(row => row.id === id),
    scores: async () => scores.map(row => ({ ...row, komponen: { kelasKuliahId: kelas.id, nama: components.find(item => item.id === row.komponenNilaiId)!.nama, bobot: components.find(item => item.id === row.komponenNilaiId)!.bobot, urutan: 1, isActive: components.find(item => item.id === row.komponenNilaiId)!.isActive }, mahasiswa: students.find(item => item.id === row.mahasiswaId) ?? { id: row.mahasiswaId, nim: 'H', nama: 'Historis' } })),
    results: async () => results.map(row => ({ ...row, mahasiswa: students.find(item => item.id === row.mahasiswaId) ?? { id: row.mahasiswaId, nim: 'H', nama: 'Historis' } })),
    createComponent: async (classId: string, input: Pick<typeof komponenNilai.$inferInsert, 'nama' | 'bobot' | 'urutan' | 'isActive'>) => { const row: typeof komponenNilai.$inferSelect = { ...common(), kelasKuliahId: classId, nama: input.nama, bobot: input.bobot, urutan: input.urutan, isActive: input.isActive ?? true }; components.push(row); return row; },
    updateComponent: async (id: string, input: Partial<typeof komponenNilai.$inferInsert>) => Object.assign(components.find(row => row.id === id)!, input, { updatedAt: new Date() }),
    deleteComponent: async (id: string) => components.splice(components.findIndex(row => row.id === id), 1)[0],
    scoreCount: async (id: string) => scores.some(row => row.komponenNilaiId === id) ? 1 : 0,
    upsertScore: async (componentId: string, studentId: string, nilai: string | null, actorId: string) => { const found = scores.find(row => row.komponenNilaiId === componentId && row.mahasiswaId === studentId); if (found) return Object.assign(found, { nilai, diubahOleh: actorId, updatedAt: new Date() }); const row: typeof nilaiMahasiswa.$inferSelect = { ...common(), komponenNilaiId: componentId, mahasiswaId: studentId, nilai, dicatatOleh: actorId, diubahOleh: actorId }; scores.push(row); return row; },
    insertResults: async (rows: (typeof hasilStudi.$inferInsert)[]) => rows.map(input => { const row: typeof hasilStudi.$inferSelect = { ...common(), kelasKuliahId: input.kelasKuliahId, mahasiswaId: input.mahasiswaId, nilaiAngka: input.nilaiAngka, nilaiHuruf: input.nilaiHuruf, nilaiIndeks: input.nilaiIndeks, difinalisasiAt: input.difinalisasiAt, difinalisasiOleh: input.difinalisasiOleh, dikoreksiAt: null, dikoreksiOleh: null, alasanKoreksi: null }; results.push(row); return row; }),
    updateResult: async (id: string, input: Partial<typeof hasilStudi.$inferInsert>) => { if (failResultUpdate) throw new Error('simulated result failure'); return Object.assign(results.find(row => row.id === id)!, input, { updatedAt: new Date() }); },
  };
  const repository: NilaiRepository = { transaction: async operation => { const snapshots = [structuredClone(components), structuredClone(scores), structuredClone(results)] as const; try { return await operation(tx as unknown as NilaiTransaction); } catch (error) { components.splice(0, components.length, ...snapshots[0]); scores.splice(0, scores.length, ...snapshots[1]); results.splice(0, results.length, ...snapshots[2]); throw error; } } };
  const service = createNilaiService(repository);
  const addComponents = async () => [await service.createComponent(admin, kelas.id, { nama: 'Tugas', bobot: '40', urutan: 1 }), await service.createComponent(admin, kelas.id, { nama: 'Ujian', bobot: '60', urutan: 2 })];
  return { admin, academic, lecturerUser, foreignLecturer, studentUser, kelas, students, components, scores, results, service, addComponents, setEffective: (rows: typeof students) => { effective = rows; }, setAssigned: (value: boolean) => { assigned = value; }, setNoCoordinator: () => { coordinatorId = undefined; }, setForeignCoordinator: () => { coordinatorId = uuid(); }, failCorrection: () => { failResultUpdate = true; }, deactivateActor: () => { activeActor = false; } };
}

test('exact grading policy rounds once and maps development bands', () => {
  expect(weightedFinal([{ nilai: '79.99', bobot: '33.33' }, { nilai: '80.00', bobot: '66.67' }])).toBe('80.00');
});

test('components list/create/update/deactivate/delete obey validation and safe history', async () => {
  const f = fixture(); const component = await f.service.createComponent(f.admin, f.kelas.id, { nama: ' Tugas ', bobot: '40', urutan: 1 });
  expect(component.nama).toBe('Tugas'); expect((await f.service.listComponents(f.admin, f.kelas.id)).summary.activeWeight).toBe('40.00');
  await expect(f.service.createComponent(f.admin, f.kelas.id, { nama: 'tugas', bobot: '20', urutan: 2 })).rejects.toThrow('sudah digunakan');
  await expect(f.service.createComponent(f.admin, f.kelas.id, { nama: 'Buruk', bobot: '0', urutan: 2 })).rejects.toThrow('rentang');
  await f.service.updateComponent(f.academic, f.kelas.id, component.id, { is_active: false, bobot: '30.50' }); expect(f.components[0]!.isActive).toBe(false);
  await f.service.deleteComponent(f.admin, f.kelas.id, component.id); expect(f.components).toHaveLength(0);
});

test('assigned active lecturer may grade; foreign lecturer and mahasiswa are rejected', async () => {
  const f = fixture(); expect((await f.service.createComponent(f.lecturerUser, f.kelas.id, { nama: 'Quiz', bobot: '100', urutan: 1 })).nama).toBe('Quiz');
  await expect(f.service.listComponents(f.foreignLecturer, f.kelas.id)).rejects.toThrow('ditugaskan');
  await expect(f.service.listComponents(f.studentUser, f.kelas.id)).rejects.toThrow('akses');
  f.deactivateActor(); await expect(f.service.listComponents(f.admin, f.kelas.id)).rejects.toThrow('izin');
});

test('roster uses effective students and missing remains distinct from numeric zero', async () => {
  const f = fixture(); const [component] = await f.addComponents(); f.setEffective([f.students[0]!]);
  let roster = await f.service.roster(f.admin, f.kelas.id); expect(roster.data).toHaveLength(1); expect(roster.data[0]!.scores[0]!.nilai).toBeNull();
  await f.service.record(f.lecturerUser, f.kelas.id, f.students[0]!.id, component!.id, { nilai: '0' });
  roster = await f.service.roster(f.admin, f.kelas.id); expect(roster.data[0]!.scores[0]!.nilai).toBe('0.00');
  const row = f.scores[0]!; const createdAt = row.createdAt; await f.service.record(f.admin, f.kelas.id, f.students[0]!.id, component!.id, { nilai: null });
  expect(row.id).toBe(f.scores[0]!.id); expect(row.createdAt).toBe(createdAt); expect(row.nilai).toBeNull();
  await expect(f.service.record(f.admin, f.kelas.id, f.students[0]!.id, component!.id, { nilai: '101' })).rejects.toThrow('rentang');
});

test('component with retained score cannot be removed and historical score is excluded', async () => {
  const f = fixture(); const [component] = await f.addComponents(); await f.service.record(f.admin, f.kelas.id, f.students[0]!.id, component!.id, { nilai: '70' });
  await expect(f.service.deleteComponent(f.admin, f.kelas.id, component!.id)).rejects.toThrow('nonaktifkan');
  f.setEffective([f.students[1]!]); expect((await f.service.roster(f.admin, f.kelas.id)).historicalScores).toHaveLength(1);
});

test('finalization rejects bad weight and missing values without partial results', async () => {
  const f = fixture(); const one = await f.service.createComponent(f.admin, f.kelas.id, { nama: 'Tugas', bobot: '90', urutan: 1 });
  await expect(f.service.finalize(f.admin, f.kelas.id)).rejects.toThrow('100.00'); expect(f.results).toHaveLength(0);
  await f.service.updateComponent(f.admin, f.kelas.id, one.id, { bobot: '100' }); await f.service.record(f.admin, f.kelas.id, f.students[0]!.id, one.id, { nilai: '80' });
  await expect(f.service.finalize(f.admin, f.kelas.id)).rejects.toThrow('002'); expect(f.results).toHaveLength(0);
});

test('atomic finalization calculates snapshots once and freezes ordinary changes', async () => {
  const f = fixture(); const [task, exam] = await f.addComponents();
  for (const student of f.students) { await f.service.record(f.lecturerUser, f.kelas.id, student.id, task!.id, { nilai: student.nim === '001' ? '80' : '0' }); await f.service.record(f.lecturerUser, f.kelas.id, student.id, exam!.id, { nilai: '90' }); }
  const finalized = await f.service.finalize(f.lecturerUser, f.kelas.id); expect(finalized.data).toHaveLength(2); expect(new Set(finalized.data.map(row => row.difinalisasiAt.valueOf())).size).toBe(1);
  expect(f.results[0]!.nilaiAngka).toBe('86.00'); expect(f.results[0]!.nilaiHuruf).toBe('A'); expect(f.results[1]!.nilaiAngka).toBe('54.00'); expect(f.results[1]!.nilaiHuruf).toBe('D');
  await expect(f.service.finalize(f.admin, f.kelas.id)).rejects.toThrow('sudah difinalisasi');
  await expect(f.service.updateComponent(f.admin, f.kelas.id, task!.id, { bobot: '50' })).rejects.toThrow('dibekukan');
  await expect(f.service.record(f.lecturerUser, f.kelas.id, f.students[0]!.id, task!.id, { nilai: '100' })).rejects.toThrow('dibekukan');
});

test('only coordinator lecturer finalizes when configured', async () => {
  const f = fixture(); const component = await f.service.createComponent(f.admin, f.kelas.id, { nama: 'Final', bobot: '100', urutan: 1 }); for (const student of f.students) await f.service.record(f.admin, f.kelas.id, student.id, component.id, { nilai: '80' });
  f.setForeignCoordinator(); await expect(f.service.finalize(f.lecturerUser, f.kelas.id)).rejects.toThrow('koordinator');
  f.setNoCoordinator(); expect((await f.service.finalize(f.lecturerUser, f.kelas.id)).data).toHaveLength(2);
});

test('failed correction rolls back both source score and result snapshot', async () => {
  const f = fixture(); const component = await f.service.createComponent(f.admin, f.kelas.id, { nama: 'Final', bobot: '100', urutan: 1 }); for (const student of f.students) await f.service.record(f.admin, f.kelas.id, student.id, component.id, { nilai: '80' }); await f.service.finalize(f.admin, f.kelas.id);
  const beforeScore = f.scores[0]!.nilai; const beforeResult = f.results[0]!.nilaiAngka; f.failCorrection();
  await expect(f.service.correct(f.academic, f.kelas.id, f.students[0]!.id, { component_id: component.id, nilai: '95', alasan: 'Koreksi gagal simulasi' })).rejects.toThrow('simulated');
  expect(f.scores[0]!.nilai).toBe(beforeScore); expect(f.results[0]!.nilaiAngka).toBe(beforeResult); expect(f.results[0]!.dikoreksiAt).toBeNull();
});

test('controlled correction requires manager/reason and preserves original finalization metadata', async () => {
  const f = fixture(); const component = await f.service.createComponent(f.admin, f.kelas.id, { nama: 'Final', bobot: '100', urutan: 1 }); for (const student of f.students) await f.service.record(f.admin, f.kelas.id, student.id, component.id, { nilai: '80' }); await f.service.finalize(f.admin, f.kelas.id);
  const before = { ...f.results[0]! };
  await expect(f.service.correct(f.lecturerUser, f.kelas.id, f.students[0]!.id, { component_id: component.id, nilai: '90', alasan: 'Valid' })).rejects.toThrow('akses');
  await expect(f.service.correct(f.academic, f.kelas.id, f.students[0]!.id, { component_id: component.id, nilai: '90', alasan: '   ' })).rejects.toThrow('wajib');
  const corrected = await f.service.correct(f.academic, f.kelas.id, f.students[0]!.id, { component_id: component.id, nilai: '90', alasan: 'Verifikasi dokumen ujian' });
  expect(corrected.id).toBe(before.id); expect(corrected.createdAt).toEqual(before.createdAt); expect(corrected.difinalisasiAt).toEqual(before.difinalisasiAt); expect(corrected.difinalisasiOleh).toBe(before.difinalisasiOleh); expect(corrected.nilaiAngka).toBe('90.00'); expect(corrected.dikoreksiOleh).toBe(f.academic.id);
});

test('grading API enforces authentication, origin, and student mutation denial', async () => {
  const f = fixture(); let current: AuthUser | null = f.admin;
  const auth: AuthService = { current: async () => current, login: async () => { throw new Error('unused'); }, logout: () => {} };
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', production: false }, { nilai: f.service });
  const request = (path: string, method = 'GET', body?: object, origin = 'http://localhost:5173') => app.handle(new Request('http://localhost' + path, { method, headers: { origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  expect((await request(`/kelas-kuliah/${f.kelas.id}/komponen-nilai`)).status).toBe(200);
  expect((await request(`/kelas-kuliah/${f.kelas.id}/komponen-nilai`, 'POST', { nama: 'X', bobot: '100', urutan: 1 }, 'http://evil.test')).status).toBe(403);
  current = f.studentUser; expect((await request(`/kelas-kuliah/${f.kelas.id}/komponen-nilai`, 'POST', { nama: 'X', bobot: '100', urutan: 1 })).status).toBe(403);
  current = null; expect((await request(`/kelas-kuliah/${f.kelas.id}/nilai`)).status).toBe(401);
});
