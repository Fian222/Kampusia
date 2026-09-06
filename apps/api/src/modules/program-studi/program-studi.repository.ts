import type { createDatabase } from '@kampusia/db';
import { fakultas, programStudi } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import type { ProgramStudiQuery } from './program-studi.model';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Pick<typeof programStudi.$inferInsert, 'kode' | 'nama' | 'fakultasId' | 'jenjang' | 'isActive'>;
const selection = { ...getTableColumns(programStudi), fakultas: { id: fakultas.id, kode: fakultas.kode, nama: fakultas.nama, isActive: fakultas.isActive } };

function transactionRepository(tx: Transaction) {
  return {
    async findById(id: string) {
      const [row] = await tx.select().from(programStudi).where(eq(programStudi.id, id)).for('update');
      return row;
    },
    async lockFakultas(id: string) {
      const [row] = await tx.select().from(fakultas).where(eq(fakultas.id, id)).for('share');
      return row;
    },
    async create(input: Write) {
      const [row] = await tx.insert(programStudi).values(input).returning();
      return row!;
    },
    async update(id: string, input: Partial<Write> & { updatedAt: Date }) {
      const [row] = await tx.update(programStudi).set(input).where(eq(programStudi.id, id)).returning();
      return row!;
    },
  };
}
export function createProgramStudiRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async list(query: ProgramStudiQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.is_active === undefined ? undefined : eq(programStudi.isActive, query.is_active === 'true'),
        query.fakultas_id ? eq(programStudi.fakultasId, query.fakultas_id) : undefined,
        query.jenjang ? eq(programStudi.jenjang, query.jenjang) : undefined,
        query.search?.trim() ? or(ilike(programStudi.kode, searchPattern(query.search)), ilike(programStudi.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select(selection).from(programStudi).innerJoin(fakultas, eq(programStudi.fakultasId, fakultas.id))
          .where(where).orderBy(asc(programStudi.kode), asc(programStudi.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(programStudi).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) {
      const [row] = await db.select(selection).from(programStudi).innerJoin(fakultas, eq(programStudi.fakultasId, fakultas.id)).where(eq(programStudi.id, id));
      return row;
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type ProgramStudiRepository = ReturnType<typeof createProgramStudiRepository>;
