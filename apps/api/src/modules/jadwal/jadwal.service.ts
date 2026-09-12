import type { jadwalKuliah, kelasKuliah } from '@kampusia/db/schema';
import { academicWrite } from '../../utils/academic-write';
import { MasterDataError, requirePatch, type ListQuery } from '../../utils/master-data';
import type { JadwalInput } from './jadwal.model';
import type { JadwalRepository, SchedulingRepository } from './jadwal.repository';
type Slot = Pick<typeof jadwalKuliah.$inferSelect, 'ruanganId' | 'hari' | 'jamMulai' | 'jamSelesai'> & { id?: string };
type Class = typeof kelasKuliah.$inferSelect;
const dayMs = 86400000;
export function hasWeekday(start: string, end: string, day: number) {
  const first = new Date(start + 'T00:00:00Z');
  const offset = (day - (first.getUTCDay() || 7) + 7) % 7;
  return first.getTime() + offset * dayMs <= new Date(end + 'T00:00:00Z').getTime();
}
// PostgreSQL time values and API HH:mm inputs use the same strict overlap semantics.
export function slotsOverlap(a: Pick<Slot, 'hari' | 'jamMulai' | 'jamSelesai'>, b: Pick<Slot, 'hari' | 'jamMulai' | 'jamSelesai'>, dates: { tanggalMulai: string; tanggalSelesai: string }) {
  const seconds = (value: string) => { const [h, m, s = 0] = value.split(':').map(Number); return h! * 3600 + m! * 60 + s; };
  return a.hari === b.hari && hasWeekday(dates.tanggalMulai, dates.tanggalSelesai, a.hari)
    && seconds(a.jamMulai) < seconds(b.jamSelesai) && seconds(b.jamMulai) < seconds(a.jamSelesai);
}
function time(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/.test(value)) throw new MasterDataError(400, 'Jam harus menggunakan format HH:mm atau HH:mm:ss yang valid.');
  return value.length === 5 ? value + ':00' : value;
}
export function validateTime(slot: Slot) {
  if (!Number.isInteger(slot.hari) || slot.hari < 1 || slot.hari > 7) throw new MasterDataError(400, 'Hari harus antara 1 (Senin) dan 7 (Minggu).');
  const seconds = (value: string) => { const [h, m, s] = time(value).split(':').map(Number); return h! * 3600 + m! * 60 + s!; };
  if (seconds(slot.jamMulai) >= seconds(slot.jamSelesai)) throw new MasterDataError(400, 'Jam mulai harus lebih awal dari jam selesai. Jadwal melewati tengah malam tidak didukung.');
}
export async function validateSchedule(tx: SchedulingRepository, kelas: Class, slot: Slot, additionalLecturer?: string) {
  validateTime(slot);
  const term = await tx.term(kelas.semesterId);
  if (!term) throw new MasterDataError(400, 'Semester tidak ditemukan.');
  if (!hasWeekday(term.tanggalMulai, term.tanggalSelesai, slot.hari)) throw new MasterDataError(400, 'Jadwal tidak memiliki pertemuan pada rentang tanggal semester.');
  const room = await tx.room(slot.ruanganId);
  if (!room) throw new MasterDataError(400, 'Ruangan tidak ditemukan.');
  if (!room.isActive) throw new MasterDataError(400, 'Ruangan nonaktif tidak dapat digunakan untuk jadwal.');
  if (room.kapasitas < kelas.kapasitas) throw new MasterDataError(400, 'Kapasitas ruangan tidak mencukupi kapasitas kelas.');
  if (kelas.status === 'DIBATALKAN') return;
  const candidates = (await tx.candidates(slot, term, kelas.id)).filter(row => row.id !== slot.id && slotsOverlap(row, slot, { tanggalMulai: row.tanggalMulai > term.tanggalMulai ? row.tanggalMulai : term.tanggalMulai, tanggalSelesai: row.tanggalSelesai < term.tanggalSelesai ? row.tanggalSelesai : term.tanggalSelesai }));
  const assignments = await tx.lecturers([...new Set([kelas.id, ...candidates.map(row => row.kelasKuliahId)])]);
  const lecturers = new Set(assignments.filter(row => row.kelasKuliahId === kelas.id).map(row => row.dosenId));
  if (additionalLecturer) lecturers.add(additionalLecturer);
  const peers = new Set((await tx.approvedPeerClasses(kelas.id)).map(row => row.id));
  for (const other of candidates) {
    if (other.kelasKuliahId === kelas.id) throw new MasterDataError(409, 'Jadwal bentrok dengan jadwal lain pada kelas yang sama.');
    if (other.ruanganId === slot.ruanganId) throw new MasterDataError(409, 'Jadwal bentrok: ruangan sudah digunakan pada waktu tersebut.');
    if (assignments.some(row => row.kelasKuliahId === other.kelasKuliahId && lecturers.has(row.dosenId))) throw new MasterDataError(409, 'Jadwal bentrok: dosen pengajar memiliki jadwal kelas lain.');
    if (peers.has(other.kelasKuliahId)) throw new MasterDataError(409, 'Jadwal bentrok dengan kelas lain pada KRS mahasiswa yang telah disetujui.');
  }
}
export async function validateClassSchedules(tx: SchedulingRepository, kelas: Class, additionalLecturer?: string) {
  const slots = await tx.slots(kelas.id);
  for (const slot of slots) await validateSchedule(tx, kelas, slot, additionalLecturer);
}
function normalize(input: Partial<JadwalInput>) {
  return { ...(input.ruangan_id !== undefined ? { ruanganId: input.ruangan_id } : {}), ...(input.hari !== undefined ? { hari: input.hari } : {}),
    ...(input.jam_mulai !== undefined ? { jamMulai: time(input.jam_mulai) } : {}), ...(input.jam_selesai !== undefined ? { jamSelesai: time(input.jam_selesai) } : {}) };
}
export function createJadwalService(repository: JadwalRepository) {
  return {
    async list(id: string, query: ListQuery) {
      if (!await repository.findClass(id)) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
      return repository.list(id, query);
    },
    add(id: string, input: JadwalInput) {
      const slot = { ruanganId: input.ruangan_id, hari: input.hari, jamMulai: time(input.jam_mulai), jamSelesai: time(input.jam_selesai) };
      return academicWrite(() => repository.transaction(async tx => {
        const kelas = await tx.lockClass(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        await validateSchedule(tx, kelas, slot);
        return tx.create({ ...slot, kelasKuliahId: id });
      }));
    },
    update(id: string, jadwalId: string, input: Partial<JadwalInput>) {
      requirePatch(input); const changes = normalize(input);
      return academicWrite(() => repository.transaction(async tx => {
        const kelas = await tx.lockClass(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const existing = (await tx.slots(id)).find(row => row.id === jadwalId);
        if (!existing) throw new MasterDataError(404, 'Jadwal tidak ditemukan pada kelas ini.');
        await validateSchedule(tx, kelas, { ...existing, ...changes });
        return tx.update(jadwalId, changes);
      }));
    },
    remove(id: string, jadwalId: string) {
      return academicWrite(() => repository.transaction(async tx => {
        const kelas = await tx.lockClass(id);
        if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const slots = await tx.slots(id);
        if (!slots.some(row => row.id === jadwalId)) throw new MasterDataError(404, 'Jadwal tidak ditemukan pada kelas ini.');
        if (await tx.hasApprovalHistory(id)) throw new MasterDataError(409, 'Jadwal kelas dengan riwayat KRS disetujui tidak dapat dihapus.');
        if (kelas.status === 'DIBUKA' && slots.length === 1) throw new MasterDataError(409, 'Kelas dibuka harus mempertahankan setidaknya satu jadwal.');
        await tx.remove(jadwalId); return { id: jadwalId };
      }));
    },
  };
}
export type JadwalService = ReturnType<typeof createJadwalService>;
