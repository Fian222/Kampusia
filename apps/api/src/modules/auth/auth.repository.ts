import type { createDatabase } from '@kampusia/db';
import { userSession, users } from '@kampusia/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import type { AuthAccount } from './auth.model';

type Database = ReturnType<typeof createDatabase>['db'];
const profileNames = { mahasiswa: { columns: { nama: true } }, dosen: { columns: { nama: true } } } as const;

function toAccount(row: (typeof users.$inferSelect & { mahasiswa: { nama: string } | null; dosen: { nama: string } | null }) | undefined): AuthAccount | undefined {
  if (!row) return undefined;
  const { mahasiswa, dosen, ...account } = row;
  return { ...account, nama: mahasiswa?.nama ?? dosen?.nama ?? null };
}

export function createAuthRepository(db: Pick<Database, 'query' | 'update'>) {
  return {
    findByLoginId: async (loginId: string) => toAccount(await db.query.users.findFirst({ where: (user, { eq }) => eq(user.loginId, loginId), with: profileNames })),
    findById: async (id: string) => toAccount(await db.query.users.findFirst({ where: (user, { eq }) => eq(user.id, id), with: profileNames })),
    updatePassword: async (id: string, passwordHash: string) => (await db.update(users).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.isActive, true))).returning())[0],
  };
}
export type AuthRepository = ReturnType<typeof createAuthRepository>;

export function createSessionRepository(db: Pick<Database, 'query' | 'insert' | 'delete'>) {
  return {
    insert: async (values: Pick<typeof userSession.$inferInsert, 'userId' | 'tokenDigest' | 'passwordFingerprint' | 'expiresAt'>) => { await db.insert(userSession).values(values); },
    findByDigest: (tokenDigest: string) => db.query.userSession.findFirst({ where: (session, { eq }) => eq(session.tokenDigest, tokenDigest) }),
    deleteByDigest: async (tokenDigest: string) => { await db.delete(userSession).where(eq(userSession.tokenDigest, tokenDigest)); },
    deleteExpired: async (at: Date) => { await db.delete(userSession).where(lte(userSession.expiresAt, at)); },
  };
}
export type SessionRepository = ReturnType<typeof createSessionRepository>;
