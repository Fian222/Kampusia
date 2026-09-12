import { academicWrite } from '../../utils/academic-write';
import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { hasWeekday } from '../jadwal/jadwal.service';
import type { RuanganInput } from './ruangan.model';
import type { RuanganRepository } from './ruangan.repository';
function normalize(input: Partial<RuanganInput>) {
  if (input.kapasitas !== undefined && (!Number.isInteger(input.kapasitas) || input.kapasitas < 1 || input.kapasitas > 2147483647)) throw new MasterDataError(400, 'Kapasitas harus berupa bilangan bulat positif.');
  return { ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 30, true) } : {}), ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 100) } : {}),
    ...(input.gedung !== undefined ? { gedung: input.gedung === null ? null : normalizeText(input.gedung, 'Gedung', 100) } : {}), ...(input.kapasitas !== undefined ? { kapasitas: input.kapasitas } : {}), ...(input.is_active !== undefined ? { isActive: input.is_active } : {}) };
}
export function createRuanganService(repository: RuanganRepository, now: () => Date = () => new Date()) {
  return {
    list: repository.list,
    async get(id: string) { const row = await repository.findById(id); if (!row) throw new MasterDataError(404, 'Ruangan tidak ditemukan.'); return row; },
    create(input: RuanganInput) {
      normalize(input);
      return academicWrite(() => repository.transaction(tx => tx.create({ kode: normalizeText(input.kode, 'Kode', 30, true), nama: normalizeText(input.nama, 'Nama', 100), gedung: input.gedung == null ? null : normalizeText(input.gedung, 'Gedung', 100), kapasitas: input.kapasitas, isActive: input.is_active ?? true })));
    },
    update(id: string, input: Partial<RuanganInput>) {
      requirePatch(input); const changes = normalize(input);
      return academicWrite(() => repository.transaction(async tx => {
        const row = await tx.findById(id);
        if (!row) throw new MasterDataError(404, 'Ruangan tidak ditemukan.');
        const slots = await tx.schedules(id);
        if (changes.kapasitas !== undefined && changes.kapasitas < row.kapasitas && slots.some(slot => slot.kapasitas > changes.kapasitas!)) throw new MasterDataError(409, 'Kapasitas ruangan tidak boleh kurang dari kapasitas kelas pada jadwal yang ada.');
        // Campus-local date/time, independent of the API host timezone.
        const local = new Date(now().getTime() + 7 * 3600000).toISOString();
        const today = local.slice(0, 10); const clock = local.slice(11, 19);
        const tomorrow = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
        if (changes.isActive === false && row.isActive && slots.some(slot => {
          if (slot.status === 'DIBATALKAN') return false;
          const start = slot.tanggalMulai > today ? slot.tanggalMulai : today;
          if (!hasWeekday(start, slot.tanggalSelesai, slot.hari)) return false;
          return start > today || !hasWeekday(today, today, slot.hari) || slot.jamSelesai > clock || hasWeekday(tomorrow, slot.tanggalSelesai, slot.hari);
        })) throw new MasterDataError(409, 'Selesaikan atau pindahkan jadwal saat ini/mendatang sebelum menonaktifkan ruangan.');
        return tx.update(id, changes);
      }));
    },
  };
}
export type RuanganService = ReturnType<typeof createRuanganService>;
