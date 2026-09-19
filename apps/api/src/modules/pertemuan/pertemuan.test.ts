import { expect, test } from 'bun:test';
import type { absensi, kelasKuliah, pertemuan, semester } from '@kampusia/db/schema';
import type { AuthUser } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { createApp } from '../../app';
import { createPertemuanService } from './pertemuan.service';
import type { PertemuanRepository, PertemuanTransaction } from './pertemuan.repository';

const uuid = () => crypto.randomUUID();
const common = () => ({ id: uuid(), createdAt: new Date(), updatedAt: new Date() });
function fixture() {
  const admin: AuthUser = { id: uuid(), loginId: '9002', email: 'admin@test.local', role: 'AKADEMIK' };
  const otherAdmin: AuthUser = { id: uuid(), loginId: '9001', email: 'admin2@test.local', role: 'ADMIN' };
  const lecturerUser: AuthUser = { id: uuid(), loginId: '9003', email: 'dosen@test.local', role: 'DOSEN' };
  const foreignLecturer: AuthUser = { id: uuid(), loginId: '9004', email: 'other@test.local', role: 'DOSEN' };
  const studentUser: AuthUser = { id: uuid(), loginId: '1001', email: 'student@test.local', role: 'MAHASISWA' };
  const users = [admin, otherAdmin, lecturerUser, foreignLecturer, studentUser];
  const term: typeof semester.$inferSelect = { ...common(), kode: '20261', nama: 'Ganjil 2026', tahunMulai: 2026, jenis: 'GANJIL', tanggalMulai: '2026-08-24', tanggalSelesai: '2027-01-15', krsMulaiAt: null, krsSelesaiAt: null, isActive: true };
  const kelas: typeof kelasKuliah.$inferSelect = { ...common(), semesterId: term.id, mataKuliahId: uuid(), programStudiId: uuid(), namaKelas: 'A', kapasitas: 30, status: 'DIBUKA' };
  const course = { id: kelas.mataKuliahId, kode: 'IF101', nama: 'Basis Data', sks: 3 };
  const program = { id: kelas.programStudiId, kode: 'IF', nama: 'Informatika' };
  const lecturer = { id: uuid(), isActive: true };
  const students = [{ id: uuid(), nim: '001', nama: 'Ani', krsId: uuid(), detailId: uuid() }, { id: uuid(), nim: '002', nama: 'Budi', krsId: uuid(), detailId: uuid() }];
  const meetings: (typeof pertemuan.$inferSelect)[] = [];
  const attendance: (typeof absensi.$inferSelect)[] = [];
  let effective = [...students]; let assigned = true; let inactive = false;
  const classDetail = { ...kelas, semester: term, mataKuliah: course, programStudi: program };
  const tx = {
    actor: async (id: string) => { const user = users.find(row => row.id === id); return user ? { id, role: user.role, isActive: !inactive } : undefined; },
    lecturer: async (id: string) => id === lecturerUser.id ? lecturer : id === foreignLecturer.id ? { id: uuid(), isActive: true } : undefined,
    student: async (id: string) => id === studentUser.id ? { id: students[0]!.id } : undefined,
    assigned: async (_classId: string, lecturerId: string) => assigned && lecturerId === lecturer.id,
    classInfo: async (id: string) => id === kelas.id ? classDetail : undefined,
    lockClass: async (id: string) => id === kelas.id ? kelas : undefined,
    term: async (id: string) => id === term.id ? term : undefined,
    peekMeeting: async (id: string) => meetings.find(row => row.id === id),
    lockMeeting: async (id: string) => meetings.find(row => row.id === id),
    meetingDetail: async (id: string) => { const row = meetings.find(row => row.id === id); return row ? { ...row, kelas: classDetail, jumlahAbsensi: attendance.filter(item => item.pertemuanId === id).length } : undefined; },
    listMeetings: async (id: string) => ({ data: meetings.filter(row => row.kelasKuliahId === id), meta: { page: 1, limit: 20, total: meetings.length } }),
    listLecturerClasses: async () => ({ data: [classDetail], meta: { page: 1, limit: 20, total: 1 } }),
    createMeeting: async (input: typeof pertemuan.$inferInsert) => {
      if (meetings.some(row => row.kelasKuliahId === input.kelasKuliahId && row.nomorPertemuan === input.nomorPertemuan)) throw { cause: { code: '23505', constraint_name: 'pertemuan_kelas_kuliah_id_nomor_pertemuan_unique' } };
      const row: typeof pertemuan.$inferSelect = { ...common(), kelasKuliahId: input.kelasKuliahId, nomorPertemuan: input.nomorPertemuan, tanggal: input.tanggal, jamMulai: input.jamMulai, jamSelesai: input.jamSelesai, materi: input.materi ?? null, status: 'TERJADWAL' };
      meetings.push(row); return row;
    },
    updateMeeting: async (id: string, changes: Partial<typeof pertemuan.$inferInsert>) => Object.assign(meetings.find(row => row.id === id)!, changes, { updatedAt: new Date() }),
    attendanceCount: async (id: string) => attendance.filter(row => row.pertemuanId === id).length,
    relatedPlanIds: async () => effective.map(row => row.krsId), lockPlans: async () => {},
    effectiveRoster: async () => effective,
    lockAttendance: async (id: string) => attendance.filter(row => row.pertemuanId === id),
    attendanceRows: async (id: string) => attendance.filter(row => row.pertemuanId === id).map(row => ({ ...row, mahasiswa: students.find(student => student.id === row.mahasiswaId) ?? { id: row.mahasiswaId, nim: 'HIST', nama: 'Historis' } })),
    insertAttendance: async (meetingId: string, studentId: string, input: Pick<typeof absensi.$inferInsert, 'status' | 'keterangan'>, actorId: string) => { const row: typeof absensi.$inferSelect = { ...common(), pertemuanId: meetingId, mahasiswaId: studentId, status: input.status, keterangan: input.keterangan ?? null, dicatatOleh: actorId, diubahOleh: actorId }; attendance.push(row); return row; },
    updateAttendance: async (id: string, input: Partial<Pick<typeof absensi.$inferInsert, 'status' | 'keterangan'>>, actorId: string) => Object.assign(attendance.find(row => row.id === id)!, input, { diubahOleh: actorId, updatedAt: new Date() }),
    studentHistory: async (id: string) => ({ data: attendance.filter(row => row.mahasiswaId === id).map(row => ({ ...row, pertemuan: meetings.find(item => item.id === row.pertemuanId)!, kelas: { id: kelas.id, namaKelas: kelas.namaKelas }, mataKuliah: course, semester: { id: term.id, kode: term.kode, nama: term.nama } })), meta: { page: 1, limit: 20, total: attendance.filter(row => row.mahasiswaId === id).length } }),
  };
  const repository = { transaction: <T>(operation: (value: PertemuanTransaction) => Promise<T>) => operation(tx as unknown as PertemuanTransaction) } satisfies PertemuanRepository;
  const service = createPertemuanService(repository);
  const create = (number = 1) => service.create(admin, kelas.id, { nomor_pertemuan: number, tanggal: '2026-09-14', jam_mulai: '08:00', jam_selesai: '10:00', materi: 'Normalisasi' });
  return { admin, otherAdmin, lecturerUser, foreignLecturer, studentUser, term, kelas, students, meetings, attendance, service, create,
    setEffective: (rows: typeof students) => { effective = rows; }, setAssigned: (value: boolean) => { assigned = value; }, deactivate: () => { inactive = true; } };
}

test('Pertemuan lists, creates, reads and rejects duplicate number or dates outside semester', async () => {
  const f = fixture(); const row = await f.create(); expect((await f.service.list(f.admin, f.kelas.id, {})).data[0]!.id).toBe(row.id); expect((await f.service.get(f.admin, row.id)).kelas.mataKuliah.kode).toBe('IF101');
  await expect(f.create()).rejects.toThrow('Nomor pertemuan sudah digunakan');
  await expect(f.service.create(f.admin, f.kelas.id, { nomor_pertemuan: 2, tanggal: '2027-02-01', jam_mulai: '08:00', jam_selesai: '10:00' })).rejects.toThrow('rentang semester');
  await expect(f.service.create(f.admin, f.kelas.id, { nomor_pertemuan: 2, tanggal: '2026-09-14', jam_mulai: '10:00', jam_selesai: '08:00' })).rejects.toThrow('lebih awal');
});

test('Pertemuan lifecycle retains cancellation and restricts completed changes', async () => {
  const f = fixture(); const cancelled = await f.create(); await f.service.cancel(f.admin, cancelled.id); expect(cancelled.status).toBe('DIBATALKAN');
  await expect(f.service.update(f.admin, cancelled.id, { materi: 'ubah' })).rejects.toThrow('final');
  const completed = await f.create(2); f.setEffective([]); await f.service.complete(f.admin, completed.id); expect(completed.status).toBe('SELESAI');
  await expect(f.service.update(f.admin, completed.id, { materi: 'koreksi' })).rejects.toThrow('eksplisit');
  await expect(f.service.update(f.admin, completed.id, { nomor_pertemuan: 3, koreksi: true })).rejects.toThrow('Nomor');
  await f.service.update(f.admin, completed.id, { materi: 'Fakta terkoreksi', koreksi: true }); expect(completed.materi).toBe('Fakta terkoreksi');
});

test('assigned Dosen and ADMIN/AKADEMIK are allowed while foreign Dosen and Mahasiswa are rejected', async () => {
  const f = fixture(); const row = await f.create();
  expect((await f.service.get(f.lecturerUser, row.id)).id).toBe(row.id); expect((await f.service.get(f.otherAdmin, row.id)).id).toBe(row.id);
  await expect(f.service.get(f.foreignLecturer, row.id)).rejects.toThrow('ditugaskan');
  await expect(f.service.cancel(f.studentUser, row.id)).rejects.toThrow('akses');
  f.deactivate(); await expect(f.service.get(f.admin, row.id)).rejects.toThrow('izin');
});

test('effective roster is lazy: missing rows are BELUM_DICATAT and never inferred as ALPHA', async () => {
  const f = fixture(); const row = await f.create(); const roster = await f.service.roster(f.admin, row.id);
  expect(roster.data).toHaveLength(2); expect(roster.data.every(item => item.absensi === null && item.recordingState === 'BELUM_DICATAT')).toBe(true); expect(f.attendance).toHaveLength(0);
  await expect(f.service.complete(f.admin, row.id)).rejects.toThrow('2 mahasiswa'); expect(row.status).toBe('TERJADWAL'); expect(f.attendance).toHaveLength(0);
});

for (const status of ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as const) test(`attendance records explicit ${status} without duplicates`, async () => {
  const f = fixture(); const meeting = await f.create(); const first = await f.service.record(f.lecturerUser, meeting.id, f.students[0]!.id, { status });
  const createdAt = first.createdAt; const id = first.id; const updated = await f.service.record(f.lecturerUser, meeting.id, f.students[0]!.id, { status, keterangan: 'dicatat ulang' });
  expect(updated.id).toBe(id); expect(updated.createdAt).toBe(createdAt); expect(f.attendance).toHaveLength(1);
});

test('attendance correction updates the same row, preserves first actor, and tracks latest actor', async () => {
  const f = fixture(); const meeting = await f.create(); const row = await f.service.record(f.lecturerUser, meeting.id, f.students[0]!.id, { status: 'HADIR' }); const createdAt = row.createdAt;
  await f.service.correct(f.otherAdmin, meeting.id, f.students[0]!.id, { status: 'IZIN', keterangan: 'Surat izin diterima' });
  expect(row.status).toBe('IZIN'); expect(row.id).toBe(f.attendance[0]!.id); expect(row.createdAt).toBe(createdAt); expect(row.dicatatOleh).toBe(f.lecturerUser.id); expect(row.diubahOleh).toBe(f.otherAdmin.id);
});

test('completion requires every current effective student and retains former enrollment history', async () => {
  const f = fixture(); const meeting = await f.create();
  await f.service.record(f.admin, meeting.id, f.students[0]!.id, { status: 'HADIR' });
  await expect(f.service.cancel(f.admin, meeting.id)).rejects.toThrow('dengan absensi');
  await expect(f.service.complete(f.admin, meeting.id)).rejects.toThrow('1 mahasiswa');
  await f.service.record(f.admin, meeting.id, f.students[1]!.id, { status: 'ALPHA' }); await f.service.complete(f.admin, meeting.id); expect(meeting.status).toBe('SELESAI');
  f.setEffective([f.students[0]!]); const roster = await f.service.roster(f.admin, meeting.id); expect(roster.data).toHaveLength(1); expect(roster.historical).toHaveLength(1); expect(f.attendance).toHaveLength(2);
  await expect(f.service.cancel(f.admin, meeting.id)).rejects.toThrow('TERJADWAL');
});

test('student history is scoped to the authenticated profile and API enforces CSRF and mutation roles', async () => {
  const f = fixture(); const meeting = await f.create(); await f.service.record(f.admin, meeting.id, f.students[0]!.id, { status: 'SAKIT' });
  expect((await f.service.studentHistory(f.studentUser, {})).data).toHaveLength(1);
  let current: AuthUser | null = f.studentUser;
  const auth: AuthService = { current: async () => current, login: async () => { throw new Error('unused'); }, logout: () => {} };
  const app = createApp(auth, { webOrigin: 'http://localhost:5173', production: false }, { pertemuan: f.service });
  const request = (path: string, method = 'GET', body?: object, origin = 'http://localhost:5173') => app.handle(new Request('http://localhost' + path, { method, headers: { origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  expect((await request('/mahasiswa/me/absensi')).status).toBe(200);
  expect((await request(`/pertemuan/${meeting.id}/absensi/${f.students[0]!.id}`, 'PUT', { status: 'HADIR' })).status).toBe(403);
  current = f.admin; expect((await request(`/pertemuan/${meeting.id}/absensi/${f.students[0]!.id}`, 'PUT', { status: 'HADIR' }, 'http://evil.test')).status).toBe(403);
  current = null; expect((await request('/mahasiswa/me/absensi')).status).toBe(401);
});
