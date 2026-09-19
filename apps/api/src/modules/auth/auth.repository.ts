import type { createDatabase } from '@kampusia/db';

export function createAuthRepository(db: ReturnType<typeof createDatabase>['db']) {
  return {
    findByLoginId: async (loginId: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.loginId, loginId) }),
    findById: async (id: string) => await db.query.users.findFirst({ where: (user, { eq }) => eq(user.id, id) }),
  };
}
export type AuthRepository = ReturnType<typeof createAuthRepository>;
