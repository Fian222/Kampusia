import type { createDatabase } from '@kampusia/db';
import { ruangan, jadwalKuliah, kelasKuliah, semester } from '@kampusia/db/schema';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Omit<typeof ruangan.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
function transactionRepository(tx: Transaction) {
  return {
    async findById(id: string) { return (await tx.select().from(ruangan).where(eq(ruangan.id, id)).for('update'))[0]; },
    async schedules(id: string) {
      return tx.select({ kapasitas: kelasKuliah.kapasitas, status: kelasKuliah.status, hari: jadwalKuliah.hari, jamSelesai: jadwalKuliah.jamSelesai, tanggalMulai: semester.tanggalMulai, tanggalSelesai: semester.tanggalSelesai }).from(jadwalKuliah)
        .innerJoin(kelasKuliah, eq(jadwalKuliah.kelasKuliahId, kelasKuliah.id)).innerJoin(semester, eq(kelasKuliah.semesterId, semester.id)).where(eq(jadwalKuliah.ruanganId, id));
    },
    async create(input: Write) { return (await tx.insert(ruangan).values(input).returning())[0]!; },
    async update(id: string, input: Partial<Write>) { return (await tx.update(ruangan).set({ ...input, updatedAt: new Date() }).where(eq(ruangan.id, id)).returning())[0]!; },
  };
}
export function createRuanganRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async findById(id: string) { return (await db.select().from(ruangan).where(eq(ruangan.id, id)))[0]; },
    list(query: ListQuery) {
      const { page, limit } = pagination(query);
      const where = and(query.is_active === undefined ? undefined : eq(ruangan.isActive, query.is_active === 'true'), query.search?.trim() ? or(ilike(ruangan.kode, searchPattern(query.search)), ilike(ruangan.nama, searchPattern(query.search))) : undefined);
      return db.transaction(async tx => {
        const data = await tx.select().from(ruangan).where(where).orderBy(asc(ruangan.kode), asc(ruangan.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(ruangan).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (tx: ReturnType<typeof transactionRepository>) => Promise<T>) { return db.transaction(tx => operation(transactionRepository(tx)), { isolationLevel: 'serializable' }); },
  };
}
export type RuanganRepository = ReturnType<typeof createRuanganRepository>;
