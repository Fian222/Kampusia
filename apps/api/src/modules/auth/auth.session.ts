import { createHash, randomBytes } from 'node:crypto';
import { AuthError, sessionSeconds } from './auth.model';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export function createSessionStore(now = Date.now) {
  const sessions = new Map<string, { userId: string; passwordVersion: string; expiresAt: number }>();
  return {
    create(userId: string, passwordHash: string) {
      for (const [key, session] of sessions) if (session.expiresAt <= now()) sessions.delete(key);
      if (sessions.size >= 10000) throw new AuthError(503, 'Layanan masuk sedang sibuk. Silakan coba lagi.');
      const token = randomBytes(32).toString('hex');
      sessions.set(digest(token), { userId, passwordVersion: digest(passwordHash), expiresAt: now() + sessionSeconds * 1000 });
      return token;
    },
    get(token: string | undefined) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
      const key = digest(token);
      const session = sessions.get(key);
      if (session && session.expiresAt <= now()) {
        sessions.delete(key);
        return undefined;
      }
      return session;
    },
    matchesPassword(session: { passwordVersion: string }, hash: string) {
      return session.passwordVersion === digest(hash);
    },
    revoke(token: string | undefined) {
      if (token) sessions.delete(digest(token));
    },
  };
}
