import type { createDatabase } from '@kampusia/db';
import { krs, krsDetail, mahasiswa, semester, kelasKuliah, mataKuliah, programStudi, fakultas, kurikulumMatkul, jadwalKuliah, ruangan, kelasDosen, dosen, users } from '@kampusia/db/schema';
import { and, asc, desc, count, eq, getTableColumns, ilike, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';
import { classAssignments } from '../kelas-kuliah/kelas-kuliah.repository';
import type { KrsQuery } from './krs.model';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
const planSelection = { ...getTableColumns(krs), mahasiswa: getTableColumns(mahasiswa), semester: getTableColumns(semester), programStudi: { id: programStudi.id, nama: programStudi.nama, kode: programStudi.kode } };
export function krsTransaction(tx: Transaction) {
  const plans = () => tx.select(planSelection).from(krs).innerJoin(mahasiswa, eq(krs.mahasiswaId, mahasiswa.id)).innerJoin(semester, eq(krs.semesterId, semester.id)).innerJoin(programStudi, eq(mahasiswa.programStudiId, programStudi.id));
  const classes = () => tx.select({ ...getTableColumns(kelasKuliah), mataKuliah: getTableColumns(mataKuliah) }).from(kelasKuliah).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id));
  async function enrich(rows: Awaited<ReturnType<ReturnType<typeof classes>['execute']>>) {
    const ids = rows.map(row => row.id);
    const assignments = await classAssignments(tx, ids);
    const slots = ids.length ? await tx.select({ ...getTableColumns(jadwalKuliah), ruangan: getTableColumns(ruangan) }).from(jadwalKuliah).innerJoin(ruangan, eq(jadwalKuliah.ruanganId, ruangan.id)).where(inArray(jadwalKuliah.kelasKuliahId, ids)).orderBy(asc(jadwalKuliah.hari), asc(jadwalKuliah.jamMulai), asc(jadwalKuliah.id)) : [];
    const counts = ids.length ? await tx.select({ id: krsDetail.kelasKuliahId, value: count() }).from(krsDetail).innerJoin(krs, eq(krsDetail.krsId, krs.id)).where(and(inArray(krsDetail.kelasKuliahId, ids), eq(krsDetail.status, 'AKTIF'), eq(krs.status, 'DISETUJUI'))).groupBy(krsDetail.kelasKuliahId) : [];
    return rows.map(row => { const jumlahMahasiswa = counts.find(item => item.id === row.id)?.value ?? 0; return { ...row, dosen: assignments.filter(item => item.kelasKuliahId === row.id), jadwal: slots.filter(item => item.kelasKuliahId === row.id), jumlahMahasiswa, sisaKapasitas: Math.max(0, row.kapasitas - jumlahMahasiswa) }; });
  }
  return {
    async actor(id: string) { return (await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id)).for('share'))[0]; },
    async student(userId: string) { return (await tx.select().from(mahasiswa).where(eq(mahasiswa.userId, userId)).for('share'))[0]; },
    async studentById(id: string) { return (await tx.select().from(mahasiswa).where(eq(mahasiswa.id, id)).for('share'))[0]; },
    async term(id: string) { return (await tx.select().from(semester).where(eq(semester.id, id)).for('share'))[0]; },
    async activeTerm() { return (await tx.select().from(semester).where(eq(semester.isActive, true)))[0] ?? null; },
    async program(id: string) { return (await tx.select({ isActive: programStudi.isActive, facultyActive: fakultas.isActive }).from(programStudi).innerJoin(fakultas, eq(programStudi.fakultasId, fakultas.id)).where(eq(programStudi.id, id)).for('share'))[0]; },
    async memberships(id: string) { return tx.select({ id: kurikulumMatkul.mataKuliahId }).from(kurikulumMatkul).where(eq(kurikulumMatkul.kurikulumId, id)); },
    async lockPlan(id: string) { return (await tx.select().from(krs).where(eq(krs.id, id)).for('update'))[0]; },
    async findPlan(studentId: string, semesterId: string) { return (await tx.select().from(krs).where(and(eq(krs.mahasiswaId, studentId), eq(krs.semesterId, semesterId))).for('update'))[0]; },
    async lockClasses(ids: string[]) { if (ids.length) await tx.select({ id: kelasKuliah.id }).from(kelasKuliah).where(inArray(kelasKuliah.id, ids)).orderBy(asc(kelasKuliah.id)).for('update'); },
    async details(id: string) { return tx.select().from(krsDetail).where(eq(krsDetail.krsId, id)).orderBy(asc(krsDetail.id)); },
    async classes(ids: string[]) { return enrich(ids.length ? await classes().where(inArray(kelasKuliah.id, ids)).orderBy(asc(kelasKuliah.id)) : []); },
    async detail(id: string) {
      const [row] = await plans().where(eq(krs.id, id));
      if (!row) return undefined;
      const selections = await tx.select().from(krsDetail).where(eq(krsDetail.krsId, id)).orderBy(asc(krsDetail.createdAt), asc(krsDetail.id));
      const offerings = await enrich(selections.length ? await classes().where(inArray(kelasKuliah.id, selections.map(item => item.kelasKuliahId))) : []);
      const details = selections.map(item => ({ ...item, kelas: offerings.find(kelas => kelas.id === item.kelasKuliahId)! }));
      return { ...row, details, totalSks: details.reduce((total, item) => total + (item.status === 'AKTIF' ? item.kelas.mataKuliah.sks : 0), 0) };
    },
    async list(query: KrsQuery, studentId?: string) {
      const { page, limit } = pagination(query);
      const where = and(studentId ? eq(krs.mahasiswaId, studentId) : undefined, query.semester_id ? eq(krs.semesterId, query.semester_id) : undefined, query.program_studi_id ? eq(mahasiswa.programStudiId, query.program_studi_id) : undefined, query.status ? eq(krs.status, query.status) : undefined,
        query.search?.trim() ? or(ilike(mahasiswa.nim, searchPattern(query.search)), ilike(mahasiswa.nama, searchPattern(query.search))) : undefined);
      const data = await plans().where(where).orderBy(desc(krs.createdAt), asc(krs.id)).limit(limit).offset((page - 1) * limit);
      const [total] = await tx.select({ value: count() }).from(krs).innerJoin(mahasiswa, eq(krs.mahasiswaId, mahasiswa.id)).where(where);
      return { data, meta: { page, limit, total: total!.value } };
    },
    async available(student: typeof mahasiswa.$inferSelect, semesterId: string, query: ListQuery) {
      const { page, limit } = pagination(query);
      const selected = tx.select({ id: kelasKuliah.mataKuliahId }).from(krsDetail).innerJoin(krs, eq(krs.id, krsDetail.krsId)).innerJoin(kelasKuliah, eq(kelasKuliah.id, krsDetail.kelasKuliahId)).where(and(eq(krs.mahasiswaId, student.id), eq(krs.semesterId, semesterId), eq(krsDetail.status, 'AKTIF')));
      const members = tx.select({ id: kurikulumMatkul.mataKuliahId }).from(kurikulumMatkul).where(eq(kurikulumMatkul.kurikulumId, student.kurikulumId));
      const where: SQL | undefined = and(eq(kelasKuliah.semesterId, semesterId), eq(kelasKuliah.programStudiId, student.programStudiId), eq(kelasKuliah.status, 'DIBUKA'), eq(mataKuliah.isActive, true), inArray(mataKuliah.id, members), notInArray(mataKuliah.id, selected),
        sql`exists (select 1 from ${kelasDosen} inner join ${dosen} on ${dosen.id} = ${kelasDosen.dosenId} where ${kelasDosen.kelasKuliahId} = ${kelasKuliah.id} and ${dosen.isActive})`,
        sql`exists (select 1 from ${jadwalKuliah} where ${jadwalKuliah.kelasKuliahId} = ${kelasKuliah.id})`,
        sql`not exists (select 1 from ${jadwalKuliah} inner join ${ruangan} on ${ruangan.id} = ${jadwalKuliah.ruanganId} where ${jadwalKuliah.kelasKuliahId} = ${kelasKuliah.id} and (not ${ruangan.isActive} or ${ruangan.kapasitas} < ${kelasKuliah.kapasitas}))`,
        query.search?.trim() ? or(ilike(mataKuliah.kode, searchPattern(query.search)), ilike(mataKuliah.nama, searchPattern(query.search)), ilike(kelasKuliah.namaKelas, searchPattern(query.search))) : undefined);
      const rows = await classes().where(where).orderBy(asc(mataKuliah.kode), asc(kelasKuliah.namaKelas), asc(kelasKuliah.id)).limit(limit).offset((page - 1) * limit);
      const [total] = await tx.select({ value: count() }).from(kelasKuliah).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id)).where(where);
      return { data: await enrich(rows), meta: { page, limit, total: total!.value } };
    },
    async create(studentId: string, semesterId: string, batasSks: number) { return (await tx.insert(krs).values({ mahasiswaId: studentId, semesterId, batasSks }).returning())[0]!; },
    async update(id: string, changes: Partial<Pick<typeof krs.$inferInsert, 'status' | 'diajukanAt' | 'disetujuiAt' | 'disetujuiOleh'>>) { return (await tx.update(krs).set({ ...changes, updatedAt: new Date() }).where(eq(krs.id, id)).returning())[0]!; },
    async add(id: string, classId: string) { return (await tx.insert(krsDetail).values({ krsId: id, kelasKuliahId: classId }).returning())[0]!; },
    async selection(id: string, status: 'AKTIF' | 'DIBATALKAN') { return (await tx.update(krsDetail).set({ status, updatedAt: new Date() }).where(eq(krsDetail.id, id)).returning())[0]!; },
    async cancelDetails(id: string) { await tx.update(krsDetail).set({ status: 'DIBATALKAN', updatedAt: new Date() }).where(and(eq(krsDetail.krsId, id), eq(krsDetail.status, 'AKTIF'))); },
  };
}
export function createKrsRepository(db: Pick<Database, 'transaction'>) {
  return { transaction<T>(operation: (tx: ReturnType<typeof krsTransaction>) => Promise<T>) { return db.transaction(tx => operation(krsTransaction(tx)), { isolationLevel: 'serializable' }); } };
}
export type KrsRepository = ReturnType<typeof createKrsRepository>;
export type KrsTransaction = ReturnType<typeof krsTransaction>;
