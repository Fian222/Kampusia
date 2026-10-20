import { createHash, randomBytes } from 'node:crypto';
import { AuthError, sessionSeconds } from './auth.model';
import type { SessionRepository } from './auth.repository';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const validToken = (token: string | undefined): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));

export type Session = { userId: string; passwordVersion: string; expiresAt: number };
type MaybePromise<T> = T | Promise<T>;
export type SessionStore = {
  create(userId: string, passwordHash: string): MaybePromise<string>;
  get(token: string | undefined): MaybePromise<Session | undefined>;
  matchesPassword(session: Pick<Session, 'passwordVersion'>, hash: string): boolean;
  revoke(token: string | undefined): MaybePromise<void>;
};

const matchesPassword = (session: Pick<Session, 'passwordVersion'>, hash: string) => session.passwordVersion === digest(hash);

/** Process-local store for isolated tests; production uses the database-backed store. */
export function createSessionStore(now = Date.now) {
  const sessions = new Map<string, Session>();
  return {
    create(userId: string, passwordHash: string) {
      for (const [key, session] of sessions) if (session.expiresAt <= now()) sessions.delete(key);
      if (sessions.size >= 10000) throw new AuthError(503, 'Layanan masuk sedang sibuk. Silakan coba lagi.');
      const token = randomBytes(32).toString('hex');
      sessions.set(digest(token), { userId, passwordVersion: digest(passwordHash), expiresAt: now() + sessionSeconds * 1000 });
      return token;
    },
    get(token: string | undefined) {
      if (!validToken(token)) return undefined;
      const key = digest(token);
      const session = sessions.get(key);
      if (session && session.expiresAt <= now()) {
        sessions.delete(key);
        return undefined;
      }
      return session;
    },
    matchesPassword,
    revoke(token: string | undefined) {
      if (token) sessions.delete(digest(token));
    },
  } satisfies SessionStore;
}

/** Sessions stored as token digests in user_session, shared across API restarts and processes. */
export function createDatabaseSessionStore(repository: SessionRepository, now = Date.now): SessionStore {
  return {
    async create(userId, passwordHash) {
      await repository.deleteExpired(new Date(now()));
      const token = randomBytes(32).toString('hex');
      await repository.insert({
        userId,
        tokenDigest: digest(token),
        passwordFingerprint: digest(passwordHash),
        expiresAt: new Date(now() + sessionSeconds * 1000),
      });
      return token;
    },
    async get(token) {
      if (!validToken(token)) return undefined;
      const tokenDigest = digest(token);
      const row = await repository.findByDigest(tokenDigest);
      if (!row) return undefined;
      if (row.expiresAt.getTime() <= now()) {
        await repository.deleteByDigest(tokenDigest);
        return undefined;
      }
      return { userId: row.userId, passwordVersion: row.passwordFingerprint, expiresAt: row.expiresAt.getTime() };
    },
    matchesPassword,
    async revoke(token) {
      if (validToken(token)) await repository.deleteByDigest(digest(token));
    },
  };
}
