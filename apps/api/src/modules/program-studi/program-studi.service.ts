import { MasterDataError, normalizeText, requirePatch, withDuplicateCode } from '../../utils/master-data';
import { jenjangValues, type ProgramStudiInput } from './program-studi.model';
import type { ProgramStudiRepository } from './program-studi.repository';

export function createProgramStudiService(repository: ProgramStudiRepository) {
  const write = <T>(operation: () => Promise<T>) => withDuplicateCode('program studi', 'program_studi_kode_unique', operation);
  function normalize(input: Partial<ProgramStudiInput>) {
    if (input.jenjang !== undefined && !jenjangValues.includes(input.jenjang)) throw new MasterDataError(400, 'Jenjang tidak valid.');
    return {
      ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 20, true) } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.fakultas_id !== undefined ? { fakultasId: input.fakultas_id } : {}),
      ...(input.jenjang !== undefined ? { jenjang: input.jenjang } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    };
  }
  return {
    list: repository.list,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Program studi tidak ditemukan.');
      return row;
    },
    create(input: ProgramStudiInput) {
      normalize(input);
      return write(() => repository.transaction(async tx => {
        const faculty = await tx.lockFakultas(input.fakultas_id);
        if (!faculty) throw new MasterDataError(400, 'Fakultas tidak ditemukan.');
        if (!faculty.isActive) throw new MasterDataError(400, 'Program studi baru harus menggunakan fakultas aktif.');
        return tx.create({ kode: normalizeText(input.kode, 'Kode', 20, true), nama: normalizeText(input.nama, 'Nama', 150), fakultasId: input.fakultas_id, jenjang: input.jenjang, isActive: input.is_active ?? true });
      }));
    },
    update(id: string, input: Partial<ProgramStudiInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return write(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Program studi tidak ditemukan.');
        // Unchanged historical assignments can still be edited/deactivated.
        if ((changes.fakultasId !== undefined && changes.fakultasId !== existing.fakultasId) || (changes.isActive === true && !existing.isActive)) {
          const faculty = await tx.lockFakultas(changes.fakultasId ?? existing.fakultasId);
          if (!faculty) throw new MasterDataError(400, 'Fakultas tidak ditemukan.');
          if (!faculty.isActive) throw new MasterDataError(400, 'Penugasan atau aktivasi program studi harus menggunakan fakultas aktif.');
        }
        return tx.update(id, { ...changes, updatedAt: new Date() });
      }));
    },
  };
}
export type ProgramStudiService = ReturnType<typeof createProgramStudiService>;
