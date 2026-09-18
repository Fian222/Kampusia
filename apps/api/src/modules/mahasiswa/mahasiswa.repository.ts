import { dosen, fakultas, krs, kurikulum, mahasiswa, programStudi } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, isNotNull, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import { profileReferences, type Database, type Transaction } from '../../utils/profile-repository';
import type { KurikulumOptionsQuery, MahasiswaQuery } from './mahasiswa.model';

type Write = Pick<typeof mahasiswa.$inferInsert, 'userId' | 'programStudiId' | 'kurikulumId' | 'dosenPaId' | 'nim' | 'nama' | 'angkatan' | 'status'>;
const selection = {
  ...getTableColumns(mahasiswa),
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama, isActive: programStudi.isActive },
  fakultas: { id: fakultas.id, kode: fakultas.kode, nama: fakultas.nama },
  kurikulum: { id: kurikulum.id, kode: kurikulum.kode, nama: kurikulum.nama, programStudiId: kurikulum.programStudiId, isActive: kurikulum.isActive },
  dosenPa: { id: dosen.id, kodeDosen: dosen.kodeDosen, nama: dosen.nama, isActive: dosen.isActive },
};
function transactionRepository(tx: Transaction) {
  return {
    ...profileReferences(tx),
    async findById(id: string) {
      const [row] = await tx.select().from(mahasiswa).where(eq(mahasiswa.id, id)).for('update');
      return row;
    },
    async lockKurikulum(id: string) {
      const [row] = await tx.select().from(kurikulum).where(eq(kurikulum.id, id)).for('share');
      return row;
    },
    async lockDosen(id: string) { return (await tx.select().from(dosen).where(eq(dosen.id, id)).for('share'))[0]; },
    async hasApprovedHistory(id: string) {
      const [row] = await tx.select({ id: krs.id }).from(krs).where(and(eq(krs.mahasiswaId, id), or(eq(krs.status, 'DISETUJUI'), isNotNull(krs.disetujuiAt)))).limit(1);
      return !!row;
    },
    async create(input: Write) {
      const [row] = await tx.insert(mahasiswa).values(input).returning();
      return row!;
    },
    async update(id: string, input: Partial<Write> & { updatedAt: Date }) {
      const [row] = await tx.update(mahasiswa).set(input).where(eq(mahasiswa.id, id)).returning();
      return row!;
    },
  };
}
export function createMahasiswaRepository(db: Pick<Database, 'select' | 'transaction'>) {
  return {
    async list(query: MahasiswaQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.program_studi_id ? eq(mahasiswa.programStudiId, query.program_studi_id) : undefined,
        query.kurikulum_id ? eq(mahasiswa.kurikulumId, query.kurikulum_id) : undefined,
        query.angkatan !== undefined ? eq(mahasiswa.angkatan, query.angkatan) : undefined,
        query.status ? eq(mahasiswa.status, query.status) : undefined,
        query.search?.trim() ? or(ilike(mahasiswa.nim, searchPattern(query.search)), ilike(mahasiswa.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select(selection).from(mahasiswa)
          .innerJoin(programStudi, eq(mahasiswa.programStudiId, programStudi.id))
          .innerJoin(fakultas, eq(programStudi.fakultasId, fakultas.id))
          .innerJoin(kurikulum, eq(mahasiswa.kurikulumId, kurikulum.id))
          .leftJoin(dosen, eq(mahasiswa.dosenPaId, dosen.id))
          .where(where).orderBy(asc(mahasiswa.nim), asc(mahasiswa.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(mahasiswa).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) {
      const [row] = await db.select(selection).from(mahasiswa)
        .innerJoin(programStudi, eq(mahasiswa.programStudiId, programStudi.id))
        .innerJoin(fakultas, eq(programStudi.fakultasId, fakultas.id))
        .innerJoin(kurikulum, eq(mahasiswa.kurikulumId, kurikulum.id))
        .leftJoin(dosen, eq(mahasiswa.dosenPaId, dosen.id)).where(eq(mahasiswa.id, id));
      return row;
    },
    async kurikulumOptions(query: KurikulumOptionsQuery) {
      const { page, limit } = pagination(query);
      const where = and(
        query.program_studi_id ? eq(kurikulum.programStudiId, query.program_studi_id) : undefined,
        query.is_active === undefined ? undefined : eq(kurikulum.isActive, query.is_active === 'true'),
        query.search?.trim() ? or(ilike(kurikulum.kode, searchPattern(query.search)), ilike(kurikulum.nama, searchPattern(query.search))) : undefined,
      );
      return db.transaction(async tx => {
        const data = await tx.select({ id: kurikulum.id, kode: kurikulum.kode, nama: kurikulum.nama, programStudiId: kurikulum.programStudiId, isActive: kurikulum.isActive })
          .from(kurikulum).where(where).orderBy(asc(kurikulum.kode), asc(kurikulum.id)).limit(limit).offset((page - 1) * limit);
        const [total] = await tx.select({ value: count() }).from(kurikulum).where(where);
        return { data, meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(tx => operation(transactionRepository(tx)));
    },
  };
}
export type MahasiswaRepository = ReturnType<typeof createMahasiswaRepository>;
