import { MasterDataError, normalizeText, requirePatch, withDuplicateCode } from '../../utils/master-data';
import type { MataKuliahInput } from './mata-kuliah.model';
import type { MataKuliahRepository } from './mata-kuliah.repository';

export function createMataKuliahService(repository: MataKuliahRepository) {
  const write = <T>(operation: () => Promise<T>) => withDuplicateCode('mata kuliah', 'mata_kuliah_kode_unique', operation);
  function normalize(input: Partial<MataKuliahInput>) {
    if (input.sks !== undefined && (!Number.isInteger(input.sks) || input.sks < 1 || input.sks > 32767)) throw new MasterDataError(400, 'SKS harus berupa bilangan bulat antara 1 dan 32767.');
    return {
      ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 30, true) } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.sks !== undefined ? { sks: input.sks } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    };
  }
  return {
    list: repository.list,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Mata kuliah tidak ditemukan.');
      return row;
    },
    create(input: MataKuliahInput) {
      normalize(input);
      return write(() => repository.transaction(tx => tx.create({ kode: normalizeText(input.kode, 'Kode', 30, true), nama: normalizeText(input.nama, 'Nama', 150), sks: input.sks, isActive: input.is_active ?? true })));
    },
    update(id: string, input: Partial<MataKuliahInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return write(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Mata kuliah tidak ditemukan.');
        if (((changes.kode !== undefined && changes.kode !== existing.kode) || (changes.nama !== undefined && changes.nama !== existing.nama) || (changes.sks !== undefined && changes.sks !== existing.sks)) && await tx.hasHistory(id)) {
          throw new MasterDataError(409, 'Identitas dan SKS mata kuliah yang digunakan kurikulum atau kelas tidak dapat diubah. Buat versi mata kuliah dengan kode baru.');
        }
        return tx.update(id, { ...changes, updatedAt: new Date() });
      }));
    },
  };
}
export type MataKuliahService = ReturnType<typeof createMataKuliahService>;
