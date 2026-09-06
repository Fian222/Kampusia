import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { validateProgram, validateUserLink, withProfileConstraints } from '../../utils/profile-service';
import type { DosenInput } from './dosen.model';
import type { DosenRepository } from './dosen.repository';

export function createDosenService(repository: DosenRepository) {
  function normalize(input: Partial<DosenInput>) {
    return {
      ...(input.kode_dosen !== undefined ? { kodeDosen: normalizeText(input.kode_dosen, 'Kode dosen', 30, true) } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.nidn !== undefined ? { nidn: input.nidn === null ? null : normalizeText(input.nidn, 'NIDN', 30, true) } : {}),
      ...(input.user_id !== undefined ? { userId: input.user_id } : {}),
      ...(input.program_studi_id !== undefined ? { programStudiId: input.program_studi_id } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    };
  }
  return {
    list: repository.list,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Dosen tidak ditemukan.');
      return row;
    },
    create(input: DosenInput) {
      const changes = normalize(input);
      return withProfileConstraints(() => repository.transaction(async tx => {
        if (input.program_studi_id) await validateProgram(tx, input.program_studi_id);
        await validateUserLink(tx, input.user_id, 'dosen');
        return tx.create({ kodeDosen: normalizeText(input.kode_dosen, 'Kode dosen', 30, true), nama: normalizeText(input.nama, 'Nama', 150), nidn: changes.nidn ?? null, userId: input.user_id ?? null, programStudiId: input.program_studi_id ?? null, isActive: input.is_active ?? true });
      }));
    },
    update(id: string, input: Partial<DosenInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return withProfileConstraints(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Dosen tidak ditemukan.');
        if (changes.programStudiId && changes.programStudiId !== existing.programStudiId) await validateProgram(tx, changes.programStudiId);
        await validateUserLink(tx, changes.userId === undefined ? existing.userId : changes.userId, 'dosen', id);
        return tx.update(id, { ...changes, updatedAt: new Date() });
      }));
    },
  };
}
export type DosenService = ReturnType<typeof createDosenService>;
