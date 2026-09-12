import type { createDatabase } from '@kampusia/db';
import { programStudi, kurikulum, mahasiswa, kurikulumMatkul, kelasKuliah } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import type { KurikulumQuery } from './kurikulum.model';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Pick<typeof kurikulum.$inferInsert, 'kode' | 'nama' | 'programStudiId' | 'tahunBerlaku' | 'isActive'>;
const selection = { ...getTableColumns(kurikulum), programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama, isActive: programStudi.isActive } };

function transactionRepository(tx: Transaction) {
  return {
    async findById(id: string) {
      const [row] = await tx.select().from(kurikulum).where(eq(kurikulum.id, id)).for('update');
      return row;
    },
    async lockProgram(id: string) {
      const [row] = await tx.select().from(programStudi).where(eq(programStudi.id, id)).for('share');
      return row;
    },
    async hasStudents(id: string) {
      const [row] = await tx.select({ id: mahasiswa.id }).from(mahasiswa).where(eq(mahasiswa.kurikulumId, id)).limit(1);
      return !!row;
    },
    async hasOfferingHistory(id: string, programId: string) {
      const [row] = await tx.select({ id: kelasKuliah.id }).from(kurikulumMatkul)
        .innerJoin(kelasKuliah, and(eq(kelasKuliah.mataKuliahId, kurikulumMatkul.mataKuliahId), eq(kelasKuliah.programStudiId, programId)))
        .where(eq(kurikulumMatkul.kurikulumId, id)).limit(1);
      return !!row;
    },
    async create(input: Write) {
      const [row] = await tx.insert(kurikulum).values(input).returning();
      return row!;
    },
    async update(id: string, input: Partial<Write> & { updatedAt: Date }) {
      const [row] = await tx.update(kurikulum).set(input).where(eq(kurikulum.id, id)).returning();
      return row!;
    },
  };
}
export function createKurikulumRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async list(query: KurikulumQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.is_active === undefined ? undefined : eq(kurikulum.isActive, query.is_active === 'true'),
        query.program_studi_id ? eq(kurikulum.programStudiId, query.program_studi_id) : undefined,
        query.tahun_berlaku !== undefined ? eq(kurikulum.tahunBerlaku, query.tahun_berlaku) : undefined,
        query.search?.trim() ? or(ilike(kurikulum.kode, searchPattern(query.search)), ilike(kurikulum.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select(selection).from(kurikulum).innerJoin(programStudi, eq(kurikulum.programStudiId, programStudi.id))
          .where(where).orderBy(asc(kurikulum.kode), asc(kurikulum.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(kurikulum).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) {
      const [row] = await db.select(selection).from(kurikulum).innerJoin(programStudi, eq(kurikulum.programStudiId, programStudi.id)).where(eq(kurikulum.id, id));
      return row;
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type KurikulumRepository = ReturnType<typeof createKurikulumRepository>;
