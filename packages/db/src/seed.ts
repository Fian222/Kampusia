import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import * as schema from '../schema';
import { createDatabase } from './index';
import { assertFixtureRows, developmentData, requireDevelopmentTarget } from './seed-data';

type Database = ReturnType<typeof createDatabase>['db'];
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Fixtures = ReturnType<typeof developmentData>;

async function verifyFixtures(tx: Transaction, data: Fixtures) {
  const usersRows = await tx.select().from(schema.users).where(inArray(schema.users.id, data.users.map(row => row.id)));
  if (usersRows.length !== data.users.length) throw new Error('Unexpected demo users record count.');
  assertFixtureRows(data.users, usersRows);
  const fakultasRows = await tx.select().from(schema.fakultas).where(inArray(schema.fakultas.id, data.fakultas.map(row => row.id)));
  if (fakultasRows.length !== data.fakultas.length) throw new Error('Unexpected demo fakultas record count.');
  assertFixtureRows(data.fakultas, fakultasRows);
  const programStudiRows = await tx.select().from(schema.programStudi).where(inArray(schema.programStudi.id, data.programStudi.map(row => row.id)));
  if (programStudiRows.length !== data.programStudi.length) throw new Error('Unexpected demo programStudi record count.');
  assertFixtureRows(data.programStudi, programStudiRows);
  const kurikulumRows = await tx.select().from(schema.kurikulum).where(inArray(schema.kurikulum.id, data.kurikulum.map(row => row.id)));
  if (kurikulumRows.length !== data.kurikulum.length) throw new Error('Unexpected demo kurikulum record count.');
  assertFixtureRows(data.kurikulum, kurikulumRows);
  const mataKuliahRows = await tx.select().from(schema.mataKuliah).where(inArray(schema.mataKuliah.id, data.mataKuliah.map(row => row.id)));
  if (mataKuliahRows.length !== data.mataKuliah.length) throw new Error('Unexpected demo mataKuliah record count.');
  assertFixtureRows(data.mataKuliah, mataKuliahRows);
  const kurikulumMatkulRows = await tx.select().from(schema.kurikulumMatkul).where(eq(schema.kurikulumMatkul.kurikulumId, data.kurikulum[0]!.id));
  if (kurikulumMatkulRows.length !== data.kurikulumMatkul.length) throw new Error('Unexpected demo kurikulumMatkul record count.');
  assertFixtureRows(data.kurikulumMatkul, kurikulumMatkulRows);
  const semesterRows = await tx.select().from(schema.semester).where(inArray(schema.semester.id, data.semester.map(row => row.id)));
  if (semesterRows.length !== data.semester.length) throw new Error('Unexpected demo semester record count.');
  assertFixtureRows(data.semester, semesterRows);
  const dosenRows = await tx.select().from(schema.dosen).where(inArray(schema.dosen.id, data.dosen.map(row => row.id)));
  if (dosenRows.length !== data.dosen.length) throw new Error('Unexpected demo dosen record count.');
  assertFixtureRows(data.dosen, dosenRows);
  const mahasiswaRows = await tx.select().from(schema.mahasiswa).where(inArray(schema.mahasiswa.id, data.mahasiswa.map(row => row.id)));
  if (mahasiswaRows.length !== data.mahasiswa.length) throw new Error('Unexpected demo mahasiswa record count.');
  assertFixtureRows(data.mahasiswa, mahasiswaRows);
  const demoUserIds = data.users.map(row => row.id);
  const linkedDosen = await tx.select({ id: schema.dosen.id, userId: schema.dosen.userId })
    .from(schema.dosen).where(inArray(schema.dosen.userId, demoUserIds));
  const expectedDosen = data.dosen.find(row => row.userId !== null)!;
  if (linkedDosen.length !== 1 || linkedDosen[0]!.id !== expectedDosen.id
    || linkedDosen[0]!.userId !== expectedDosen.userId) {
    throw new Error('Unexpected demo DOSEN profile link.');
  }
  const linkedMahasiswa = await tx.select({ id: schema.mahasiswa.id, userId: schema.mahasiswa.userId })
    .from(schema.mahasiswa).where(inArray(schema.mahasiswa.userId, demoUserIds));
  const expectedMahasiswa = data.mahasiswa.find(row => row.userId !== null)!;
  if (linkedMahasiswa.length !== 1 || linkedMahasiswa[0]!.id !== expectedMahasiswa.id
    || linkedMahasiswa[0]!.userId !== expectedMahasiswa.userId) {
    throw new Error('Unexpected demo MAHASISWA profile link.');
  }
  const ruanganRows = await tx.select().from(schema.ruangan).where(inArray(schema.ruangan.id, data.ruangan.map(row => row.id)));
  if (ruanganRows.length !== data.ruangan.length) throw new Error('Unexpected demo ruangan record count.');
  assertFixtureRows(data.ruangan, ruanganRows);
  const kelasKuliahRows = await tx.select().from(schema.kelasKuliah).where(inArray(schema.kelasKuliah.id, data.kelasKuliah.map(row => row.id)));
  if (kelasKuliahRows.length !== data.kelasKuliah.length) throw new Error('Unexpected demo kelasKuliah record count.');
  assertFixtureRows(data.kelasKuliah, kelasKuliahRows);
  const kelasDosenRows = await tx.select().from(schema.kelasDosen).where(inArray(schema.kelasDosen.kelasKuliahId, data.kelasKuliah.map(row => row.id)));
  if (kelasDosenRows.length !== data.kelasDosen.length) throw new Error('Unexpected demo kelasDosen record count.');
  assertFixtureRows(data.kelasDosen, kelasDosenRows);
  const jadwalKuliahRows = await tx.select().from(schema.jadwalKuliah).where(inArray(schema.jadwalKuliah.kelasKuliahId, data.kelasKuliah.map(row => row.id)));
  if (jadwalKuliahRows.length !== data.jadwalKuliah.length) throw new Error('Unexpected demo jadwalKuliah record count.');
  assertFixtureRows(data.jadwalKuliah, jadwalKuliahRows);
  const krsRows = await tx.select().from(schema.krs).where(inArray(schema.krs.id, data.krs.map(row => row.id)));
  if (krsRows.length !== data.krs.length) throw new Error('Unexpected demo krs record count.');
  assertFixtureRows(data.krs, krsRows);
  const krsDetailRows = await tx.select().from(schema.krsDetail).where(inArray(schema.krsDetail.krsId, data.krs.map(row => row.id)));
  if (krsDetailRows.length !== data.krsDetail.length) throw new Error('Unexpected demo krsDetail record count.');
  assertFixtureRows(data.krsDetail, krsDetailRows);

  // Check every overlapping schedule involving a seeded class, including non-seed resources.
  const classIds = sql.join(data.kelasKuliah.map(row => sql`${row.id}::uuid`), sql`, `);
  const conflicts = await tx.execute(sql`
    select a.id from jadwal_kuliah a
    join kelas_kuliah ca on ca.id = a.kelas_kuliah_id
    join semester sa on sa.id = ca.semester_id
    join jadwal_kuliah b on a.id <> b.id and a.hari = b.hari
      and a.jam_mulai < b.jam_selesai and b.jam_mulai < a.jam_selesai
    join kelas_kuliah cb on cb.id = b.kelas_kuliah_id
    join semester sb on sb.id = cb.semester_id
    where ca.id in (${classIds}) and ca.status <> 'DIBATALKAN' and cb.status <> 'DIBATALKAN'
      and exists (
        select 1 from generate_series(greatest(sa.tanggal_mulai, sb.tanggal_mulai)::timestamp,
          least(sa.tanggal_selesai, sb.tanggal_selesai)::timestamp, interval '1 day') as days(day)
        where extract(isodow from day) = a.hari
      )
      and (a.ruangan_id = b.ruangan_id or ca.id = cb.id or exists (
        select 1 from kelas_dosen da join kelas_dosen db on da.dosen_id = db.dosen_id
        where da.kelas_kuliah_id = ca.id and db.kelas_kuliah_id = cb.id
      ))
    limit 1
  `);
  if (conflicts.length) throw new Error('Demo schedules conflict with existing room, class, or lecturer schedules.');

  // Exact fixture checks above guarantee eligibility, distinct courses, rooms, and workflow fields.
  // Include all approved enrollments (not only demo students) in capacity/count verification.
  const counts = await tx.select({
    id: schema.kelasKuliah.id,
    nama: schema.mataKuliah.nama,
    namaKelas: schema.kelasKuliah.namaKelas,
    kapasitas: schema.kelasKuliah.kapasitas,
    jumlahMahasiswa: sql<number>`count(${schema.krsDetail.id}) filter (
      where ${schema.krsDetail.status} = 'AKTIF' and ${schema.krs.status} = 'DISETUJUI'
    )`.mapWith(Number),
  }).from(schema.kelasKuliah)
    .innerJoin(schema.mataKuliah, eq(schema.mataKuliah.id, schema.kelasKuliah.mataKuliahId))
    .leftJoin(schema.krsDetail, eq(schema.krsDetail.kelasKuliahId, schema.kelasKuliah.id))
    .leftJoin(schema.krs, eq(schema.krs.id, schema.krsDetail.krsId))
    .where(inArray(schema.kelasKuliah.id, data.kelasKuliah.map(row => row.id)))
    .groupBy(schema.kelasKuliah.id, schema.mataKuliah.nama);
  for (const row of counts) {
    if (row.jumlahMahasiswa > row.kapasitas) throw new Error('Demo class capacity exceeded.');
  }
  for (const plan of data.krs) {
    const details = data.krsDetail.filter(detail => detail.krsId === plan.id);
    const courses = details.map(detail => {
      const offering = data.kelasKuliah.find(row => row.id === detail.kelasKuliahId)!;
      return data.mataKuliah.find(row => row.id === offering.mataKuliahId)!;
    });
    if (!courses.length || courses.reduce((sum, row) => sum + row.sks, 0) > plan.batasSks
      || new Set(courses.map(row => row.id)).size !== courses.length) {
      throw new Error('Invalid demo KRS credit selection.');
    }
  }
  return counts;
}

function retryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('code' in error && (error.code === '40001' || error.code === '40P01')) return true;
  return 'cause' in error && retryable(error.cause);
}

export async function seedDevelopment(url: string, password: string, environment: string | undefined) {
  requireDevelopmentTarget(url, environment);
  if (password.length < 12) throw new Error('SEED_PASSWORD must have at least 12 characters.');
  const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' });
  const data = developmentData(passwordHash, new Date());
  const { db, client } = createDatabase(url);
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.transaction(async tx => {
          // Development maintenance operation: serialize fixture writes and block concurrent
          // academic mutations while validating cross-table rules. No table contents are deleted.
          await tx.execute(sql`lock table users, fakultas, program_studi, kurikulum, mata_kuliah,
            kurikulum_matkul, semester, dosen, mahasiswa, ruangan, kelas_kuliah,
            kelas_dosen, jadwal_kuliah, krs, krs_detail in share row exclusive mode`);
          const existing = await tx.select({ id: schema.users.id }).from(schema.users)
            .where(eq(schema.users.id, data.users[0]!.id));
          const now = new Date();
          if (!existing.length) {
            await tx.insert(schema.users).values(data.users);
            await tx.insert(schema.fakultas).values(data.fakultas);
            await tx.insert(schema.programStudi).values(data.programStudi);
            await tx.insert(schema.kurikulum).values(data.kurikulum);
            await tx.insert(schema.mataKuliah).values(data.mataKuliah);
            await tx.insert(schema.kurikulumMatkul).values(data.kurikulumMatkul);
            await tx.insert(schema.semester).values(data.semester.map(row => ({ ...row, isActive: false })));
            await tx.insert(schema.dosen).values(data.dosen);
            await tx.insert(schema.mahasiswa).values(data.mahasiswa);
            await tx.insert(schema.ruangan).values(data.ruangan);
            await tx.insert(schema.kelasKuliah).values(data.kelasKuliah.map(row => ({ ...row, status: 'DRAFT' as const })));
            await tx.insert(schema.kelasDosen).values(data.kelasDosen);
            await tx.insert(schema.jadwalKuliah).values(data.jadwalKuliah);
            await tx.update(schema.kelasKuliah).set({ status: 'DIBUKA', updatedAt: now })
              .where(inArray(schema.kelasKuliah.id, data.kelasKuliah.map(row => row.id)));
          } else {
            // Add role accounts introduced after the original academic fixture without
            // rewriting the existing AKADEMIK password or any account timestamps.
            const existingUsers = await tx.select().from(schema.users)
              .where(inArray(schema.users.id, data.users.map(row => row.id)));
            const existingIds = new Set(existingUsers.map(row => row.id));
            assertFixtureRows(data.users.filter(row => existingIds.has(row.id)), existingUsers);
            const missingUsers = data.users.filter(row => !existingIds.has(row.id));
            if (missingUsers.length) await tx.insert(schema.users).values(missingUsers);
          }
          // Activate the term before submitting/approving KRS, preserving the partial unique index.
          await tx.update(schema.semester).set({ isActive: false, updatedAt: now })
            .where(and(eq(schema.semester.isActive, true), ne(schema.semester.id, data.semester[0]!.id)));
          await tx.update(schema.semester).set({ isActive: true, updatedAt: now })
            .where(and(eq(schema.semester.id, data.semester[0]!.id), eq(schema.semester.isActive, false)));
          // Keep the development fixture immediately usable without a permanently stale
          // calendar window. Reruns roll the window relative to the current Jakarta date.
          await tx.update(schema.semester).set({
            krsMulaiAt: data.semester[0]!.krsMulaiAt, krsSelesaiAt: data.semester[0]!.krsSelesaiAt, updatedAt: now,
          }).where(and(eq(schema.semester.id, data.semester[0]!.id), sql`(
            ${schema.semester.krsMulaiAt} IS DISTINCT FROM ${data.semester[0]!.krsMulaiAt!.toISOString()}::timestamptz
            OR ${schema.semester.krsSelesaiAt} IS DISTINCT FROM ${data.semester[0]!.krsSelesaiAt!.toISOString()}::timestamptz
          )`));
          if (!existing.length) {
            await tx.insert(schema.krs).values(data.krs.map(row => ({
              ...row, status: 'DRAFT' as const, diajukanAt: null, disetujuiAt: null, disetujuiOleh: null,
            })));
            await tx.insert(schema.krsDetail).values(data.krsDetail);
            for (const plan of data.krs) {
              await tx.update(schema.krs).set({ status: 'DIAJUKAN', diajukanAt: plan.diajukanAt, updatedAt: now })
                .where(eq(schema.krs.id, plan.id));
              await tx.update(schema.krs).set({
                status: 'DISETUJUI', disetujuiAt: plan.disetujuiAt, disetujuiOleh: plan.disetujuiOleh, updatedAt: now,
              }).where(eq(schema.krs.id, plan.id));
            }
          }
          // Upgrade the original unlinked profiles in place. Drizzle does not
          // auto-update updated_at, so their existing fixture timestamps remain stable.
          const linkedDosen = data.dosen.find(row => row.userId !== null)!;
          await tx.update(schema.dosen).set({ userId: linkedDosen.userId })
            .where(and(eq(schema.dosen.id, linkedDosen.id), isNull(schema.dosen.userId)));
          const linkedMahasiswa = data.mahasiswa.find(row => row.userId !== null)!;
          await tx.update(schema.mahasiswa).set({ userId: linkedMahasiswa.userId, dosenPaId: linkedMahasiswa.dosenPaId })
            .where(eq(schema.mahasiswa.id, linkedMahasiswa.id));
          // Validation runs before COMMIT; any mismatch or collision rolls back the entire seed.
          return await verifyFixtures(tx, data);
        }, { isolationLevel: 'serializable' });
      } catch (error) {
        if (attempt >= 2 || !retryable(error)) throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  try {
    const counts = await seedDevelopment(
      process.env.DATABASE_URL ?? '', process.env.SEED_PASSWORD ?? '', process.env.NODE_ENV,
    );
    console.table(counts.map(({ nama, namaKelas, jumlahMahasiswa }) => ({ mataKuliah: nama, kelas: namaKelas, jumlahMahasiswa })));
    console.log('Development seed complete. Existing demo passwords are preserved.');
  } catch (error) {
    // Drizzle errors can contain query parameters, including hashes; do not log those.
    console.error(error instanceof Error && !('cause' in error) ? error.message : 'Development seed failed; transaction rolled back. Check connectivity, migrations, or conflicting demo identifiers.');
    process.exitCode = 1;
  }
}
