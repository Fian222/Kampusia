import { generateTemporaryPassword, hashPassword } from '../auth/password';
import type { AuthUser } from '../auth/auth.model';
import { academicWrite } from '../../utils/academic-write';
import { MasterDataError, requirePatch } from '../../utils/master-data';
import { normalizeIdentity } from '../../utils/profile-service';
import { staffRoles, type StafInput, type StafPatch } from './staf.model';
import type { StafRepository, StafTransaction } from './staf.repository';

function normalizeEmail(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const email = value?.trim().toLowerCase() ?? '';
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MasterDataError(400, 'Format email tidak valid.');
  return email;
}

export function createStafService(repository: StafRepository) {
  async function lockStaff(tx: StafTransaction, loginId: string) {
    const target = await tx.lockByLoginId(normalizeIdentity(loginId, 'NIK'));
    if (!target || !staffRoles.includes(target.role as (typeof staffRoles)[number])) throw new MasterDataError(404, 'Akun staf tidak ditemukan.');
    return target;
  }
  return {
    list: repository.list,

    async create(input: StafInput) {
      const loginId = normalizeIdentity(input.login_id, 'NIK');
      const email = normalizeEmail(input.email) ?? null;
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      return academicWrite(() => repository.transaction(async tx => {
        if (await tx.lockByLoginId(loginId)) throw new MasterDataError(409, 'Nomor Induk sudah digunakan oleh akun lain.');
        return { account: await tx.create({ loginId, email, role: input.role, passwordHash }), temporaryPassword };
      }));
    },

    update(actor: AuthUser, loginId: string, input: StafPatch) {
      requirePatch(input);
      const email = normalizeEmail(input.email);
      return academicWrite(() => repository.transaction(async tx => {
        // Lock active ADMIN rows before the target so concurrent demotions serialize in one order.
        const activeAdmins = await tx.lockActiveAdmins();
        const target = await lockStaff(tx, loginId);
        const removesAdmin = target.role === 'ADMIN' && target.isActive && (input.is_active === false || (input.role !== undefined && input.role !== 'ADMIN'));
        if (removesAdmin && target.id === actor.id) throw new MasterDataError(409, 'Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.');
        if (removesAdmin && !activeAdmins.some(admin => admin.id !== target.id)) throw new MasterDataError(409, 'Minimal harus ada satu ADMIN aktif.');
        return tx.update(target.id, {
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
        });
      }));
    },

    async resetPassword(actor: AuthUser, loginId: string) {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      return academicWrite(() => repository.transaction(async tx => {
        const target = await lockStaff(tx, loginId);
        if (target.id === actor.id) throw new MasterDataError(409, 'Gunakan menu Ganti kata sandi untuk akun Anda sendiri.');
        return { account: await tx.resetPassword(target.id, passwordHash), temporaryPassword };
      }));
    },
  };
}
export type StafService = ReturnType<typeof createStafService>;
