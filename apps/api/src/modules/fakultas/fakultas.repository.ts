import type { createDatabase } from '@kampusia/db';
import { fakultas } from '@kampusia/db/schema';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';

export function createFakultasRepository(db: Pick<ReturnType<typeof createDatabase>['db'], 'select' | 'insert' | 'update' | 'query' | 'transaction'>) {
  return {
    async list(query: ListQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.is_active === undefined ? undefined : eq(fakultas.isActive, query.is_active === 'true'),
        query.search?.trim() ? or(ilike(fakultas.kode, searchPattern(query.search)), ilike(fakultas.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select().from(fakultas).where(where).orderBy(asc(fakultas.kode), asc(fakultas.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(fakultas).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) { return db.query.fakultas.findFirst({ where: eq(fakultas.id, id) }); },
    async create(input: Pick<typeof fakultas.$inferInsert, 'kode' | 'nama' | 'isActive'>) {
      const [row] = await db.insert(fakultas).values(input).returning();
      return row!;
    },
    async update(id: string, input: Partial<Pick<typeof fakultas.$inferInsert, 'kode' | 'nama' | 'isActive'>> & { updatedAt: Date }) {
      const [row] = await db.update(fakultas).set(input).where(eq(fakultas.id, id)).returning();
      return row;
    },
  };
}
export type FakultasRepository = ReturnType<typeof createFakultasRepository>;
