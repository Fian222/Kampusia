import type { createDatabase } from '@kampusia/db';
import { semester, kelasKuliah, jadwalKuliah, krs } from '@kampusia/db/schema';
import { and, asc, count, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import type { SemesterQuery } from './semester.model';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Omit<typeof semester.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
function transactionRepository(tx: Transaction) {
  return {
    // Serialize active-term switches even when there is no active row yet.
    async lockActivation() { await tx.execute(sql`SELECT pg_advisory_xact_lock(20260912, 1)`); },
    async findById(id: string) { return (await tx.select().from(semester).where(eq(semester.id, id)).for('update'))[0]; },
    async hasHistory(id: string) {
      const approved = await tx.select({ id: krs.id }).from(krs).where(and(eq(krs.semesterId, id), or(eq(krs.status, 'DISETUJUI'), isNotNull(krs.disetujuiAt)))).limit(1);
      const schedules = await tx.select({ id: jadwalKuliah.id }).from(jadwalKuliah).innerJoin(kelasKuliah, eq(jadwalKuliah.kelasKuliahId, kelasKuliah.id)).where(eq(kelasKuliah.semesterId, id)).limit(1);
      return approved.length > 0 || schedules.length > 0;
    },
    async deactivate() { await tx.update(semester).set({ isActive: false, updatedAt: new Date() }).where(eq(semester.isActive, true)); },
    async create(input: Write) { return (await tx.insert(semester).values(input).returning())[0]!; },
    async update(id: string, input: Partial<Write>) { return (await tx.update(semester).set({ ...input, updatedAt: new Date() }).where(eq(semester.id, id)).returning())[0]!; },
  };
}
export function createSemesterRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async list(query: SemesterQuery) {
      const { page, limit } = pagination(query);
      const where = and(query.jenis ? eq(semester.jenis, query.jenis) : undefined, query.tahun_mulai !== undefined ? eq(semester.tahunMulai, query.tahun_mulai) : undefined,
        query.is_active === undefined ? undefined : eq(semester.isActive, query.is_active === 'true'),
        query.search?.trim() ? or(ilike(semester.kode, searchPattern(query.search)), ilike(semester.nama, searchPattern(query.search))) : undefined);
      return db.transaction(async tx => {
        const data = await tx.select().from(semester).where(where).orderBy(asc(semester.kode), asc(semester.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(semester).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) { return (await db.select().from(semester).where(eq(semester.id, id)))[0]; },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)), { isolationLevel: 'serializable' });
    },
  };
}
export type SemesterRepository = ReturnType<typeof createSemesterRepository>;
