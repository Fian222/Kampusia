import { expect, test } from 'bun:test';
import type { AuthUser } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { createApp } from '../../app';
import { calculateAcademicIndex } from './academic-result';
import type { HasilStudiReader, HasilStudiRepository } from './hasil-studi.repository';
import { createHasilStudiService } from './hasil-studi.service';

const uuid = () => crypto.randomUUID();

function fixture() {
  const admin: AuthUser = { id: uuid(), email: 'admin@test.local', role: 'ADMIN' };
  const academic: AuthUser = { id: uuid(), email: 'akademik@test.local', role: 'AKADEMIK' };
  const lecturer: AuthUser = { id: uuid(), email: 'dosen@test.local', role: 'DOSEN' };
  const studentUser: AuthUser = { id: uuid(), email: 'student@test.local', role: 'MAHASISWA' };
  const otherUser: AuthUser = { id: uuid(), email: 'other@test.local', role: 'MAHASISWA' };
  const users = [admin, academic, lecturer, studentUser, otherUser];
  const program = { id: uuid(), kode: 'IF', nama: 'Informatika' };
  const students = [
    { id: uuid(), userId: studentUser.id, nim: '001', nama: 'Ani', angkatan: 2026, status: 'AKTIF' as const, programStudi: program },
    { id: uuid(), userId: otherUser.id, nim: '002', nama: 'Budi', angkatan: 2026, status: 'AKTIF' as const, programStudi: program },
  ];
  const terms = [
    { id: uuid(), kode: '20261', nama: 'Ganjil 2026/2027', tahunMulai: 2026, jenis: 'GANJIL' as const, tanggalMulai: '2026-08-01', tanggalSelesai: '2026-12-20', isActive: false, createdAt: new Date(), updatedAt: new Date() },
    { id: uuid(), kode: '20262', nama: 'Genap 2026/2027', tahunMulai: 2026, jenis: 'GENAP' as const, tanggalMulai: '2027-01-10', tanggalSelesai: '2027-06-20', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const result = (studentId: string, term: typeof terms[number], kode: string, sks: number, index: string, letter = 'A') => ({
    id: uuid(), mahasiswaId: studentId, nilaiAngka: '90.00', nilaiHuruf: letter, nilaiIndeks: index,
    difinalisasiAt: new Date('2026-12-21T00:00:00Z'), dikoreksiAt: null,
    kelas: { id: uuid(), namaKelas: 'A' }, mataKuliah: { id: kode, kode, nama: `Mata Kuliah ${kode}`, sks },
    semester: { id: term.id, kode: term.kode, nama: term.nama, tahunMulai: term.tahunMulai, jenis: term.jenis },
  });
  const results = [
    result(students[0]!.id, terms[0]!, 'IF101', 3, '3.70', 'A'),
    result(students[0]!.id, terms[0]!, 'IF102', 2, '0.00', 'E'),
    result(students[0]!.id, terms[1]!, 'IF101', 3, '4.00'),
    result(students[1]!.id, terms[0]!, 'IF101', 3, '2.00', 'C'),
  ];
  let active = true;
  const unfinished = new Map([[`${students[0]!.id}:${terms[0]!.id}`, 1]]);
  const tx = {
    actor: async (id: string) => { const user = users.find(item => item.id === id); return user ? { id, role: user.role, isActive: active } : undefined; },
    studentByUser: async (id: string) => students.find(item => item.userId === id),
    studentById: async (id: string) => students.find(item => item.id === id),
    term: async (id: string) => terms.find(item => item.id === id),
    results: async (studentId: string, semesterId?: string) => results.filter(item => item.mahasiswaId === studentId && (!semesterId || item.semester.id === semesterId)).sort((a, b) => b.semester.kode.localeCompare(a.semester.kode) || a.mataKuliah.kode.localeCompare(b.mataKuliah.kode)),
    unfinishedCount: async (studentId: string, semesterId: string) => unfinished.get(`${studentId}:${semesterId}`) ?? 0,
  };
  const repository: HasilStudiRepository = { read: operation => operation(tx as unknown as HasilStudiReader) };
  return { admin, academic, lecturer, studentUser, otherUser, students, terms, results, service: createHasilStudiService(repository), deactivate: () => { active = false; } };
}

test('academic index uses exact weighted decimal arithmetic and deterministic half-up display rounding', () => {
  expect(calculateAcademicIndex([{ sks: 3, nilaiIndeks: '3.70' }])).toEqual({ totalSks: 3, totalWeightedGradePoints: '11.10', index: '3.70' });
  expect(calculateAcademicIndex([{ sks: 1, nilaiIndeks: '3.33' }, { sks: 1, nilaiIndeks: '3.34' }])).toEqual({ totalSks: 2, totalWeightedGradePoints: '6.67', index: '3.34' });
  expect(calculateAcademicIndex([])).toEqual({ totalSks: 0, totalWeightedGradePoints: '0.00', index: null });
});

test('KHS filters one semester, includes zero-index SKS, and marks unfinished approved courses provisional', async () => {
  const f = fixture();
  const khs = await f.service.ownKhs(f.studentUser, f.terms[0]!.id);
  expect(khs.mahasiswa.id).toBe(f.students[0]!.id);
  expect(khs.courses.map(row => row.mataKuliah.kode)).toEqual(['IF101', 'IF102']);
  expect(khs.summary).toEqual({ totalSks: 5, totalBobot: '11.10', ips: '2.22', jumlahHasil: 2, unfinishedCourseCount: 1, provisional: true });
  expect(khs.courses.find(row => row.nilaiIndeks === '0.00')?.mataKuliah.sks).toBe(2);
});

test('IPK counts all finalized attempts across semesters and uses stored indexes', async () => {
  const f = fixture();
  // IF101 is repeated. The stored 3.70 index is authoritative even though the stored A letter currently maps to 4.00.
  const ipk = await f.service.ownIpk(f.studentUser);
  expect(ipk).toMatchObject({ totalSksKumulatif: 8, totalBobotKumulatif: '23.10', ipk: '2.89', jumlahSemester: 2, jumlahHasil: 3, hasRepeatedCourses: true });
  expect(ipk.policy.repeatedCourses).toBe('COUNT_ALL_FINALIZED_ATTEMPTS');
});

test('summary lists only semesters with finalized results and keeps finalized history independent of KRS state', async () => {
  const f = fixture();
  const summary = await f.service.ownSummary(f.studentUser);
  expect(summary.semesters.map(item => item.semester.kode)).toEqual(['20262', '20261']);
  expect(summary.semesters[0]!.ips).toBe('4.00');
  expect(summary.semesters[1]!.provisional).toBe(true);
  // The repository result set remains authoritative even when an effective enrollment is absent later.
  expect(summary.cumulative.jumlahHasil).toBe(3);
});

test('ADMIN and AKADEMIK can read a student; students and DOSEN cannot use managed access', async () => {
  const f = fixture();
  expect((await f.service.studentKhs(f.admin, f.students[0]!.id, f.terms[0]!.id)).mahasiswa.id).toBe(f.students[0]!.id);
  expect((await f.service.studentIpk(f.academic, f.students[0]!.id)).ipk).toBe('2.89');
  await expect(f.service.studentIpk(f.studentUser, f.students[1]!.id)).rejects.toThrow('akses');
  await expect(f.service.studentIpk(f.lecturer, f.students[0]!.id)).rejects.toThrow('akses');
  f.deactivate();
  await expect(f.service.studentIpk(f.admin, f.students[0]!.id)).rejects.toThrow('izin');
});

test('academic-result API enforces own scope and manager roles without granting DOSEN access', async () => {
  const f = fixture(); let current: AuthUser | null = f.studentUser;
  const auth: AuthService = { current: async () => current, login: async () => { throw new Error('unused'); }, logout: () => {} };
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', production: false }, { hasilStudi: f.service });
  const request = (path: string) => app.handle(new Request(`http://localhost${path}`));

  let response = await request(`/mahasiswa/me/khs/${f.terms[0]!.id}`);
  expect(response.status).toBe(200);
  const body = await response.json() as { data: { mahasiswa: { id: string } } };
  expect(body.data.mahasiswa.id).toBe(f.students[0]!.id);
  expect((await request(`/mahasiswa/${f.students[1]!.id}/ipk`)).status).toBe(403);
  current = f.admin;
  expect((await request(`/mahasiswa/${f.students[1]!.id}/khs/${f.terms[0]!.id}`)).status).toBe(200);
  current = f.academic;
  expect((await request(`/mahasiswa/${f.students[0]!.id}/hasil-studi`)).status).toBe(200);
  current = f.lecturer;
  expect((await request(`/mahasiswa/${f.students[0]!.id}/ipk`)).status).toBe(403);
  current = null;
  expect((await request('/mahasiswa/me/ipk')).status).toBe(401);
});
