import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { academicWrite } from '../../utils/academic-write';
import type { SemesterInput } from './semester.model';
import type { SemesterRepository } from './semester.repository';
import { jakartaDateTimeToInstant } from './semester-time';
function krsInstant(value: string | null | undefined) {
  return value == null || value.trim() === '' ? null : jakartaDateTimeToInstant(value.trim());
}
function normalize(input: Partial<SemesterInput>) {
  return {
    ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 5, true) } : {}),
    ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 100) } : {}),
    ...(input.tahun_mulai !== undefined ? { tahunMulai: input.tahun_mulai } : {}),
    ...(input.jenis !== undefined ? { jenis: input.jenis } : {}),
    ...(input.tanggal_mulai !== undefined ? { tanggalMulai: input.tanggal_mulai } : {}),
    ...(input.tanggal_selesai !== undefined ? { tanggalSelesai: input.tanggal_selesai } : {}),
    ...(input.krs_mulai_at !== undefined ? { krsMulaiAt: krsInstant(input.krs_mulai_at) } : {}),
    ...(input.krs_selesai_at !== undefined ? { krsSelesaiAt: krsInstant(input.krs_selesai_at) } : {}),
    ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
  };
}
function validate(row: NonNullable<Awaited<ReturnType<SemesterRepository['findById']>>> | ReturnType<typeof normalize>) {
  if (!Number.isInteger(row.tahunMulai) || row.tahunMulai! < 1900 || row.tahunMulai! > 9998 || !['GANJIL', 'GENAP'].includes(row.jenis!)) throw new MasterDataError(400, 'Tahun mulai atau jenis semester tidak valid.');
  if (row.kode !== `${row.tahunMulai}${row.jenis === 'GANJIL' ? '1' : '2'}`) throw new MasterDataError(400, 'Kode harus sesuai tahun mulai dan jenis: YYYY1 (GANJIL) atau YYYY2 (GENAP).');
  for (const date of [row.tanggalMulai, row.tanggalSelesai]) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new MasterDataError(400, 'Tanggal semester tidak valid.');
  }
  if (row.tanggalMulai! > row.tanggalSelesai!) throw new MasterDataError(400, 'Tanggal mulai tidak boleh setelah tanggal selesai.');
  if ((row.krsMulaiAt == null) !== (row.krsSelesaiAt == null)) throw new MasterDataError(400, 'Awal dan akhir periode KRS harus diisi bersama atau dikosongkan bersama.');
  if (row.krsMulaiAt && row.krsSelesaiAt && row.krsMulaiAt >= row.krsSelesaiAt) throw new MasterDataError(400, 'Awal periode KRS harus sebelum akhirnya.');
}
export function createSemesterService(repository: SemesterRepository) {
  return {
    list: repository.list,
    async get(id: string) { const row = await repository.findById(id); if (!row) throw new MasterDataError(404, 'Semester tidak ditemukan.'); return row; },
    create(input: SemesterInput) {
      const row = { kode: normalizeText(input.kode, 'Kode', 5, true), nama: normalizeText(input.nama, 'Nama', 100), tahunMulai: input.tahun_mulai, jenis: input.jenis, tanggalMulai: input.tanggal_mulai, tanggalSelesai: input.tanggal_selesai, krsMulaiAt: krsInstant(input.krs_mulai_at), krsSelesaiAt: krsInstant(input.krs_selesai_at), isActive: input.is_active ?? false };
      validate(row);
      return academicWrite(() => repository.transaction(async tx => {
        await tx.lockActivation();
        if (row.isActive) await tx.deactivate();
        return tx.create(row);
      }));
    },
    update(id: string, input: Partial<SemesterInput>) {
      requirePatch(input); const changes = normalize(input);
      return academicWrite(() => repository.transaction(async tx => {
        await tx.lockActivation();
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Semester tidak ditemukan.');
        const next = { ...existing, ...changes }; validate(next);
        const changed = (['kode', 'nama', 'tahunMulai', 'jenis', 'tanggalMulai', 'tanggalSelesai'] as const).some(key => existing[key] !== next[key]);
        if (changed && await tx.hasHistory(id)) throw new MasterDataError(409, 'Identitas dan tanggal semester dengan riwayat persetujuan KRS atau jadwal harus dipertahankan.');
        if (changes.isActive === true && !existing.isActive) await tx.deactivate();
        return tx.update(id, changes);
      }));
    },
  };
}
export type SemesterService = ReturnType<typeof createSemesterService>;
