import type { createDatabase } from '@kampusia/db';
import { hasilStudi, kelasKuliah, krs, krsDetail, mahasiswa, mataKuliah, programStudi, semester, users } from '@kampusia/db/schema';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const studentSelection = {
  id: mahasiswa.id,
  userId: mahasiswa.userId,
  nim: mahasiswa.nim,
  nama: mahasiswa.nama,
  angkatan: mahasiswa.angkatan,
  status: mahasiswa.status,
  programStudi: { id: programStudi.id, kode: programStudi.kode, nama: programStudi.nama },
};

const resultSelection = {
  id: hasilStudi.id,
  mahasiswaId: hasilStudi.mahasiswaId,
  nilaiAngka: hasilStudi.nilaiAngka,
  nilaiHuruf: hasilStudi.nilaiHuruf,
  nilaiIndeks: hasilStudi.nilaiIndeks,
  difinalisasiAt: hasilStudi.difinalisasiAt,
  dikoreksiAt: hasilStudi.dikoreksiAt,
  kelas: { id: kelasKuliah.id, namaKelas: kelasKuliah.namaKelas },
  mataKuliah: { id: mataKuliah.id, kode: mataKuliah.kode, nama: mataKuliah.nama, sks: mataKuliah.sks },
  semester: { id: semester.id, kode: semester.kode, nama: semester.nama, tahunMulai: semester.tahunMulai, jenis: semester.jenis },
};

function reader(tx: Transaction) {
  return {
    async actor(id: string) {
      return (await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id)))[0];
    },
    async studentByUser(userId: string) {
      return (await tx.select(studentSelection).from(mahasiswa)
        .innerJoin(programStudi, eq(mahasiswa.programStudiId, programStudi.id))
        .where(eq(mahasiswa.userId, userId)))[0];
    },
    async studentById(id: string) {
      return (await tx.select(studentSelection).from(mahasiswa)
        .innerJoin(programStudi, eq(mahasiswa.programStudiId, programStudi.id))
        .where(eq(mahasiswa.id, id)))[0];
    },
    async term(id: string) {
      return (await tx.select().from(semester).where(eq(semester.id, id)))[0];
    },
    results(studentId: string, semesterId?: string) {
      return tx.select(resultSelection).from(hasilStudi)
        .innerJoin(kelasKuliah, eq(hasilStudi.kelasKuliahId, kelasKuliah.id))
        .innerJoin(mataKuliah, eq(kelasKuliah.mataKuliahId, mataKuliah.id))
        .innerJoin(semester, eq(kelasKuliah.semesterId, semester.id))
        .where(and(eq(hasilStudi.mahasiswaId, studentId), semesterId ? eq(kelasKuliah.semesterId, semesterId) : undefined))
        .orderBy(desc(semester.kode), asc(mataKuliah.kode), asc(kelasKuliah.namaKelas), asc(hasilStudi.id));
    },
    async unfinishedCount(studentId: string, semesterId: string) {
      const rows = await tx.select({ id: krsDetail.id }).from(krsDetail)
        .innerJoin(krs, eq(krsDetail.krsId, krs.id))
        .innerJoin(kelasKuliah, eq(krsDetail.kelasKuliahId, kelasKuliah.id))
        .leftJoin(hasilStudi, and(eq(hasilStudi.kelasKuliahId, kelasKuliah.id), eq(hasilStudi.mahasiswaId, studentId)))
        .where(and(
          eq(krs.mahasiswaId, studentId),
          eq(krs.semesterId, semesterId),
          eq(krs.status, 'DISETUJUI'),
          eq(krsDetail.status, 'AKTIF'),
          isNull(hasilStudi.id),
        ));
      return rows.length;
    },
  };
}

export function createHasilStudiRepository(db: Pick<Database, 'transaction'>) {
  return {
    read<T>(operation: (repository: ReturnType<typeof reader>) => Promise<T>) {
      return db.transaction(tx => operation(reader(tx)), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
  };
}

export type HasilStudiRepository = ReturnType<typeof createHasilStudiRepository>;
export type HasilStudiReader = ReturnType<typeof reader>;
