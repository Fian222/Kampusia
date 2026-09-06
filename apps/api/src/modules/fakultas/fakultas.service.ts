import { MasterDataError, normalizeText, requirePatch, withDuplicateCode } from '../../utils/master-data';
import type { FakultasInput } from './fakultas.model';
import type { FakultasRepository } from './fakultas.repository';

export function createFakultasService(repository: FakultasRepository) {
  const write = <T>(operation: () => Promise<T>) => withDuplicateCode('fakultas', 'fakultas_kode_unique', operation);
  return {
    list: repository.list,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Fakultas tidak ditemukan.');
      return row;
    },
    create(input: FakultasInput) {
      return write(() => repository.create({ kode: normalizeText(input.kode, 'Kode', 20, true), nama: normalizeText(input.nama, 'Nama', 150), isActive: input.is_active ?? true }));
    },
    async update(id: string, input: Partial<FakultasInput>) {
      requirePatch(input);
      const row = await write(() => repository.update(id, {
        ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 20, true) } : {}),
        ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
        ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
        updatedAt: new Date(),
      }));
      if (!row) throw new MasterDataError(404, 'Fakultas tidak ditemukan.');
      return row;
    },
  };
}
export type FakultasService = ReturnType<typeof createFakultasService>;
