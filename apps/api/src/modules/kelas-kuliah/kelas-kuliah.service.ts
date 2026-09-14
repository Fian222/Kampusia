import { validateClassSchedules } from '../jadwal/jadwal.service';
import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { academicWrite } from '../../utils/academic-write';
import type { KelasKuliahInput } from './kelas-kuliah.model';
import type { KelasKuliahRepository } from './kelas-kuliah.repository';
type Tx = Parameters<Parameters<KelasKuliahRepository['transaction']>[0]>[0];
function normalize(input: Partial<KelasKuliahInput>) {
  if (input.kapasitas !== undefined && (!Number.isInteger(input.kapasitas) || input.kapasitas < 1 || input.kapasitas > 2147483647)) throw new MasterDataError(400, 'Kapasitas harus berupa bilangan bulat positif.');
  return { ...(input.semester_id !== undefined ? { semesterId: input.semester_id } : {}), ...(input.mata_kuliah_id !== undefined ? { mataKuliahId: input.mata_kuliah_id } : {}),
    ...(input.program_studi_id !== undefined ? { programStudiId: input.program_studi_id } : {}), ...(input.nama_kelas !== undefined ? { namaKelas: normalizeText(input.nama_kelas, 'Nama kelas', 20, true) } : {}),
    ...(input.kapasitas !== undefined ? { kapasitas: input.kapasitas } : {}), ...(input.status !== undefined ? { status: input.status } : {}) };
}
async function validateReferences(tx: Tx, row: { semesterId: string; mataKuliahId: string; programStudiId: string }) {
  if (!await tx.lockSemester(row.semesterId)) throw new MasterDataError(400, 'Semester tidak ditemukan.');
  const program = await tx.lockProgram(row.programStudiId);
  if (!program?.isActive) throw new MasterDataError(400, 'Program studi harus tersedia dan aktif.');
  const course = await tx.lockCourse(row.mataKuliahId);
  if (!course?.isActive) throw new MasterDataError(400, 'Mata kuliah harus tersedia dan aktif.');
}
async function validateOpening(tx: Tx, row: { id?: string; mataKuliahId: string; programStudiId: string; kapasitas: number }) {
  if (!await tx.hasCurriculum(row.mataKuliahId, row.programStudiId)) throw new MasterDataError(400, 'Mata kuliah belum termasuk kurikulum program studi penawar.');
  if (!row.id || !(await tx.assignments(row.id)).some(item => item.dosen.isActive)) throw new MasterDataError(400, 'Kelas DIBUKA membutuhkan setidaknya satu dosen aktif.');
  if (!(await tx.schedules(row.id)).length) throw new MasterDataError(400, 'Kelas belum memiliki jadwal. Konfigurasikan Jadwal sebelum membuka kelas.');
  const kelas = await tx.scheduling.lockClass(row.id);
  if (!kelas) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
  await validateClassSchedules(tx.scheduling, { ...kelas, kapasitas: row.kapasitas, status: 'DIBUKA' });
}
export function createKelasKuliahService(repository: KelasKuliahRepository) {
  return {
    list: repository.list,
    async get(id: string) { const row = await repository.findById(id); if (!row) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.'); return row; },
    create(input: KelasKuliahInput) {
      normalize(input);
      const row = { semesterId: input.semester_id, mataKuliahId: input.mata_kuliah_id, programStudiId: input.program_studi_id, namaKelas: normalizeText(input.nama_kelas, 'Nama kelas', 20, true), kapasitas: input.kapasitas, status: input.status ?? 'DRAFT' };
      return academicWrite(() => repository.transaction(async tx => { await validateReferences(tx, row); if (row.status === 'DIBUKA') await validateOpening(tx, row); return tx.create(row); }));
    },
    update(id: string, input: Partial<KelasKuliahInput>) {
      requirePatch(input); const changes = normalize(input);
      return academicWrite(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Kelas kuliah tidak ditemukan.');
        const next = { ...existing, ...changes };
        const identityChanged = (['semesterId', 'mataKuliahId', 'programStudiId'] as const).some(key => next[key] !== existing[key]);
        const schedules = await tx.schedules(id);
        if (identityChanged && (await tx.hasSelections(id) || schedules.length > 0)) throw new MasterDataError(409, 'Identitas kelas dengan pilihan KRS atau jadwal tidak dapat diubah.');
        if (identityChanged || (next.status === 'DIBUKA' && existing.status !== 'DIBUKA')) await validateReferences(tx, next);
        if (next.kapasitas < existing.kapasitas && next.kapasitas < await tx.enrollmentCount(id)) throw new MasterDataError(409, 'Kapasitas tidak boleh kurang dari jumlah mahasiswa pada KRS disetujui yang aktif.');
        if (next.kapasitas !== existing.kapasitas && schedules.some(slot => slot.roomCapacity < next.kapasitas)) throw new MasterDataError(409, 'Kapasitas kelas melebihi kapasitas ruangan pada jadwal.');
        if (next.status === 'DIBATALKAN' && existing.status !== 'DIBATALKAN') {
          if (await tx.hasActiveDetails(id)) throw new MasterDataError(409, 'Pembatalan kelas dengan pilihan aktif memerlukan alur pembatalan KRS.');
          if (await tx.scheduledMeetingHasAttendance(id)) throw new MasterDataError(409, 'Kelas memiliki pertemuan terjadwal dengan absensi; koreksi riwayat sebelum pembatalan kelas.');
          await tx.cancelScheduledMeetings(id);
        }
        if (existing.status === 'DIBATALKAN' && next.status !== 'DIBATALKAN' && schedules.length) await validateClassSchedules(tx.scheduling, next);
        if (next.status === 'DIBUKA' && (existing.status !== 'DIBUKA' || identityChanged)) await validateOpening(tx, next);
        return tx.update(id, changes);
      }));
    },
  };
}
export type KelasKuliahService = ReturnType<typeof createKelasKuliahService>;
