import type { profileReferences } from './profile-repository';
import { MasterDataError } from './master-data';

export function normalizeIdentity(value: string, label: 'NIM' | 'NIK') {
  const normalized = value.trim();
  if (!/^[0-9]{1,30}$/.test(normalized)) throw new MasterDataError(400, `${label} harus terdiri dari 1–30 digit.`);
  return normalized;
}

export function withoutUserId<T extends { userId: unknown }>(row: T): Omit<T, 'userId'> {
  const { userId, ...safe } = row;
  void userId;
  return safe;
}

type ProfileKind = 'mahasiswa' | 'dosen';
type LockedUser = NonNullable<Awaited<ReturnType<ReturnType<typeof profileReferences>['lockUser']>>>;

type UserLinkReader = Pick<ReturnType<typeof profileReferences>, 'lockUser' | 'userLinks'>;
async function validateLockedUserLink(tx: UserLinkReader, user: LockedUser, kind: ProfileKind, expectedLoginId: string, id?: string) {
  if (!user) throw new MasterDataError(400, 'Akun pengguna tidak ditemukan.');
  if (user.role !== (kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN')) throw new MasterDataError(400, `Akun harus memiliki peran ${kind.toUpperCase()}.`);
  const links = await tx.userLinks(user.id);
  if ((links[kind] && links[kind] !== id) || links[kind === 'mahasiswa' ? 'dosen' : 'mahasiswa']) {
    throw new MasterDataError(409, 'Akun sudah terhubung ke profil akademik lain.');
  }
  if (user.loginId !== expectedLoginId) {
    throw new MasterDataError(400, `Nomor Induk akun harus sama dengan ${kind === 'mahasiswa' ? 'NIM mahasiswa' : 'NIK dosen'}.`);
  }
  return user;
}

export async function validateUserLink(tx: UserLinkReader, userId: string, kind: ProfileKind, expectedLoginId: string, id?: string) {
  const user = await tx.lockUser(userId);
  if (!user) throw new MasterDataError(400, 'Akun pengguna tidak ditemukan.');
  return validateLockedUserLink(tx, user, kind, expectedLoginId, id);
}

export async function resolveUserLink(tx: ReturnType<typeof profileReferences>, kind: ProfileKind, expectedLoginId: string, id?: string) {
  const user = await tx.lockUserByLoginId(expectedLoginId);
  if (!user) return null;
  await validateLockedUserLink(tx, user, kind, expectedLoginId, id);
  return user.id;
}

export async function validateProgram(tx: ReturnType<typeof profileReferences>, id: string) {
  const program = await tx.lockProgram(id);
  if (!program) throw new MasterDataError(400, 'Program studi tidak ditemukan.');
  if (!program.isActive) throw new MasterDataError(400, 'Penugasan baru harus menggunakan program studi aktif.');
}

const duplicateMessages: Record<string, string> = {
  mahasiswa_nim_unique: 'NIM sudah digunakan oleh mahasiswa lain.',
  mahasiswa_user_id_unique: 'Akun sudah terhubung ke mahasiswa lain.',
  users_login_id_unique: 'Nomor Induk sudah digunakan oleh akun lain.',
  dosen_nik_unique: 'NIK sudah digunakan oleh dosen lain.',
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
