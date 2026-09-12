import type { createDatabase } from '@kampusia/db';
import { kelasKuliah, kelasDosen, dosen, jadwalKuliah } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import { classAssignments } from '../kelas-kuliah/kelas-kuliah.repository';
import type { KelasDosenQuery } from './kelas-dosen.model';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
function transactionRepository(tx: Transaction) {
  return {
    async lockClass(id: string) { return (await tx.select().from(kelasKuliah).where(eq(kelasKuliah.id, id)).for('update'))[0]; },
    async lockDosen(id: string) { return (await tx.select().from(dosen).where(eq(dosen.id, id)).for('share'))[0]; },
    assignments: (id: string) => classAssignments(tx, [id]),
    async hasSchedule(id: string) { return (await tx.select({ id: jadwalKuliah.id }).from(jadwalKuliah).where(eq(jadwalKuliah.kelasKuliahId, id)).limit(1)).length > 0; },
    async create(kelasKuliahId: string, dosenId: string, isKoordinator: boolean) { return (await tx.insert(kelasDosen).values({ kelasKuliahId, dosenId, isKoordinator }).returning())[0]!; },
    async update(id: string, isKoordinator: boolean) { return (await tx.update(kelasDosen).set({ isKoordinator, updatedAt: new Date() }).where(eq(kelasDosen.id, id)).returning())[0]!; },
    async remove(id: string) { await tx.delete(kelasDosen).where(eq(kelasDosen.id, id)); },
  };
}
export function createKelasDosenRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async findClass(id: string) { return (await db.select({ id: kelasKuliah.id }).from(kelasKuliah).where(eq(kelasKuliah.id, id)))[0]; },
    async list(id: string, query: KelasDosenQuery) {
      const { page, limit } = pagination(query);
      const where = and(eq(kelasDosen.kelasKuliahId, id), query.search?.trim() ? or(ilike(dosen.kodeDosen, searchPattern(query.search)), ilike(dosen.nama, searchPattern(query.search))) : undefined);
      return db.transaction(async tx => {
        const data = await tx.select({ ...getTableColumns(kelasDosen), dosen: { id: dosen.id, kodeDosen: dosen.kodeDosen, nama: dosen.nama, isActive: dosen.isActive } }).from(kelasDosen).innerJoin(dosen, eq(kelasDosen.dosenId, dosen.id)).where(where).orderBy(asc(dosen.nama), asc(kelasDosen.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(kelasDosen).innerJoin(dosen, eq(kelasDosen.dosenId, dosen.id)).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) { return db.transaction(tx => operation(transactionRepository(tx)), { isolationLevel: 'serializable' }); },
  };
}
export type KelasDosenRepository = ReturnType<typeof createKelasDosenRepository>;
