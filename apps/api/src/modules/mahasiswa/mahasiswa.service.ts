import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { normalizeIdentity, resolveUserLink, validateProgram, validateUserLink, withoutUserId, withProfileConstraints } from '../../utils/profile-service';
import { mahasiswaStatusValues } from './mahasiswa.options';
import type { MahasiswaInput } from './mahasiswa.model';
import type { MahasiswaRepository } from './mahasiswa.repository';

export function createMahasiswaService(repository: MahasiswaRepository) {
  function normalize(input: Partial<MahasiswaInput>) {
    if (input.status !== undefined && !mahasiswaStatusValues.includes(input.status)) throw new MasterDataError(400, 'Status mahasiswa tidak valid.');
    if (input.angkatan !== undefined && (!Number.isInteger(input.angkatan) || input.angkatan < 1900 || input.angkatan > 9999)) throw new MasterDataError(400, 'Angkatan harus berupa tahun antara 1900 dan 9999.');
    return {
      ...(input.nim !== undefined ? { nim: normalizeIdentity(input.nim, 'NIM') } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.program_studi_id !== undefined ? { programStudiId: input.program_studi_id } : {}),
      ...(input.kurikulum_id !== undefined ? { kurikulumId: input.kurikulum_id } : {}),
      ...(input.dosen_pa_id !== undefined ? { dosenPaId: input.dosen_pa_id } : {}),
      ...(input.angkatan !== undefined ? { angkatan: input.angkatan } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
  }
  type Tx = Parameters<Parameters<MahasiswaRepository['transaction']>[0]>[0];
  async function validateCurriculum(tx: Tx, curriculumId: string, programId: string) {
    const curriculum = await tx.lockKurikulum(curriculumId);
    if (!curriculum) throw new MasterDataError(400, 'Kurikulum tidak ditemukan.');
    if (curriculum.programStudiId !== programId) throw new MasterDataError(400, 'Kurikulum harus berasal dari program studi mahasiswa.');
    if (!curriculum.isActive) throw new MasterDataError(400, 'Penugasan baru harus menggunakan kurikulum aktif.');
  }
  async function validateAdviser(tx: Tx, adviserId: string | null | undefined) {
    if (!adviserId) return;
    const adviser = await tx.lockDosen(adviserId);
    if (!adviser) throw new MasterDataError(400, 'Dosen PA tidak ditemukan.');
    if (!adviser.isActive) throw new MasterDataError(400, 'Dosen PA harus berstatus aktif.');
  }
  return {
    list: repository.list,
    kurikulumOptions: repository.kurikulumOptions,
    async get(id: string) {
      const row = await repository.findById(id);
      if (!row) throw new MasterDataError(404, 'Mahasiswa tidak ditemukan.');
      return row;
    },
    create(input: MahasiswaInput) {
      const changes = normalize(input);
      return withProfileConstraints(() => repository.transaction(async tx => {
        const nim = changes.nim!;
        await validateProgram(tx, input.program_studi_id);
        await validateCurriculum(tx, input.kurikulum_id, input.program_studi_id);
        await validateAdviser(tx, input.dosen_pa_id);
        if (await tx.nimOwner(nim)) throw new MasterDataError(409, 'NIM sudah digunakan oleh mahasiswa lain.');
        const userId = await resolveUserLink(tx, 'mahasiswa', nim);
        return withoutUserId(await tx.create({ nim, nama: changes.nama!, programStudiId: input.program_studi_id, kurikulumId: input.kurikulum_id, dosenPaId: input.dosen_pa_id ?? null, angkatan: input.angkatan, status: input.status ?? 'AKTIF', userId }));
      }));
    },
    update(id: string, input: Partial<MahasiswaInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return withProfileConstraints(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Mahasiswa tidak ditemukan.');
        const programId = changes.programStudiId ?? existing.programStudiId;
        const curriculumId = changes.kurikulumId ?? existing.kurikulumId;
        if (programId !== existing.programStudiId || curriculumId !== existing.kurikulumId) {
          if (await tx.hasApprovedHistory(id)) throw new MasterDataError(409, 'Program studi atau kurikulum tidak dapat dipindahkan karena mahasiswa memiliki riwayat KRS disetujui.');
          await validateProgram(tx, programId);
          await validateCurriculum(tx, curriculumId, programId);
        }
        if (changes.dosenPaId !== undefined && changes.dosenPaId !== existing.dosenPaId) await validateAdviser(tx, changes.dosenPaId);
        const nextNim = changes.nim ?? existing.nim;
        if (nextNim !== existing.nim) {
          const owner = await tx.nimOwner(nextNim);
          if (owner && owner.id !== id) throw new MasterDataError(409, 'NIM sudah digunakan oleh mahasiswa lain.');
        }
        let userId = existing.userId;
        if (userId) {
          await validateUserLink(tx, userId, 'mahasiswa', existing.nim, id);
        }
        if (userId && nextNim !== existing.nim) {
          const loginOwner = await tx.loginIdOwner(nextNim);
          if (loginOwner && loginOwner.id !== userId) throw new MasterDataError(409, 'Nomor Induk sudah digunakan oleh akun lain.');
          await tx.updateUserLoginId(userId, nextNim, new Date());
        } else if (!userId) {
          userId = await resolveUserLink(tx, 'mahasiswa', nextNim, id);
        }
        return withoutUserId(await tx.update(id, { ...changes, userId, updatedAt: new Date() }));
      }));
    },
  };
}
export type MahasiswaService = ReturnType<typeof createMahasiswaService>;
