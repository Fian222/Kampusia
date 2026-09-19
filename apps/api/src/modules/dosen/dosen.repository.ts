import { dosen, programStudi, users } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import { profileReferences, type Database, type Transaction } from '../../utils/profile-repository';
import type { DosenQuery } from './dosen.model';

type Write = Pick<typeof dosen.$inferInsert, 'userId' | 'programStudiId' | 'nik' | 'kodeDosen' | 'nidn' | 'nama' | 'isActive'>;
const { userId: privateUserId, ...profileColumns } = getTableColumns(dosen);
void privateUserId;
const selection = {
  ...profileColumns,
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama, isActive: programStudi.isActive },
  account: { loginId: users.loginId, email: users.email, isActive: users.isActive },
};
function transactionRepository(tx: Transaction) {
  return {
    ...profileReferences(tx),
    async findById(id: string) {
      const [row] = await tx.select().from(dosen).where(eq(dosen.id, id)).for('update');
      return row;
    },
    async nikOwner(nik: string) {
      return (await tx.select({ id: dosen.id }).from(dosen).where(eq(dosen.nik, nik)).limit(1))[0];
    },
    async create(input: Write) {
      const [row] = await tx.insert(dosen).values(input).returning();
      return row!;
    },
    async update(id: string, input: Partial<Write> & { updatedAt: Date }) {
      const [row] = await tx.update(dosen).set(input).where(eq(dosen.id, id)).returning();
      return row!;
    },
  };
}
export function createDosenRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async list(query: DosenQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.program_studi_id ? eq(dosen.programStudiId, query.program_studi_id) : undefined,
        query.is_active === undefined ? undefined : eq(dosen.isActive, query.is_active === 'true'),
        query.search?.trim() ? or(ilike(dosen.nik, searchPattern(query.search)), ilike(dosen.kodeDosen, searchPattern(query.search)), ilike(dosen.nidn, searchPattern(query.search)), ilike(dosen.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select(selection).from(dosen).leftJoin(programStudi, eq(dosen.programStudiId, programStudi.id)).leftJoin(users, eq(dosen.userId, users.id))
          .where(where).orderBy(asc(dosen.kodeDosen), asc(dosen.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(dosen).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) {
      const [row] = await db.select(selection).from(dosen).leftJoin(programStudi, eq(dosen.programStudiId, programStudi.id)).leftJoin(users, eq(dosen.userId, users.id)).where(eq(dosen.id, id));
      return row;
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type DosenRepository = ReturnType<typeof createDosenRepository>;
