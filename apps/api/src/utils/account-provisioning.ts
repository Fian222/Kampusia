import type { AuthRecord } from '../modules/auth/auth.model';
import { generateTemporaryPassword, hashPassword } from '../modules/auth/password';
import { MasterDataError } from './master-data';
import { normalizeIdentity, validateUserLink, withProfileConstraints } from './profile-service';

type ProfileKind = 'mahasiswa' | 'dosen';
type Role = Extract<AuthRecord['role'], 'MAHASISWA' | 'DOSEN'>;
type Profile = { id: string; userId: string | null; identity: string | null };
type AccountTransaction = {
  lockUserByLoginId(loginId: string): Promise<Pick<AuthRecord, 'id' | 'loginId' | 'email' | 'role' | 'isActive'> | undefined>;
  lockUser(id: string): Promise<Pick<AuthRecord, 'id' | 'loginId' | 'email' | 'role' | 'isActive'> | undefined>;
  userLinks(id: string): Promise<{ mahasiswa: string | undefined; dosen: string | undefined }>;
  createUser(input: Pick<AuthRecord, 'loginId' | 'passwordHash' | 'role' | 'isActive' | 'mustChangePassword'>): Promise<Pick<AuthRecord, 'id' | 'loginId' | 'role' | 'isActive'>>;
  linkUser(id: string, userId: string, updatedAt: Date): Promise<{ id: string } | undefined>;
  updateAccountPassword(id: string, passwordHash: string, updatedAt: Date): Promise<Pick<AuthRecord, 'id' | 'loginId' | 'role' | 'isActive'> | undefined>;
};

const roleFor = (kind: ProfileKind): Role => kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN';
const labelFor = (kind: ProfileKind) => kind === 'mahasiswa' ? 'NIM' : 'NIK';

export async function provisionAcademicAccount(
  transaction: <T>(operation: (tx: AccountTransaction & { findById(id: string): Promise<unknown> }) => Promise<T>) => Promise<T>,
  kind: ProfileKind,
  id: string,
  readProfile: (value: unknown) => Profile | undefined,
) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return withProfileConstraints(() => transaction(async tx => {
    const profile = readProfile(await tx.findById(id));
    if (!profile) throw new MasterDataError(404, kind === 'mahasiswa' ? 'Mahasiswa tidak ditemukan.' : 'Dosen tidak ditemukan.');
    if (profile.userId) throw new MasterDataError(409, 'Profil sudah memiliki akun login.');
    if (!profile.identity) throw new MasterDataError(400, `${labelFor(kind)} wajib diisi sebelum membuat akun login.`);
    const loginId = normalizeIdentity(profile.identity, labelFor(kind));
    const existing = await tx.lockUserByLoginId(loginId);
    if (existing) {
      await validateUserLink(tx, existing.id, kind, loginId, id);
      if (!await tx.linkUser(id, existing.id, new Date())) throw new MasterDataError(409, 'Profil sudah memiliki akun login.');
      return { account: { loginId, role: roleFor(kind), isActive: existing.isActive }, temporaryPassword: null, created: false as const };
    }
    const account = await tx.createUser({ loginId, passwordHash, role: roleFor(kind), isActive: true, mustChangePassword: true });
    if (!await tx.linkUser(id, account.id, new Date())) throw new MasterDataError(409, 'Profil sudah memiliki akun login.');
    return { account: { loginId, role: roleFor(kind), isActive: true }, temporaryPassword, created: true as const };
  }));
}

export async function resetAcademicPassword(
  transaction: <T>(operation: (tx: AccountTransaction & { findById(id: string): Promise<unknown> }) => Promise<T>) => Promise<T>,
  kind: ProfileKind,
  id: string,
  readProfile: (value: unknown) => Profile | undefined,
) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  return withProfileConstraints(() => transaction(async tx => {
    const profile = readProfile(await tx.findById(id));
    if (!profile) throw new MasterDataError(404, kind === 'mahasiswa' ? 'Mahasiswa tidak ditemukan.' : 'Dosen tidak ditemukan.');
    if (!profile.userId) throw new MasterDataError(409, 'Profil belum memiliki akun login.');
    if (!profile.identity) throw new MasterDataError(409, `Akun terhubung tidak memiliki ${labelFor(kind)} yang selaras.`);
    const loginId = normalizeIdentity(profile.identity, labelFor(kind));
    await validateUserLink(tx, profile.userId, kind, loginId, id);
    const account = await tx.updateAccountPassword(profile.userId, passwordHash, new Date());
    if (!account) throw new MasterDataError(409, 'Akun login tidak lagi tersedia. Muat ulang halaman dan coba lagi.');
    return { account: { loginId, role: roleFor(kind), isActive: account.isActive }, temporaryPassword };
  }));
}
