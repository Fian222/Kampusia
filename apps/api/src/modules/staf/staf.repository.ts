import type { createDatabase } from '@kampusia/db';
import { users } from '@kampusia/db/schema';
import { and, asc, count, eq, ilike, inArray, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import { staffRoles, type StafQuery, type StaffRole } from './staf.model';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Safe staff account columns; the users UUID and password hash never leave the repository. */
const account = { loginId: users.loginId, email: users.email, role: users.role, isActive: users.isActive, mustChangePassword: users.mustChangePassword, createdAt: users.createdAt, updatedAt: users.updatedAt };

function transactionRepository(tx: Transaction) {
  return {
    async lockActiveAdmins() {
      return tx.select({ id: users.id }).from(users).where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true))).orderBy(asc(users.id)).for('update');
    },
    async lockByLoginId(loginId: string) {
      return (await tx.select({ id: users.id, ...account }).from(users).where(eq(users.loginId, loginId)).for('update'))[0];
    },
    async create(values: { loginId: string; email: string | null; role: StaffRole; passwordHash: string }) {
      return (await tx.insert(users).values({ ...values, isActive: true, mustChangePassword: true }).returning(account))[0]!;
    },
    async update(id: string, changes: Partial<{ email: string | null; role: StaffRole; isActive: boolean }>) {
      return (await tx.update(users).set({ ...changes, updatedAt: new Date() }).where(eq(users.id, id)).returning(account))[0]!;
    },
    async resetPassword(id: string, passwordHash: string) {
      return (await tx.update(users).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, id)).returning(account))[0]!;
    },
  };
}
export type StafTransaction = ReturnType<typeof transactionRepository>;

export function createStafRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    list(query: StafQuery) {
      const { page, limit } = pagination(query);
      const search = query.search?.trim();
      const where = and(
        inArray(users.role, query.role ? [query.role] : [...staffRoles]),
        query.is_active === undefined ? undefined : eq(users.isActive, query.is_active === 'true'),
        search ? or(ilike(users.loginId, searchPattern(search)), ilike(users.email, searchPattern(search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select(account).from(users).where(where).orderBy(asc(users.loginId), asc(users.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(users).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (tx: StafTransaction) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)), { isolationLevel: 'serializable' });
    },
  };
}
export type StafRepository = ReturnType<typeof createStafRepository>;
