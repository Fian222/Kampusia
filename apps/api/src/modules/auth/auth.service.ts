import { randomBytes } from 'node:crypto';
import { AuthError, type AuthRecord, type SessionUser } from './auth.model';
import { createSessionStore, type SessionStore } from './auth.session';
import { hashPassword, validateNewPassword } from './password';

type AuthServiceRecord = AuthRecord & { nama?: string | null };
const safeUser = (record: AuthServiceRecord & { loginId: string }): SessionUser => ({
  id: record.id, loginId: record.loginId, email: record.email, role: record.role, mustChangePassword: record.mustChangePassword, nama: record.nama ?? null,
});

type AuthServiceRepository = {
  findByLoginId(loginId: string): Promise<AuthServiceRecord | undefined>;
  findById(id: string): Promise<AuthServiceRecord | undefined>;
  updatePassword?(id: string, passwordHash: string): Promise<AuthRecord | undefined>;
};
export function createAuthService(repository: AuthServiceRepository, sessions: SessionStore = createSessionStore()) {
  const dummyHash = Bun.password.hash(randomBytes(32).toString('hex'), { algorithm: 'argon2id' });
  const attempts = new Map<string, { count: number; until: number }>();
  function countAttempt(key: string, message: string) {
    const now = Date.now();
    for (const [entryKey, entry] of attempts) if (entry.until <= now) attempts.delete(entryKey);
    const attempt = attempts.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) throw new AuthError(429, message);
    attempt.count++;
    attempts.set(key, attempt);
  }
  return {
    async login(loginIdInput: string, password: string, previousToken?: string) {
      const loginId = loginIdInput.trim();
      if (!/^[0-9]{1,30}$/.test(loginId)) throw new AuthError(400, 'Nomor Induk harus terdiri dari 1–30 digit.');
      countAttempt(loginId, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
      const record = await repository.findByLoginId(loginId);
      // Unknown identifiers still perform a real password verification.
      const valid = await Bun.password.verify(password, record?.passwordHash ?? await dummyHash).catch(() => false);
      if (!record?.loginId || !valid || !record.isActive) throw new AuthError(401, 'Nomor Induk atau kata sandi salah.');
      const token = await sessions.create(record.id, record.passwordHash);
      await sessions.revoke(previousToken);
      attempts.delete(loginId);
      return { user: safeUser(record as AuthServiceRecord & { loginId: string }), token };
    },
    async current(token: string | undefined): Promise<SessionUser | null> {
      const session = await sessions.get(token);
      if (!session) return null;
      const record = await repository.findById(session.userId);
      if (!record?.isActive || !record.loginId || !sessions.matchesPassword(session, record.passwordHash)) {
        await sessions.revoke(token);
        return null;
      }
      return safeUser(record as AuthServiceRecord & { loginId: string });
    },
    /**
     * Replaces the account password and rotates the presented session. A temporary-password
     * account proves possession through its session; every other account must also confirm
     * its current password.
     */
    async changePassword(userId: string, password: string, confirmation: string, previousToken?: string, currentPassword?: string) {
      validateNewPassword(password, confirmation);
      if (!repository.updatePassword) throw new AuthError(503, 'Layanan perubahan kata sandi tidak tersedia.');
      const account = await repository.findById(userId);
      if (!account?.isActive || !account.loginId) throw new AuthError(401, 'Silakan masuk untuk melanjutkan.');
      if (!account.mustChangePassword) {
        if (!currentPassword) throw new AuthError(400, 'Masukkan kata sandi saat ini.');
        countAttempt('change:' + userId, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
        if (!await Bun.password.verify(currentPassword, account.passwordHash).catch(() => false)) throw new AuthError(400, 'Kata sandi saat ini salah.');
        attempts.delete('change:' + userId);
        if (password === currentPassword) throw new AuthError(400, 'Kata sandi baru harus berbeda dari kata sandi saat ini.');
      }
      const passwordHash = await hashPassword(password);
      const updated = await repository.updatePassword(userId, passwordHash);
      if (!updated?.isActive || !updated.loginId) throw new AuthError(401, 'Silakan masuk untuk melanjutkan.');
      const token = await sessions.create(updated.id, updated.passwordHash);
      await sessions.revoke(previousToken);
      return { user: safeUser({ ...updated, nama: account.nama } as AuthServiceRecord & { loginId: string }), token };
    },
    logout: async (token: string | undefined) => { await sessions.revoke(token); },
  };
}
type BuiltAuthService = ReturnType<typeof createAuthService>;
export type AuthService = Omit<BuiltAuthService, 'changePassword' | 'logout'> & {
  changePassword?: BuiltAuthService['changePassword'];
  logout(token: string | undefined): void | Promise<void>;
};
