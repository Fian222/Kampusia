import { schedulingRepository } from '../jadwal/jadwal.repository';
import type { createDatabase } from '@kampusia/db';
import { kelasKuliah, semester, mataKuliah, programStudi, kurikulum, kurikulumMatkul, kelasDosen, dosen, jadwalKuliah, ruangan, krsDetail, krs } from '@kampusia/db/schema';
import { and, asc, count, eq, getTableColumns, ilike, inArray, or } from 'drizzle-orm';
import { pagination, searchPattern } from '../../utils/master-data';
import type { KelasKuliahQuery } from './kelas-kuliah.model';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Write = Omit<typeof kelasKuliah.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
const selection = { ...getTableColumns(kelasKuliah), semester: { id: semester.id, kode: semester.kode, nama: semester.nama, isActive: semester.isActive },
  mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks, isActive: mataKuliah.isActive },
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama, isActive: programStudi.isActive } };
export async function classAssignments(tx: Pick<Database, 'select'>, ids: string[]) {
  if (!ids.length) return [];
  return tx.select({ ...getTableColumns(kelasDosen), dosen: { id: dosen.id, kodeDosen: dosen.kodeDosen, nama: dosen.nama, isActive: dosen.isActive } })
    .from(kelasDosen).innerJoin(dosen, eq(kelasDosen.dosenId, dosen.id)).where(inArray(kelasDosen.kelasKuliahId, ids)).orderBy(asc(dosen.nama), asc(kelasDosen.id));
}
function transactionRepository(tx: Transaction) {
  return {
    scheduling: schedulingRepository(tx),
    async findById(id: string) { return (await tx.select().from(kelasKuliah).where(eq(kelasKuliah.id, id)).for('update'))[0]; },
    async lockSemester(id: string) { return (await tx.select().from(semester).where(eq(semester.id, id)).for('share'))[0]; },
    async lockProgram(id: string) { return (await tx.select().from(programStudi).where(eq(programStudi.id, id)).for('share'))[0]; },
    async lockCourse(id: string) { return (await tx.select().from(mataKuliah).where(eq(mataKuliah.id, id)).for('share'))[0]; },
    async hasCurriculum(courseId: string, programId: string) {
      // Match curriculum mutation locks; membership removal cannot race eligibility.
      const rows = await tx.select({ id: kurikulum.id }).from(kurikulum).where(eq(kurikulum.programStudiId, programId)).orderBy(asc(kurikulum.id)).for('share');
      if (!rows.length) return false;
      return (await tx.select({ id: kurikulumMatkul.id }).from(kurikulumMatkul).where(and(inArray(kurikulumMatkul.kurikulumId, rows.map(row => row.id)), eq(kurikulumMatkul.mataKuliahId, courseId))).limit(1)).length > 0;
    },
    async hasSelections(id: string) { return (await tx.select({ id: krsDetail.id }).from(krsDetail).where(eq(krsDetail.kelasKuliahId, id)).limit(1)).length > 0; },
    async hasActiveDetails(id: string) { return (await tx.select({ id: krsDetail.id }).from(krsDetail).where(and(eq(krsDetail.kelasKuliahId, id), eq(krsDetail.status, 'AKTIF'))).limit(1)).length > 0; },
    async enrollmentCount(id: string) {
      const [row] = await tx.select({ value: count() }).from(krsDetail).innerJoin(krs, eq(krsDetail.krsId, krs.id)).where(and(eq(krsDetail.kelasKuliahId, id), eq(krsDetail.status, 'AKTIF'), eq(krs.status, 'DISETUJUI')));
      return row!.value;
    },
    async schedules(id: string) { return tx.select({ ...getTableColumns(jadwalKuliah), roomCapacity: ruangan.kapasitas }).from(jadwalKuliah).innerJoin(ruangan, eq(jadwalKuliah.ruanganId, ruangan.id)).where(eq(jadwalKuliah.kelasKuliahId, id)); },
    assignments: (id: string) => classAssignments(tx, [id]),
    async create(input: Write) { return (await tx.insert(kelasKuliah).values(input).returning())[0]!; },
    async update(id: string, input: Partial<Write>) { return (await tx.update(kelasKuliah).set({ ...input, updatedAt: new Date() }).where(eq(kelasKuliah.id, id)).returning())[0]!; },
  };
}
export function createKelasKuliahRepository(db: Pick<Database, 'select' | 'transaction'>) {
  const joined = (tx: Pick<Database, 'select'>) => tx.select(selection).from(kelasKuliah).innerJoin(semester, eq(kelasKuliah.semesterId, semester.id)).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id)).innerJoin(programStudi, eq(kelasKuliah.programStudiId, programStudi.id));
  return {
    async list(query: KelasKuliahQuery) {
      const { page, limit } = pagination(query);
      const where = and(query.semester_id ? eq(kelasKuliah.semesterId, query.semester_id) : undefined, query.program_studi_id ? eq(kelasKuliah.programStudiId, query.program_studi_id) : undefined,
        query.mata_kuliah_id ? eq(kelasKuliah.mataKuliahId, query.mata_kuliah_id) : undefined, query.status ? eq(kelasKuliah.status, query.status) : undefined,
        query.search?.trim() ? or(ilike(kelasKuliah.namaKelas, searchPattern(query.search)), ilike(mataKuliah.kode, searchPattern(query.search)), ilike(mataKuliah.nama, searchPattern(query.search))) : undefined);
      return db.transaction(async tx => {
        const rows = await joined(tx).where(where).orderBy(asc(semester.kode), asc(mataKuliah.kode), asc(kelasKuliah.namaKelas), asc(kelasKuliah.id)).limit(limit).offset((page - 1) * limit);
        const assignments = await classAssignments(tx, rows.map(row => row.id));
        const [total] = await tx.select({ value: count() }).from(kelasKuliah).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id)).where(where);
        return { data: rows.map(row => ({ ...row, dosen: assignments.filter(item => item.kelasKuliahId === row.id) })), meta: { page, limit, total: total!.value } };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    async findById(id: string) {
      return db.transaction(async tx => {
        const [row] = await joined(tx).where(eq(kelasKuliah.id, id));
        if (!row) return undefined;
        const repository = transactionRepository(tx);
        return { ...row, dosen: await classAssignments(tx, [id]), jumlahMahasiswa: await repository.enrollmentCount(id), jumlahJadwal: (await repository.schedules(id)).length };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
    transaction<T>(operation: (repository: ReturnType<typeof transactionRepository>) => Promise<T>) { return db.transaction(tx => operation(transactionRepository(tx)), { isolationLevel: 'serializable' }); },
  };
}
export type KelasKuliahRepository = ReturnType<typeof createKelasKuliahRepository>;
