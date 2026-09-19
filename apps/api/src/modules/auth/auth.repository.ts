import type { createDatabase } from '@kampusia/db';
import { users } from '@kampusia/db/schema';
import { and, eq } from 'drizzle-orm';

export function createAuthRepository(db: Pick<ReturnType<typeof createDatabase>['db'], 'query' | 'update'>) {
  return {
    findByLoginId: async (loginId: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.loginId, loginId) }),
    findById: async (id: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.id, id) }),
    updatePassword: async (id: string, passwordHash: string) => (await db.update(users).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.isActive, true))).returning())[0],
  };
}
export type AuthRepository = ReturnType<typeof createAuthRepository>;
