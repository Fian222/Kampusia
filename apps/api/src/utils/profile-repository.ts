import type { createDatabase } from '@kampusia/db';
import { dosen, mahasiswa, programStudi, users } from '@kampusia/db/schema';
import { eq } from 'drizzle-orm';
export type Database = ReturnType<typeof createDatabase>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function profileReferences(tx: Transaction) {
  return {
    async lockProgram(id: string) {
      const [row] = await tx.select().from(programStudi).where(eq(programStudi.id, id)).for('share');
      return row;
    },
    async lockUser(id: string) {
      const [row] = await tx.select({ id: users.id, loginId: users.loginId, email: users.email, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id)).for('update');
      return row;
    },
    async lockUserByLoginId(loginId: string) {
      const [row] = await tx.select({ id: users.id, loginId: users.loginId, email: users.email, role: users.role, isActive: users.isActive }).from(users).where(eq(users.loginId, loginId)).for('update');
      return row;
    },
    async loginIdOwner(loginId: string) {
      return (await tx.select({ id: users.id }).from(users).where(eq(users.loginId, loginId)).limit(1))[0];
    },
    async updateUserLoginId(id: string, loginId: string, updatedAt: Date) {
      return (await tx.update(users).set({ loginId, updatedAt }).where(eq(users.id, id)).returning({ id: users.id }))[0];
    },
    async userLinks(id: string) {
      const [student] = await tx.select({ id: mahasiswa.id }).from(mahasiswa).where(eq(mahasiswa.userId, id));
      const [lecturer] = await tx.select({ id: dosen.id }).from(dosen).where(eq(dosen.userId, id));
      return { mahasiswa: student?.id, dosen: lecturer?.id };
    },
  };
}
