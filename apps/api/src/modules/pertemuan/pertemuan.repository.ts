import type { createDatabase } from '@kampusia/db';
import { absensi, dosen, kelasDosen, kelasKuliah, krs, krsDetail, mahasiswa, mataKuliah, pertemuan, programStudi, semester, users } from '@kampusia/db/schema';
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, max, or } from 'drizzle-orm';
import { pagination, searchPattern, type ListQuery } from '../../utils/master-data';
import type { DosenKelasQuery } from './pertemuan.model';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type MeetingWrite = Omit<typeof pertemuan.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'status'>;
type AttendanceWrite = Pick<typeof absensi.$inferInsert, 'status' | 'keterangan'>;

const classSelection = {
  ...getTableColumns(kelasKuliah),
  semester: getTableColumns(semester),
  mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks },
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama },
};

const meetingSelection = {
  ...getTableColumns(pertemuan),
  kelas: getTableColumns(kelasKuliah),
  semester: getTableColumns(semester),
  mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks },
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama },
};

function transactionRepository(tx: Transaction) {
  const joinedMeeting = () => tx.select(meetingSelection).from(pertemuan)
    .innerJoin(kelasKuliah, eq(pertemuan.kelasKuliahId, kelasKuliah.id))
    .innerJoin(semester, eq(kelasKuliah.semesterId, semester.id))
    .innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id))
    .innerJoin(programStudi, eq(kelasKuliah.programStudiId, programStudi.id));
  return {
    async actor(id: string) {
      return (await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id)).for('share'))[0];
    },
    async lecturer(userId: string) {
      return (await tx.select({ id: dosen.id, isActive: dosen.isActive }).from(dosen).where(eq(dosen.userId, userId)).for('share'))[0];
    },
    async student(userId: string) {
      return (await tx.select({ id: mahasiswa.id }).from(mahasiswa).where(eq(mahasiswa.userId, userId)).for('share'))[0];
    },
    async assigned(classId: string, lecturerId: string) {
      return (await tx.select({ id: kelasDosen.id }).from(kelasDosen).where(and(eq(kelasDosen.kelasKuliahId, classId), eq(kelasDosen.dosenId, lecturerId))).limit(1)).length > 0;
    },
    async classInfo(id: string) {
      return (await tx.select(classSelection).from(kelasKuliah)
        .innerJoin(semester, eq(kelasKuliah.semesterId, semester.id))
        .innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id))
        .innerJoin(programStudi, eq(kelasKuliah.programStudiId, programStudi.id))
        .where(eq(kelasKuliah.id, id)))[0];
    },
    async lockClass(id: string) {
      return (await tx.select().from(kelasKuliah).where(eq(kelasKuliah.id, id)).for('update'))[0];
    },
    async term(id: string) {
      return (await tx.select().from(semester).where(eq(semester.id, id)).for('share'))[0];
    },
    async peekMeeting(id: string) {
      return (await tx.select().from(pertemuan).where(eq(pertemuan.id, id)))[0];
    },
    async lockMeeting(id: string) {
      return (await tx.select().from(pertemuan).where(eq(pertemuan.id, id)).for('update'))[0];
    },
    async meetingDetail(id: string) {
      const row = (await joinedMeeting().where(eq(pertemuan.id, id)))[0];
      if (!row) return undefined;
      const [attendanceTotal] = await tx.select({ value: count() }).from(absensi).where(eq(absensi.pertemuanId, id));
      const { semester: term, mataKuliah: course, programStudi: program, ...rest } = row;
      return { ...rest, kelas: { ...row.kelas, semester: term, mataKuliah: course, programStudi: program }, jumlahAbsensi: attendanceTotal!.value };
    },
    async listMeetings(classId: string, query: ListQuery) {
      const { page, limit } = pagination(query);
      const data = await tx.select().from(pertemuan).where(eq(pertemuan.kelasKuliahId, classId))
        .orderBy(asc(pertemuan.nomorPertemuan), asc(pertemuan.id)).limit(limit).offset((page - 1) * limit);
      const [total] = await tx.select({ value: count() }).from(pertemuan).where(eq(pertemuan.kelasKuliahId, classId));
      return { data, meta: { page, limit, total: total!.value } };
    },
    async nextMeetingNumber(classId: string) {
      const [row] = await tx.select({ value: max(pertemuan.nomorPertemuan) }).from(pertemuan).where(eq(pertemuan.kelasKuliahId, classId));
      return (row?.value ?? 0) + 1;
    },
    async attendanceForMeetings(meetingIds: string[]) {
      if (!meetingIds.length) return [];
      return tx.select({ meetingId: absensi.pertemuanId, mahasiswaId: absensi.mahasiswaId })
        .from(absensi).where(inArray(absensi.pertemuanId, meetingIds));
    },
    async listLecturerClasses(lecturerId: string, query: DosenKelasQuery) {
      const { page, limit } = pagination(query);
      const where = and(eq(kelasDosen.dosenId, lecturerId), query.semester_id ? eq(kelasKuliah.semesterId, query.semester_id) : undefined,
        query.status ? eq(kelasKuliah.status, query.status) : undefined,
        query.search?.trim() ? or(ilike(mataKuliah.kode, searchPattern(query.search)), ilike(mataKuliah.nama, searchPattern(query.search)), ilike(kelasKuliah.namaKelas, searchPattern(query.search))) : undefined);
      const base = () => tx.select(classSelection).from(kelasDosen).innerJoin(kelasKuliah, eq(kelasDosen.kelasKuliahId, kelasKuliah.id))
        .innerJoin(semester, eq(kelasKuliah.semesterId, semester.id)).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id))
        .innerJoin(programStudi, eq(kelasKuliah.programStudiId, programStudi.id));
      const data = await base().where(where).orderBy(desc(semester.tanggalMulai), asc(mataKuliah.kode), asc(kelasKuliah.namaKelas)).limit(limit).offset((page - 1) * limit);
      const [total] = await tx.select({ value: count() }).from(kelasDosen).innerJoin(kelasKuliah, eq(kelasDosen.kelasKuliahId, kelasKuliah.id))
        .innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id)).where(where);
      return { data, meta: { page, limit, total: total!.value } };
    },
    async createMeeting(input: MeetingWrite) {
      return (await tx.insert(pertemuan).values(input).returning())[0]!;
    },
    async updateMeeting(id: string, changes: Partial<Pick<typeof pertemuan.$inferInsert, 'nomorPertemuan' | 'tanggal' | 'jamMulai' | 'jamSelesai' | 'materi' | 'status'>>) {
      return (await tx.update(pertemuan).set({ ...changes, updatedAt: new Date() }).where(eq(pertemuan.id, id)).returning())[0]!;
    },
    async attendanceCount(meetingId: string) {
      return (await tx.select({ value: count() }).from(absensi).where(eq(absensi.pertemuanId, meetingId)))[0]!.value;
    },
    async relatedPlanIds(classId: string) {
      return (await tx.selectDistinct({ id: krs.id }).from(krs).innerJoin(krsDetail, eq(krsDetail.krsId, krs.id))
        .where(eq(krsDetail.kelasKuliahId, classId)).orderBy(asc(krs.id))).map(row => row.id);
    },
    async lockPlans(ids: string[]) {
      if (ids.length) await tx.select({ id: krs.id }).from(krs).where(inArray(krs.id, ids)).orderBy(asc(krs.id)).for('update');
    },
    async effectiveRoster(classId: string) {
      return tx.select({ id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama, krsId: krs.id, detailId: krsDetail.id })
        .from(krsDetail).innerJoin(krs, eq(krsDetail.krsId, krs.id)).innerJoin(mahasiswa, eq(krs.mahasiswaId, mahasiswa.id))
        .where(and(eq(krsDetail.kelasKuliahId, classId), eq(krsDetail.status, 'AKTIF'), eq(krs.status, 'DISETUJUI')))
        .orderBy(asc(mahasiswa.nim), asc(mahasiswa.id));
    },
    async lockAttendance(meetingId: string) {
      return tx.select().from(absensi).where(eq(absensi.pertemuanId, meetingId)).orderBy(asc(absensi.mahasiswaId)).for('update');
    },
    async attendanceRows(meetingId: string) {
      return tx.select({ ...getTableColumns(absensi), mahasiswa: { id: mahasiswa.id, nim: mahasiswa.nim, nama: mahasiswa.nama } })
        .from(absensi).innerJoin(mahasiswa, eq(absensi.mahasiswaId, mahasiswa.id)).where(eq(absensi.pertemuanId, meetingId))
        .orderBy(asc(mahasiswa.nim), asc(mahasiswa.id));
    },
    async insertAttendance(meetingId: string, studentId: string, input: AttendanceWrite, actorId: string) {
      return (await tx.insert(absensi).values({ pertemuanId: meetingId, mahasiswaId: studentId, ...input, dicatatOleh: actorId, diubahOleh: actorId }).returning())[0]!;
    },
    async updateAttendance(id: string, input: Partial<AttendanceWrite>, actorId: string) {
      return (await tx.update(absensi).set({ ...input, diubahOleh: actorId, updatedAt: new Date() }).where(eq(absensi.id, id)).returning())[0]!;
    },
    async studentHistory(studentId: string, query: ListQuery) {
      const { page, limit } = pagination(query);
      const selection = { ...getTableColumns(absensi), pertemuan: getTableColumns(pertemuan), kelas: { id: kelasKuliah.id, namaKelas: kelasKuliah.namaKelas },
        mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama }, semester: { id: semester.id, kode: semester.kode, nama: semester.nama } };
      const base = () => tx.select(selection).from(absensi).innerJoin(pertemuan, eq(absensi.pertemuanId, pertemuan.id))
        .innerJoin(kelasKuliah, eq(pertemuan.kelasKuliahId, kelasKuliah.id)).innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id))
        .innerJoin(semester, eq(kelasKuliah.semesterId, semester.id));
      const data = await base().where(eq(absensi.mahasiswaId, studentId)).orderBy(desc(pertemuan.tanggal), desc(pertemuan.nomorPertemuan), desc(absensi.id)).limit(limit).offset((page - 1) * limit);
      const [total] = await tx.select({ value: count() }).from(absensi).where(eq(absensi.mahasiswaId, studentId));
      return { data, meta: { page, limit, total: total!.value } };
    },
  };
}

export function createPertemuanRepository(db: Pick<Database, 'transaction'>) {
  return {
    transaction<T>(operation: (tx: ReturnType<typeof transactionRepository>) => Promise<T>) {
      return db.transaction(inner => operation(transactionRepository(inner)), { isolationLevel: 'serializable' });
    },
  };
}
export type PertemuanRepository = ReturnType<typeof createPertemuanRepository>;
export type PertemuanTransaction = ReturnType<typeof transactionRepository>;
