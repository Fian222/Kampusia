import type { createDatabase } from '@kampusia/db';
import { dosen, hasilStudi, kelasDosen, kelasKuliah, komponenNilai, krs, krsDetail, mahasiswa, mataKuliah, nilaiMahasiswa, programStudi, semester, users } from '@kampusia/db/schema';
import { and, asc, eq, getTableColumns, inArray } from 'drizzle-orm';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type ComponentWrite = Pick<typeof komponenNilai.$inferInsert, 'nama' | 'bobot' | 'urutan' | 'isActive'>;

const classSelection = {
  ...getTableColumns(kelasKuliah),
  semester: { id: semester.id, kode: semester.kode, nama: semester.nama },
  mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks },
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama },
};

function transactionRepository(tx: Transaction) {
  return {
    async actor(id: string) { return (await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id)).for('share'))[0]; },
    async lecturer(userId: string) { return (await tx.select({ id: dosen.id, isActive: dosen.isActive }).from(dosen).where(eq(dosen.userId, userId)).for('share'))[0]; },
    async assignment(classId: string, lecturerId: string) { return (await tx.select().from(kelasDosen).where(and(eq(kelasDosen.kelasKuliahId, classId), eq(kelasDosen.dosenId, lecturerId))).for('share'))[0]; },
    async coordinator(classId: string) { return (await tx.select({ dosenId: kelasDosen.dosenId }).from(kelasDosen).where(and(eq(kelasDosen.kelasKuliahId, classId), eq(kelasDosen.isKoordinator, true))).for('share'))[0]; },
    async classInfo(id: string) { return (await tx.select(classSelection).from(kelasKuliah).innerJoin(semester, eq(kelasKuliah.semesterId, semester.id)).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id)).innerJoin(programStudi, eq(kelasKuliah.programStudiId, programStudi.id)).where(eq(kelasKuliah.id, id)))[0]; },
    async lockClass(id: string) { return (await tx.select().from(kelasKuliah).where(eq(kelasKuliah.id, id)).for('update'))[0]; },
    async relatedPlanIds(classId: string, studentId?: string) {
      const where = and(eq(krsDetail.kelasKuliahId, classId), studentId ? eq(krs.mahasiswaId, studentId) : undefined);
      return (await tx.selectDistinct({ id: krs.id }).from(krs).innerJoin(krsDetail, eq(krsDetail.krsId, krs.id)).where(where).orderBy(asc(krs.id))).map(row => row.id);
    },
    async lockPlans(ids: string[]) { if (ids.length) await tx.select({ id: krs.id }).from(krs).where(inArray(krs.id, ids)).orderBy(asc(krs.id)).for('update'); },
    async effectiveRoster(classId: string) {
      return tx.select({ id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama, krsId: krs.id, detailId: krsDetail.id }).from(krsDetail)
        .innerJoin(krs, eq(krsDetail.krsId, krs.id)).innerJoin(mahasiswa, eq(krs.mahasiswaId, mahasiswa.id))
        .where(and(eq(krsDetail.kelasKuliahId, classId), eq(krsDetail.status, 'AKTIF'), eq(krs.status, 'DISETUJUI'))).orderBy(asc(mahasiswa.nim), asc(mahasiswa.id));
    },
    async components(classId: string, lock = false) {
      const query = tx.select().from(komponenNilai).where(eq(komponenNilai.kelasKuliahId, classId)).orderBy(asc(komponenNilai.urutan), asc(komponenNilai.id));
      return lock ? query.for('update') : query;
    },
    async component(id: string, lock = false) {
      const query = tx.select().from(komponenNilai).where(eq(komponenNilai.id, id));
      return (await (lock ? query.for('update') : query))[0];
    },
    async scores(classId: string, lock = false) {
      const query = tx.select({ ...getTableColumns(nilaiMahasiswa), komponen: { kelasKuliahId: komponenNilai.kelasKuliahId, nama: komponenNilai.nama, bobot: komponenNilai.bobot, urutan: komponenNilai.urutan, isActive: komponenNilai.isActive }, mahasiswa: { id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama } })
        .from(nilaiMahasiswa).innerJoin(komponenNilai, eq(nilaiMahasiswa.komponenNilaiId, komponenNilai.id)).innerJoin(mahasiswa, eq(nilaiMahasiswa.mahasiswaId, mahasiswa.id))
        .where(eq(komponenNilai.kelasKuliahId, classId)).orderBy(asc(nilaiMahasiswa.komponenNilaiId), asc(nilaiMahasiswa.mahasiswaId));
      return lock ? query.for('update') : query;
    },
    async results(classId: string, lock = false) {
      const query = tx.select({ ...getTableColumns(hasilStudi), mahasiswa: { id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama } }).from(hasilStudi).innerJoin(mahasiswa, eq(hasilStudi.mahasiswaId, mahasiswa.id)).where(eq(hasilStudi.kelasKuliahId, classId)).orderBy(asc(mahasiswa.nim), asc(mahasiswa.id));
      return lock ? query.for('update') : query;
    },
    async createComponent(classId: string, input: ComponentWrite) { return (await tx.insert(komponenNilai).values({ kelasKuliahId: classId, ...input }).returning())[0]!; },
    async updateComponent(id: string, input: Partial<ComponentWrite>) { return (await tx.update(komponenNilai).set({ ...input, updatedAt: new Date() }).where(eq(komponenNilai.id, id)).returning())[0]!; },
    async deleteComponent(id: string) { return (await tx.delete(komponenNilai).where(eq(komponenNilai.id, id)).returning())[0]; },
    async scoreCount(componentId: string) { return (await tx.select({ id: nilaiMahasiswa.id }).from(nilaiMahasiswa).where(eq(nilaiMahasiswa.komponenNilaiId, componentId)).limit(1)).length; },
    async upsertScore(componentId: string, studentId: string, nilai: string | null, actorId: string) {
      return (await tx.insert(nilaiMahasiswa).values({ komponenNilaiId: componentId, mahasiswaId: studentId, nilai, dicatatOleh: actorId, diubahOleh: actorId })
        .onConflictDoUpdate({ target: [nilaiMahasiswa.komponenNilaiId, nilaiMahasiswa.mahasiswaId], set: { nilai, diubahOleh: actorId, updatedAt: new Date() } }).returning())[0]!;
    },
    async insertResults(rows: (typeof hasilStudi.$inferInsert)[]) { return tx.insert(hasilStudi).values(rows).returning(); },
    async updateResult(id: string, values: Pick<typeof hasilStudi.$inferInsert, 'nilaiAngka' | 'nilaiHuruf' | 'nilaiIndeks' | 'dikoreksiAt' | 'dikoreksiOleh' | 'alasanKoreksi'>) {
      return (await tx.update(hasilStudi).set({ ...values, updatedAt: new Date() }).where(eq(hasilStudi.id, id)).returning())[0]!;
    },
  };
}

export function createNilaiRepository(db: Pick<Database, 'transaction'>) {
  return { transaction<T>(operation: (tx: ReturnType<typeof transactionRepository>) => Promise<T>) { return db.transaction(inner => operation(transactionRepository(inner)), { isolationLevel: 'serializable' }); } };
}
export type NilaiRepository = ReturnType<typeof createNilaiRepository>;
export type NilaiTransaction = ReturnType<typeof transactionRepository>;
