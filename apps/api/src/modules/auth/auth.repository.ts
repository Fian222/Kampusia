import type { createDatabase } from '@kampusia/db';

export function createAuthRepository(db: ReturnType<typeof createDatabase>['db']) {
  return {
    findByEmail: async (email: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.email, email) }),
    findById: async (id: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.id, id) }),
  };
}
export type AuthRepository = ReturnType<typeof createAuthRepository>;
