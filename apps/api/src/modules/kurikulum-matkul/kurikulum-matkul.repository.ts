import { kurikulum, kurikulumMatkul, mataKuliah, mahasiswa, kelasKuliah } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import type { Database, Transaction } from '../../utils/profile-repository';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';

type Write = Pick<typeof kurikulumMatkul.$inferInsert, 'kurikulumId' | 'mataKuliahId' | 'semesterRekomendasi' | 'isWajib'>;
const selection = { ...getTableColumns(kurikulumMatkul), mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks, isActive: mataKuliah.isActive } };
function transactionRepository(tx: Transaction) {
  return {
    async lockKurikulum(id: string) {
      const [row] = await tx.select().from(kurikulum).where(eq(kurikulum.id, id)).for('update'); return row;
    },
    async lockMataKuliah(id: string) {
      const [row] = await tx.select().from(mataKuliah).where(eq(mataKuliah.id, id)).for('share'); return row;
    },
    async hasStudents(id: string) {
      const [row] = await tx.select({ id: mahasiswa.id }).from(mahasiswa).where(eq(mahasiswa.kurikulumId, id)).limit(1); return !!row;
    },
    async hasOfferingHistory(courseId: string, programId: string) {
      const [row] = await tx.select({ id: kelasKuliah.id }).from(kelasKuliah).where(and(eq(kelasKuliah.mataKuliahId, courseId), eq(kelasKuliah.programStudiId, programId))).limit(1); return !!row;
    },
    async findMembership(id: string, membershipId: string) {
      const [row] = await tx.select().from(kurikulumMatkul).where(and(eq(kurikulumMatkul.kurikulumId, id), eq(kurikulumMatkul.id, membershipId))).for('update'); return row;
    },
    async create(input: Write) { const [row] = await tx.insert(kurikulumMatkul).values(input).returning(); return row!; },
    async update(id: string, input: Partial<Pick<Write, 'semesterRekomendasi' | 'isWajib'>> & { updatedAt: Date }) {
      const [row] = await tx.update(kurikulumMatkul).set(input).where(eq(kurikulumMatkul.id, id)).returning(); return row!;
    },
    async remove(id: string) { await tx.delete(kurikulumMatkul).where(eq(kurikulumMatkul.id, id)); },
  };
}
export function createKurikulumMatkulRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async findKurikulum(id: string) { const [row] = await db.select().from(kurikulum).where(eq(kurikulum.id, id)); return row; },
    async list(id: string, query: ListQuery) {
      const { page, limit } = pagination(query);
      const where = and(eq(kurikulumMatkul.kurikulumId, id),
        query.search?.trim() ? or(ilike(mataKuliah.kode, searchPattern(query.search)), ilike(mataKuliah.nama, searchPattern(query.search))) : undefined,
        query.is_active === undefined ? undefined : eq(mataKuliah.isActive, query.is_active === 'true'));
      return db.transaction(async tx => {
        const data = await tx.select(selection).from(kurikulumMatkul).innerJoin(mataKuliah, eq(kurikulumMatkul.mataKuliahId, mataKuliah.id))
          .where(where).orderBy(asc(mataKuliah.kode), asc(kurikulumMatkul.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(kurikulumMatkul).innerJoin(mataKuliah, eq(kurikulumMatkul.mataKuliahId, mataKuliah.id)).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type KurikulumMatkulRepository = ReturnType<typeof createKurikulumMatkulRepository>;
