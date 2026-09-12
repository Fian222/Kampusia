import type { createDatabase } from '@kampusia/db';
import { mataKuliah, kurikulumMatkul, kelasKuliah } from '@kampusia/db/schema';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Pick<typeof mataKuliah.$inferInsert, 'kode' | 'nama' | 'sks' | 'isActive'>;
function transactionRepository(tx: Transaction) {
  return {
    async findById(id: string) {
      const [row] = await tx.select().from(mataKuliah).where(eq(mataKuliah.id, id)).for('update');
      return row;
    },
    async hasHistory(id: string) {
      const [membership] = await tx.select({ id: kurikulumMatkul.id }).from(kurikulumMatkul).where(eq(kurikulumMatkul.mataKuliahId, id)).limit(1);
      const [offering] = await tx.select({ id: kelasKuliah.id }).from(kelasKuliah).where(eq(kelasKuliah.mataKuliahId, id)).limit(1);
      return !!(membership || offering);
    },
    async create(input: Write) { const [row] = await tx.insert(mataKuliah).values(input).returning(); return row!; },
    async update(id: string, input: Partial<Write> & { updatedAt: Date }) {
      const [row] = await tx.update(mataKuliah).set(input).where(eq(mataKuliah.id, id)).returning(); return row!;
    },
  };
}
export function createMataKuliahRepository(db: Pick<Database, 'select' | 'query' | 'transaction'>) {
  return {
    async list(query: ListQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.is_active === undefined ? undefined : eq(mataKuliah.isActive, query.is_active === 'true'),
        query.search?.trim() ? or(ilike(mataKuliah.kode, searchPattern(query.search)), ilike(mataKuliah.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select().from(mataKuliah).where(where).orderBy(asc(mataKuliah.kode), asc(mataKuliah.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(mataKuliah).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) { return db.query.mataKuliah.findFirst({ where: eq(mataKuliah.id, id) }); },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type MataKuliahRepository = ReturnType<typeof createMataKuliahRepository>;
