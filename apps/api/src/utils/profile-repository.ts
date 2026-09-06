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
      const [row] = await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id)).for('update');
      return row;
    },
    async userLinks(id: string) {
      const [student] = await tx.select({ id: mahasiswa.id }).from(mahasiswa).where(eq(mahasiswa.userId, id));
      const [lecturer] = await tx.select({ id: dosen.id }).from(dosen).where(eq(dosen.userId, id));
      return { mahasiswa: student?.id, dosen: lecturer?.id };
    },
  };
}
