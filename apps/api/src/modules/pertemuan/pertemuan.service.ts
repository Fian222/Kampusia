import { requireRole } from '../../middleware/authorization';
import { academicWrite } from '../../utils/academic-write';
import { MasterDataError, requirePatch, type ListQuery } from '../../utils/master-data';
import { AuthError, type AuthUser } from '../auth/auth.model';
import type { AbsensiInput, AbsensiPatch, DosenKelasQuery, PertemuanInput, PertemuanPatch } from './pertemuan.model';
import type { PertemuanRepository, PertemuanTransaction } from './pertemuan.repository';

const managers = ['ADMIN', 'AKADEMIK'] as const;
type Meeting = NonNullable<Awaited<ReturnType<PertemuanTransaction['lockMeeting']>>>;

function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new MasterDataError(400, 'Tanggal pertemuan tidak valid.');
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new MasterDataError(400, 'Tanggal pertemuan tidak valid.');
  return value;
}

function time(value: string, label: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) throw new MasterDataError(400, `${label} tidak valid.`);
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}${match[4] ? '.' + match[4] : ''}`;
}

function note(value: string | null | undefined, label: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) throw new MasterDataError(400, `${label} tidak boleh kosong; gunakan null bila tidak ada.`);
  return normalized;
}

function meetingChanges(input: PertemuanPatch) {
  return {
    ...(input.nomor_pertemuan !== undefined ? { nomorPertemuan: input.nomor_pertemuan } : {}),
    ...(input.tanggal !== undefined ? { tanggal: date(input.tanggal) } : {}),
    ...(input.jam_mulai !== undefined ? { jamMulai: time(input.jam_mulai, 'Jam mulai') } : {}),
    ...(input.jam_selesai !== undefined ? { jamSelesai: time(input.jam_selesai, 'Jam selesai') } : {}),
    ...(input.materi !== undefined ? { materi: note(input.materi, 'Materi') } : {}),
  };
}

function validateMeeting(row: { nomorPertemuan: number; tanggal: string; jamMulai: string; jamSelesai: string }, term: { tanggalMulai: string; tanggalSelesai: string }) {
  if (!Number.isInteger(row.nomorPertemuan) || row.nomorPertemuan < 1 || row.nomorPertemuan > 32767) throw new MasterDataError(400, 'Nomor pertemuan harus bilangan bulat positif.');
  if (row.jamMulai >= row.jamSelesai) throw new MasterDataError(400, 'Jam mulai harus lebih awal daripada jam selesai.');
  if (row.tanggal < term.tanggalMulai || row.tanggal > term.tanggalSelesai) throw new MasterDataError(400, `Tanggal pertemuan harus berada dalam rentang semester ${term.tanggalMulai} sampai ${term.tanggalSelesai}.`);
}

export function createPertemuanService(repository: PertemuanRepository) {
  const run = <T>(operation: (tx: PertemuanTransaction) => Promise<T>) => academicWrite(() => repository.transaction(operation));

  async function actor(tx: PertemuanTransaction, user: AuthUser) {
    const current = await tx.actor(user.id);
    if (!current?.isActive || current.role !== user.role) throw new AuthError(403, 'Akun tidak memiliki izin mengelola pertemuan dan absensi.');
    return current;
  }

  async function classAccess(tx: PertemuanTransaction, user: AuthUser, classId: string) {
    await actor(tx, user);
    if ((managers as readonly string[]).includes(user.role)) return;
    requireRole(user, ['DOSEN']);
    const lecturer = await tx.lecturer(user.id);
    if (!lecturer || !await tx.assigned(classId, lecturer.id)) throw new AuthError(403, 'Dosen hanya dapat mengelola kelas yang ditugaskan kepadanya.');
  }

  async function attendanceContext(tx: PertemuanTransaction, user: AuthUser, id: string) {
    const peek = await tx.peekMeeting(id);
    if (!peek) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
    const planIds = await tx.relatedPlanIds(peek.kelasKuliahId);
    await tx.lockPlans(planIds);
    const kelas = await tx.lockClass(peek.kelasKuliahId);
    if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
    const meeting = await tx.lockMeeting(id);
    if (!meeting || meeting.kelasKuliahId !== kelas.id) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
    await classAccess(tx, user, kelas.id);
    const roster = await tx.effectiveRoster(kelas.id);
    const attendance = await tx.lockAttendance(meeting.id);
    return { kelas, meeting, roster, attendance };
  }

  async function lockedMeeting(tx: PertemuanTransaction, user: AuthUser, id: string) {
    const peek = await tx.peekMeeting(id);
    if (!peek) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
    const kelas = await tx.lockClass(peek.kelasKuliahId);
    if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
    const meeting = await tx.lockMeeting(id);
    if (!meeting) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
    await classAccess(tx, user, kelas.id);
    return { kelas, meeting };
  }

  function attendanceWrite(input: AbsensiInput | AbsensiPatch) {
    requirePatch(input);
    return {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.keterangan !== undefined ? { keterangan: note(input.keterangan, 'Keterangan') } : {}),
    };
  }

  return {
    list(user: AuthUser, classId: string, query: ListQuery) {
      return run(async tx => {
        const kelas = await tx.classInfo(classId);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        await classAccess(tx, user, classId);
        return { ...await tx.listMeetings(classId, query), kelas };
      });
    },
    get(user: AuthUser, id: string) {
      return run(async tx => {
        const row = await tx.meetingDetail(id);
        if (!row) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
        await classAccess(tx, user, row.kelasKuliahId);
        return row;
      });
    },
    create(user: AuthUser, classId: string, input: PertemuanInput) {
      return run(async tx => {
        const kelas = await tx.lockClass(classId);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        await classAccess(tx, user, classId);
        if (!['DIBUKA', 'DITUTUP'].includes(kelas.status)) throw new MasterDataError(409, 'Pertemuan hanya dapat dibuat untuk kelas DIBUKA atau DITUTUP.');
        const term = await tx.term(kelas.semesterId);
        if (!term) throw new MasterDataError(404, 'Semester kelas tidak ditemukan.');
        const row = { kelasKuliahId: classId, nomorPertemuan: input.nomor_pertemuan, tanggal: date(input.tanggal), jamMulai: time(input.jam_mulai, 'Jam mulai'), jamSelesai: time(input.jam_selesai, 'Jam selesai'), materi: note(input.materi, 'Materi') ?? null };
        validateMeeting(row, term);
        return tx.createMeeting(row);
      });
    },
    update(user: AuthUser, id: string, input: PertemuanPatch) {
      return run(async tx => {
        const { kelas, meeting } = await lockedMeeting(tx, user, id);
        requirePatch(input);
        const changes = meetingChanges(input);
        if (!Object.keys(changes).length) throw new MasterDataError(400, 'Kirim setidaknya satu perubahan data pertemuan.');
        if (meeting.status === 'DIBATALKAN') throw new MasterDataError(409, 'Pertemuan yang dibatalkan bersifat final.');
        if (meeting.status === 'SELESAI' && !input.koreksi) throw new MasterDataError(409, 'Pertemuan selesai hanya dapat diubah melalui koreksi faktual eksplisit.');
        if (meeting.status === 'SELESAI' && input.nomor_pertemuan !== undefined) throw new MasterDataError(409, 'Nomor pertemuan selesai tidak dapat dikoreksi.');
        const term = await tx.term(kelas.semesterId);
        if (!term) throw new MasterDataError(404, 'Semester kelas tidak ditemukan.');
        validateMeeting({ ...meeting, ...changes }, term);
        return tx.updateMeeting(id, changes);
      });
    },
    cancel(user: AuthUser, id: string) {
      return run(async tx => {
        const { meeting } = await lockedMeeting(tx, user, id);
        if (meeting.status !== 'TERJADWAL') throw new MasterDataError(409, `Hanya pertemuan TERJADWAL yang dapat dibatalkan; status saat ini ${meeting.status}.`);
        if (await tx.attendanceCount(id)) throw new MasterDataError(409, 'Pertemuan dengan absensi tidak dapat dibatalkan. Koreksi fakta atau absensinya tanpa menghapus riwayat.');
        return tx.updateMeeting(id, { status: 'DIBATALKAN' });
      });
    },
    complete(user: AuthUser, id: string) {
      return run(async tx => {
        const { meeting, roster, attendance } = await attendanceContext(tx, user, id);
        if (meeting.status !== 'TERJADWAL') throw new MasterDataError(409, `Hanya pertemuan TERJADWAL yang dapat diselesaikan; status saat ini ${meeting.status}.`);
        const recorded = new Set(attendance.map(row => row.mahasiswaId));
        const missing = roster.filter(row => !recorded.has(row.id));
        if (missing.length) throw new MasterDataError(409, `Absensi belum lengkap: ${missing.length} mahasiswa belum dicatat.`);
        return tx.updateMeeting(id, { status: 'SELESAI' });
      });
    },
    roster(user: AuthUser, id: string) {
      return run(async tx => {
        const meeting = await tx.meetingDetail(id);
        if (!meeting) throw new MasterDataError(404, 'Pertemuan tidak ditemukan.');
        await classAccess(tx, user, meeting.kelasKuliahId);
        const [roster, rows] = await Promise.all([tx.effectiveRoster(meeting.kelasKuliahId), tx.attendanceRows(id)]);
        const byStudent = new Map(rows.map(row => [row.mahasiswaId, row]));
        const activeIds = new Set(roster.map(row => row.id));
        return {
          pertemuan: meeting,
          data: roster.map(mahasiswa => ({ mahasiswa, absensi: byStudent.get(mahasiswa.id) ?? null, recordingState: byStudent.has(mahasiswa.id) ? 'DICATAT' as const : 'BELUM_DICATAT' as const })),
          historical: rows.filter(row => !activeIds.has(row.mahasiswaId)),
          summary: { total: roster.length, recorded: roster.filter(row => byStudent.has(row.id)).length, missing: roster.filter(row => !byStudent.has(row.id)).length },
        };
      });
    },
    record(user: AuthUser, id: string, studentId: string, input: AbsensiInput) {
      return run(async tx => {
        const { meeting, roster, attendance } = await attendanceContext(tx, user, id);
        if (meeting.status === 'DIBATALKAN') throw new MasterDataError(409, 'Pertemuan yang dibatalkan tidak menerima absensi.');
        const existing = attendance.find(row => row.mahasiswaId === studentId);
        if (existing) {
          if (meeting.status === 'SELESAI') throw new MasterDataError(409, 'Gunakan koreksi untuk mengubah absensi pertemuan selesai.');
          if (!roster.some(row => row.id === studentId)) throw new MasterDataError(409, 'Mahasiswa tidak lagi termasuk peserta efektif; gunakan koreksi riwayat bila diperlukan.');
          return tx.updateAttendance(existing.id, attendanceWrite(input), user.id);
        }
        if (!roster.some(row => row.id === studentId)) throw new MasterDataError(400, 'Mahasiswa tidak terdaftar efektif pada kelas ini.');
        if (meeting.status === 'SELESAI') {
          requireRole(user, managers);
          if (!input.koreksi_terlambat || !input.keterangan?.trim()) throw new MasterDataError(409, 'Pencatatan terlambat memerlukan konfirmasi koreksi dan keterangan akademik.');
        }
        const changes = attendanceWrite(input);
        if (!changes.status) throw new MasterDataError(400, 'Status absensi wajib dipilih.');
        return tx.insertAttendance(id, studentId, changes as { status: NonNullable<typeof changes.status>; keterangan?: string | null }, user.id);
      });
    },
    correct(user: AuthUser, id: string, studentId: string, input: AbsensiPatch) {
      return run(async tx => {
        const { meeting, attendance } = await attendanceContext(tx, user, id);
        if (meeting.status === 'DIBATALKAN') throw new MasterDataError(409, 'Absensi pertemuan yang dibatalkan tidak dapat diubah.');
        const existing = attendance.find(row => row.mahasiswaId === studentId);
        if (!existing) throw new MasterDataError(404, 'Absensi belum pernah dicatat; gunakan pencatatan absensi.');
        const changes = attendanceWrite(input);
        if (meeting.status === 'SELESAI' && !input.keterangan?.trim()) throw new MasterDataError(400, 'Koreksi absensi pertemuan selesai memerlukan keterangan.');
        return tx.updateAttendance(existing.id, changes, user.id);
      });
    },
    lecturerClasses(user: AuthUser, query: DosenKelasQuery) {
      return run(async tx => {
        await actor(tx, user); requireRole(user, ['DOSEN']);
        const lecturer = await tx.lecturer(user.id);
        if (!lecturer) throw new MasterDataError(404, 'Akun belum terhubung dengan dosen.');
        return tx.listLecturerClasses(lecturer.id, query);
      });
    },
    lecturerClass(user: AuthUser, id: string) {
      return run(async tx => {
        const kelas = await tx.classInfo(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        await classAccess(tx, user, id);
        return kelas;
      });
    },
    studentHistory(user: AuthUser, query: ListQuery) {
      return run(async tx => {
        await actor(tx, user); requireRole(user, ['MAHASISWA']);
        const student = await tx.student(user.id);
        if (!student) throw new MasterDataError(404, 'Akun belum terhubung dengan mahasiswa.');
        return tx.studentHistory(student.id, query);
      });
    },
  };
}
export type PertemuanService = ReturnType<typeof createPertemuanService>;
