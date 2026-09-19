import { MasterDataError, normalizeText, requirePatch } from '../../utils/master-data';
import { normalizeIdentity, resolveUserLink, validateProgram, validateUserLink, withoutUserId, withProfileConstraints } from '../../utils/profile-service';
import type { DosenInput } from './dosen.model';
import type { DosenRepository } from './dosen.repository';

export function createDosenService(repository: DosenRepository) {
  function normalize(input: Partial<DosenInput>) {
    return {
      ...(input.kode_dosen !== undefined ? { kodeDosen: normalizeText(input.kode_dosen, 'Kode dosen', 30, true) } : {}),
      ...(input.nama !== undefined ? { nama: normalizeText(input.nama, 'Nama', 150) } : {}),
      ...(input.nik !== undefined ? { nik: input.nik === null ? null : normalizeIdentity(input.nik, 'NIK') } : {}),
      ...(input.nidn !== undefined ? { nidn: input.nidn === null ? null : normalizeText(input.nidn, 'NIDN', 30, true) } : {}),
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
        const nik = changes.nik ?? null;
        if (nik && await tx.nikOwner(nik)) throw new MasterDataError(409, 'NIK sudah digunakan oleh dosen lain.');
        const userId = nik ? await resolveUserLink(tx, 'dosen', nik) : null;
        return withoutUserId(await tx.create({ kodeDosen: changes.kodeDosen!, nama: changes.nama!, nik, nidn: changes.nidn ?? null, userId, programStudiId: input.program_studi_id ?? null, isActive: input.is_active ?? true }));
      }));
    },
    update(id: string, input: Partial<DosenInput>) {
      requirePatch(input);
      const changes = normalize(input);
      return withProfileConstraints(() => repository.transaction(async tx => {
        const existing = await tx.findById(id);
        if (!existing) throw new MasterDataError(404, 'Dosen tidak ditemukan.');
        if (changes.programStudiId && changes.programStudiId !== existing.programStudiId) await validateProgram(tx, changes.programStudiId);
        const nextNik = changes.nik === undefined ? existing.nik : changes.nik;
        let userId = existing.userId;
        if (userId && !nextNik) throw new MasterDataError(400, 'NIK tidak dapat dikosongkan selama akun DOSEN terhubung.');
        if (nextNik !== existing.nik && nextNik) {
          const owner = await tx.nikOwner(nextNik);
          if (owner && owner.id !== id) throw new MasterDataError(409, 'NIK sudah digunakan oleh dosen lain.');
        }
        if (userId) {
          if (!existing.nik) throw new MasterDataError(409, 'Akun terhubung tidak memiliki NIK yang selaras dan memerlukan perbaikan administratif.');
          await validateUserLink(tx, userId, 'dosen', existing.nik, id);
        }
        if (userId && nextNik !== existing.nik) {
          const loginOwner = await tx.loginIdOwner(nextNik!);
          if (loginOwner && loginOwner.id !== userId) throw new MasterDataError(409, 'Nomor Induk sudah digunakan oleh akun lain.');
          await tx.updateUserLoginId(userId, nextNik!, new Date());
        } else if (!userId && nextNik) {
          userId = await resolveUserLink(tx, 'dosen', nextNik, id);
        }
        return withoutUserId(await tx.update(id, { ...changes, userId, updatedAt: new Date() }));
      }));
    },
  };
}
export type DosenService = ReturnType<typeof createDosenService>;
