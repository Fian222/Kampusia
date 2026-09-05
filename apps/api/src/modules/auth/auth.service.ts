import { randomBytes } from 'node:crypto';
import { AuthError, type AuthUser, type AuthRecord } from './auth.model';
import type { AuthRepository } from './auth.repository';
import { createSessionStore } from './auth.session';

const safeUser = (record: AuthRecord): AuthUser => ({ id: record.id, email: record.email, role: record.role });

export function createAuthService(repository: AuthRepository, sessions = createSessionStore()) {
  const dummyHash = Bun.password.hash(randomBytes(32).toString('hex'), { algorithm: 'argon2id' });
  const attempts = new Map<string, { count: number; until: number }>();
  return {
    async login(emailInput: string, password: string, previousToken?: string) {
      const email = emailInput.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, 'Masukkan alamat email yang valid.');
      const now = Date.now();
      for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
      const attempt = attempts.get(email) ?? { count: 0, until: now + 15 * 60 * 1000 };
      if (attempt.count >= 20 || (!attempts.has(email) && attempts.size >= 10000)) {
        throw new AuthError(429, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
      }
      attempt.count++;
      attempts.set(email, attempt);
      const record = await repository.findByEmail(email);
      // Unknown emails still perform a real password verification.
      const valid = await Bun.password.verify(password, record?.passwordHash ?? await dummyHash).catch(() => false);
      if (!record || !valid || !record.isActive) throw new AuthError(401, 'Email atau kata sandi salah.');
      const token = sessions.create(record.id, record.passwordHash);
      sessions.revoke(previousToken);
      attempts.delete(email);
      return { user: safeUser(record), token };
    },
    async current(token: string | undefined): Promise<AuthUser | null> {
      const session = sessions.get(token);
      if (!session) return null;
      const record = await repository.findById(session.userId);
      if (!record?.isActive || !sessions.matchesPassword(session, record.passwordHash)) {
        sessions.revoke(token);
        return null;
      }
      return safeUser(record);
    },
    logout: (token: string | undefined) => sessions.revoke(token),
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
