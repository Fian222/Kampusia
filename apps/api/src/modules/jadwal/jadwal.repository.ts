import type { createDatabase } from '@kampusia/db';
import { jadwalKuliah, kelasKuliah, semester, ruangan, kelasDosen, krs, krsDetail } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, inArray, lt, gt, lte, gte, ne, or } from 'drizzle-orm';
import { pagination, type ListQuery } from '../../utils/master-data';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Slot = typeof jadwalKuliah.$inferInsert;
const selection = { ...getTableColumns(jadwalKuliah), ruangan: { id: ruangan.id, kode: ruangan.kode, nama: ruangan.nama, gedung: ruangan.gedung, kapasitas: ruangan.kapasitas, isActive: ruangan.isActive } };

// Reused by class and teaching-assignment services within their own transaction.
export function schedulingRepository(tx: Transaction) {
  return {
    async lockClass(id: string) { return (await tx.select().from(kelasKuliah).where(eq(kelasKuliah.id, id)).for('update'))[0]; },
    async term(id: string) { return (await tx.select().from(semester).where(eq(semester.id, id)).for('share'))[0]; },
    async room(id: string) { return (await tx.select().from(ruangan).where(eq(ruangan.id, id)).for('share'))[0]; },
    slots: async (id: string) => tx.select().from(jadwalKuliah).where(eq(jadwalKuliah.kelasKuliahId, id)).orderBy(asc(jadwalKuliah.id)),
    lecturers: async (ids: string[]) => ids.length ? tx.select({ kelasKuliahId: kelasDosen.kelasKuliahId, dosenId: kelasDosen.dosenId }).from(kelasDosen).where(inArray(kelasDosen.kelasKuliahId, ids)) : Promise.resolve([]),
    async approvedPeerClasses(id: string) {
      const students = tx.select({ id: krs.mahasiswaId }).from(krs).innerJoin(krsDetail, eq(krsDetail.krsId, krs.id)).where(and(eq(krsDetail.kelasKuliahId, id), eq(krsDetail.status, 'AKTIF'), eq(krs.status, 'DISETUJUI')));
      return tx.selectDistinct({ id: krsDetail.kelasKuliahId }).from(krsDetail).innerJoin(krs, eq(krsDetail.krsId, krs.id)).where(and(inArray(krs.mahasiswaId, students), eq(krs.status, 'DISETUJUI'), eq(krsDetail.status, 'AKTIF'), ne(krsDetail.kelasKuliahId, id)));
    },
    async hasApprovalHistory(id: string) {
      const rows = await tx.select({ approvedAt: krs.disetujuiAt }).from(krsDetail).innerJoin(krs, eq(krsDetail.krsId, krs.id)).where(eq(krsDetail.kelasKuliahId, id));
      return rows.some(row => row.approvedAt !== null);
    },
    async candidates(slot: Pick<Slot, 'hari' | 'jamMulai' | 'jamSelesai'>, dates: { tanggalMulai: string; tanggalSelesai: string }, classId: string) {
      return tx.select({ ...getTableColumns(jadwalKuliah), tanggalMulai: semester.tanggalMulai, tanggalSelesai: semester.tanggalSelesai }).from(jadwalKuliah)
        .innerJoin(kelasKuliah, eq(jadwalKuliah.kelasKuliahId, kelasKuliah.id)).innerJoin(semester, eq(kelasKuliah.semesterId, semester.id))
        .where(and(or(ne(kelasKuliah.status, 'DIBATALKAN'), eq(kelasKuliah.id, classId)), eq(jadwalKuliah.hari, slot.hari), lt(jadwalKuliah.jamMulai, slot.jamSelesai), gt(jadwalKuliah.jamSelesai, slot.jamMulai), lte(semester.tanggalMulai, dates.tanggalSelesai), gte(semester.tanggalSelesai, dates.tanggalMulai)));
    },
    async create(input: Slot) { return (await tx.insert(jadwalKuliah).values(input).returning())[0]!; },
    async update(id: string, input: Partial<Slot>) { return (await tx.update(jadwalKuliah).set({ ...input, updatedAt: new Date() }).where(eq(jadwalKuliah.id, id)).returning())[0]!; },
    async remove(id: string) { await tx.delete(jadwalKuliah).where(eq(jadwalKuliah.id, id)); },
  };
}
export type SchedulingRepository = ReturnType<typeof schedulingRepository>;
export function createJadwalRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async findClass(id: string) { return (await db.select({ id: kelasKuliah.id }).from(kelasKuliah).where(eq(kelasKuliah.id, id)))[0]; },
    list(id: string, query: ListQuery) {
      const { page, limit } = pagination(query);
      return db.transaction(async tx => {
        const where = eq(jadwalKuliah.kelasKuliahId, id);
        const data = await tx.select(selection).from(jadwalKuliah).innerJoin(ruangan, eq(jadwalKuliah.ruanganId, ruangan.id)).where(where).orderBy(asc(jadwalKuliah.hari), asc(jadwalKuliah.jamMulai), asc(jadwalKuliah.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(jadwalKuliah).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (tx: SchedulingRepository) => Promise<T>) { return db.transaction(tx => operation(schedulingRepository(tx)), { isolationLevel: 'serializable' }); },
  };
}
export type JadwalRepository = ReturnType<typeof createJadwalRepository>;
