import type { profileReferences } from './profile-repository';
import { MasterDataError } from './master-data';

export async function validateUserLink(tx: ReturnType<typeof profileReferences>, userId: string | null | undefined, kind: 'mahasiswa' | 'dosen', id?: string) {
  if (!userId) return;
  const user = await tx.lockUser(userId);
  if (!user) throw new MasterDataError(400, 'Akun pengguna tidak ditemukan.');
  if (user.role !== (kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN')) throw new MasterDataError(400, `Akun harus memiliki peran ${kind.toUpperCase()}.`);
  const links = await tx.userLinks(userId);
  if ((links[kind] && links[kind] !== id) || links[kind === 'mahasiswa' ? 'dosen' : 'mahasiswa']) {
    throw new MasterDataError(409, 'Akun sudah terhubung ke profil akademik lain.');
  }
}

export async function validateProgram(tx: ReturnType<typeof profileReferences>, id: string) {
  const program = await tx.lockProgram(id);
  if (!program) throw new MasterDataError(400, 'Program studi tidak ditemukan.');
  if (!program.isActive) throw new MasterDataError(400, 'Penugasan baru harus menggunakan program studi aktif.');
}

const duplicateMessages: Record<string, string> = {
  mahasiswa_nim_unique: 'NIM sudah digunakan oleh mahasiswa lain.',
  mahasiswa_user_id_unique: 'Akun sudah terhubung ke mahasiswa lain.',
  dosen_kode_dosen_unique: 'Kode dosen sudah digunakan.',
  dosen_nidn_unique: 'NIDN sudah digunakan oleh dosen lain.',
  dosen_user_id_unique: 'Akun sudah terhubung ke dosen lain.',
};
export async function withProfileConstraints<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    let cause: unknown = error;
    for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
      if ('code' in cause && cause.code === '23505' && 'constraint_name' in cause && typeof cause.constraint_name === 'string') {
        const message = duplicateMessages[cause.constraint_name];
        if (message) throw new MasterDataError(409, message);
      }
      cause = 'cause' in cause ? cause.cause : undefined;
    }
    throw error;
  }
}
