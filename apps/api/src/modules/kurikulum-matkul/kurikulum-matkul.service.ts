import { MasterDataError, requirePatch, withDuplicateCode, type ListQuery } from '../../utils/master-data';
import type { MembershipInput, MembershipPatch } from './kurikulum-matkul.model';
import type { KurikulumMatkulRepository } from './kurikulum-matkul.repository';

export function createKurikulumMatkulService(repository: KurikulumMatkulRepository) {
  type Tx = Parameters<Parameters<KurikulumMatkulRepository['transaction']>[0]>[0];
  function normalize(input: MembershipPatch) {
    const semester = input.semester_rekomendasi;
    if (semester != null && (!Number.isInteger(semester) || semester < 1 || semester > 32767)) throw new MasterDataError(400, 'Semester rekomendasi harus kosong atau bilangan bulat antara 1 dan 32767.');
    return { ...(semester !== undefined ? { semesterRekomendasi: semester } : {}), ...(input.is_wajib !== undefined ? { isWajib: input.is_wajib } : {}) };
  }
  async function lockCurriculum(tx: Tx, id: string) {
    const row = await tx.lockKurikulum(id);
    if (!row) throw new MasterDataError(404, 'Kurikulum tidak ditemukan.');
    return row;
  }
  async function requireUnassigned(tx: Tx, id: string) {
    if (await tx.hasStudents(id)) throw new MasterDataError(409, 'Kurikulum sudah digunakan mahasiswa. Buat versi kurikulum baru untuk mengubah mata kuliah atau persyaratannya.');
  }
  return {
    async list(id: string, query: ListQuery) {
      if (!await repository.findKurikulum(id)) throw new MasterDataError(404, 'Kurikulum tidak ditemukan.');
      return repository.list(id, query);
    },
    add(id: string, input: MembershipInput) {
      const changes = normalize(input);
      return withDuplicateCode('keanggotaan mata kuliah pada kurikulum', 'kurikulum_matkul_kurikulum_id_mata_kuliah_id_unique', () => repository.transaction(async tx => {
        const curriculum = await lockCurriculum(tx, id);
        await requireUnassigned(tx, id);
        if (!curriculum.isActive) throw new MasterDataError(400, 'Mata kuliah baru harus ditambahkan ke kurikulum aktif.');
        const course = await tx.lockMataKuliah(input.mata_kuliah_id);
        if (!course) throw new MasterDataError(400, 'Mata kuliah tidak ditemukan.');
        if (!course.isActive) throw new MasterDataError(400, 'Mata kuliah nonaktif tidak dapat ditambahkan.');
        return tx.create({ kurikulumId: id, mataKuliahId: course.id, semesterRekomendasi: changes.semesterRekomendasi ?? null, isWajib: changes.isWajib ?? true });
      }));
    },
    update(id: string, membershipId: string, input: MembershipPatch) {
      requirePatch(input);
      const changes = normalize(input);
      return repository.transaction(async tx => {
        await lockCurriculum(tx, id);
        const row = await tx.findMembership(id, membershipId);
        if (!row) throw new MasterDataError(404, 'Mata kuliah dalam kurikulum tidak ditemukan.');
        if ((changes.semesterRekomendasi !== undefined && changes.semesterRekomendasi !== row.semesterRekomendasi) || (changes.isWajib !== undefined && changes.isWajib !== row.isWajib)) await requireUnassigned(tx, id);
        return tx.update(membershipId, { ...changes, updatedAt: new Date() });
      });
    },
    remove(id: string, membershipId: string) {
      return repository.transaction(async tx => {
        const curriculum = await lockCurriculum(tx, id);
        const row = await tx.findMembership(id, membershipId);
        if (!row) throw new MasterDataError(404, 'Mata kuliah dalam kurikulum tidak ditemukan.');
        await requireUnassigned(tx, id);
        await tx.lockMataKuliah(row.mataKuliahId);
        if (await tx.hasOfferingHistory(row.mataKuliahId, curriculum.programStudiId)) throw new MasterDataError(409, 'Keanggotaan memiliki riwayat kelas pada program studi ini dan tidak dapat dihapus.');
        await tx.remove(membershipId);
        return null;
      });
    },
  };
}
export type KurikulumMatkulService = ReturnType<typeof createKurikulumMatkulService>;
