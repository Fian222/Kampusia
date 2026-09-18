import { createDatabase } from '@kampusia/db';
import { fakultas, programStudi, mataKuliah, kurikulum, kurikulumMatkul, semester, kelasKuliah, dosen, kelasDosen, ruangan, jadwalKuliah, mahasiswa, users, krs, krsDetail } from '@kampusia/db/schema';
import { eq, inArray } from 'drizzle-orm';
type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export function connect() {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') throw new Error('KRS integration tests require local kampusia.');
  return createDatabase(url.toString());
}
export async function fixture(tx: Transaction) {
  const prefix = 'K' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const [term] = await tx.select().from(semester).where(eq(semester.isActive, true));
  if (!term) throw new Error('KRS integration tests need a configured active development semester.');
  const originalKrsWindow = { krsMulaiAt: term.krsMulaiAt, krsSelesaiAt: term.krsSelesaiAt };
  const now = new Date(); term.krsMulaiAt = new Date(now.getTime() - 60_000); term.krsSelesaiAt = new Date(now.getTime() + 60 * 60_000);
  await tx.update(semester).set({ krsMulaiAt: term.krsMulaiAt, krsSelesaiAt: term.krsSelesaiAt }).where(eq(semester.id, term.id));
  const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
  const [program] = await tx.insert(programStudi).values({ kode: prefix, nama: prefix, fakultasId: faculty!.id, jenjang: 'S1' }).returning();
  const courses = await tx.insert(mataKuliah).values(['A', 'B', 'C'].map(suffix => ({ kode: prefix + suffix, nama: prefix + suffix, sks: 3 }))).returning();
  const [curriculum] = await tx.insert(kurikulum).values({ kode: prefix, nama: prefix, programStudiId: program!.id, tahunBerlaku: 2026 }).returning();
  await tx.insert(kurikulumMatkul).values(courses.map(course => ({ kurikulumId: curriculum!.id, mataKuliahId: course.id })));
  const classes = await tx.insert(kelasKuliah).values(courses.map(course => ({ namaKelas: 'A', semesterId: term.id, programStudiId: program!.id, mataKuliahId: course.id, kapasitas: 1, status: 'DIBUKA' as const }))).returning();
  const [room] = await tx.insert(ruangan).values({ kode: prefix, nama: prefix, kapasitas: 30 }).returning();
  const [lecturer] = await tx.insert(dosen).values({ kodeDosen: prefix, nama: prefix }).returning();
  await tx.insert(kelasDosen).values(classes.map(row => ({ kelasKuliahId: row.id, dosenId: lecturer!.id })));
  const slots = await tx.insert(jadwalKuliah).values(classes.map((row, i) => ({ kelasKuliahId: row.id, ruanganId: room!.id, hari: i + 1, jamMulai: '08:00', jamSelesai: '10:00' }))).returning();
  const accounts = await tx.insert(users).values(['MAHASISWA', 'MAHASISWA', 'AKADEMIK', 'DOSEN'].map((role, i) => ({ email: `${prefix.toLowerCase()}${i}@test.local`, passwordHash: 'unused-test-account', role: role as 'MAHASISWA' | 'AKADEMIK' | 'DOSEN' }))).returning();
  await tx.update(dosen).set({ userId: accounts[3]!.id }).where(eq(dosen.id, lecturer!.id));
  lecturer!.userId = accounts[3]!.id;
  const students = await tx.insert(mahasiswa).values(accounts.slice(0, 2).map((row, i) => ({ userId: row.id, nim: prefix + i, nama: prefix + i, programStudiId: program!.id, kurikulumId: curriculum!.id, dosenPaId: lecturer!.id, angkatan: 2026 }))).returning();
  return { prefix, term, originalKrsWindow, faculty: faculty!, program: program!, courses, curriculum: curriculum!, classes, room: room!, lecturer: lecturer!, slots, accounts, students, admin: accounts[2]!, adviser: accounts[3]!, user: accounts[0]!, other: accounts[1]! };
}
export async function cleanup(db: Database, f: Awaited<ReturnType<typeof fixture>>) {
  await db.transaction(async tx => {
    const plans = await tx.select({ id: krs.id }).from(krs).where(inArray(krs.mahasiswaId, f.students.map(row => row.id)));
    if (plans.length) { await tx.delete(krsDetail).where(inArray(krsDetail.krsId, plans.map(row => row.id))); await tx.delete(krs).where(inArray(krs.id, plans.map(row => row.id))); }
    await tx.delete(jadwalKuliah).where(inArray(jadwalKuliah.kelasKuliahId, f.classes.map(row => row.id)));
    await tx.delete(kelasDosen).where(inArray(kelasDosen.kelasKuliahId, f.classes.map(row => row.id)));
    await tx.delete(kelasKuliah).where(inArray(kelasKuliah.id, f.classes.map(row => row.id)));
    await tx.delete(mahasiswa).where(inArray(mahasiswa.id, f.students.map(row => row.id)));
    await tx.update(dosen).set({ userId: null }).where(eq(dosen.id, f.lecturer.id));
    await tx.delete(users).where(inArray(users.id, f.accounts.map(row => row.id)));
    await tx.delete(kurikulumMatkul).where(eq(kurikulumMatkul.kurikulumId, f.curriculum.id));
    await tx.delete(kurikulum).where(eq(kurikulum.id, f.curriculum.id));
    await tx.delete(mataKuliah).where(inArray(mataKuliah.id, f.courses.map(row => row.id)));
    await tx.delete(dosen).where(eq(dosen.id, f.lecturer.id)); await tx.delete(ruangan).where(eq(ruangan.id, f.room.id));
    await tx.delete(programStudi).where(eq(programStudi.id, f.program.id)); await tx.delete(fakultas).where(eq(fakultas.id, f.faculty.id));
    await tx.update(semester).set(f.originalKrsWindow).where(eq(semester.id, f.term.id));
  });
}
