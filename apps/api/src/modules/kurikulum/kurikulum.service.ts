import { MasterDataError, normalizeText, requirePatch, withDuplicateCode } from '../../utils/master-data';
import type { KurikulumInput } from './kurikulum.model';
import type { KurikulumRepository } from './kurikulum.repository';

export function createKurikulumService(repository: KurikulumRepository) {
  const write = <T>(operation: () => Promise<T>) => withDuplicateCode('kurikulum dalam program studi', 'kurikulum_program_studi_id_kode_unique', operation);
  function normalize(input: Partial<KurikulumInput>) {
    if (input.tahun_berlaku !== undefined && (!Number.isInteger(input.tahun_berlaku) || input.tahun_berlaku < 1900 || input.tahun_berlaku > 9999)) throw new MasterDataError(400, 'Tahun berlaku harus antara 1900 dan 9999.');
    return {
      ...(input.kode !== undefined ? { kode: normalizeText(input.kode, 'Kode', 30, true) } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.program_studi_id !== undefined ? { programStudiId: input.program_studi_id } : {}),
      ...(input.tahun_berlaku !== undefined ? { tahunBerlaku: input.tahun_berlaku } : {}),
      ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
    };
  }
  type Tx = Parameters<Parameters<KurikulumRepository['transaction']>[0]>[0];
  async function validateProgram(tx: Tx, id: string) {
    const row = await tx.lockProgram(id);
    if (!row) throw new MasterDataError(400, 'Program studi tidak ditemukan.');
    if (!row.isActive) throw new MasterDataError(400, 'Penugasan baru harus menggunakan program studi aktif.');
  }
  return {
    list: repository.list,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Kurikulum tidak ditemukan.');
      return row;
    },
    create(input: KurikulumInput) {
      normalize(input);
      return write(() => repository.transaction(async tx => {
        await validateProgram(tx, input.program_studi_id);
        return tx.create({ kode: normalizeText(input.kode, 'Kode', 30, true), nama: normalizeText(input.nama, 'Nama', 150), programStudiId: input.program_studi_id, tahunBerlaku: input.tahun_berlaku, isActive: input.is_active ?? true });
      }));
    },
    update(id: string, input: Partial<KurikulumInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return write(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Kurikulum tidak ditemukan.');
        const identityChanged = (changes.kode !== undefined && changes.kode !== existing.kode) || (changes.nama !== undefined && changes.nama !== existing.nama) || (changes.tahunBerlaku !== undefined && changes.tahunBerlaku !== existing.tahunBerlaku) || (changes.programStudiId !== undefined && changes.programStudiId !== existing.programStudiId);
        if (identityChanged && (await tx.hasStudents(id) || await tx.hasOfferingHistory(id, existing.programStudiId))) throw new MasterDataError(409, 'Kurikulum memiliki mahasiswa atau riwayat kelas. Buat versi kurikulum baru untuk mengubah identitas akademik.');
        if ((changes.programStudiId !== undefined && changes.programStudiId !== existing.programStudiId) || (changes.isActive === true && !existing.isActive)) await validateProgram(tx, changes.programStudiId ?? existing.programStudiId);
        return tx.update(id, { ...changes, updatedAt: new Date() });
      }));
    },
  };
}
export type KurikulumService = ReturnType<typeof createKurikulumService>;
