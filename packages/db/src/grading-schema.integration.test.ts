import { expect, test } from 'bun:test';
import { sql, type SQL } from 'drizzle-orm';
import {
  fakultas,
  hasilStudi,
  kelasKuliah,
  komponenNilai,
  kurikulum,
  mahasiswa,
  mataKuliah,
  nilaiMahasiswa,
  programStudi,
  semester,
  users,
} from '../schema';
import { createDatabase } from './index';

const enabled = Bun.env.RUN_GRADING_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL grading schema enforces documented row-local contracts (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') {
    throw new Error('Grading database tests require the local kampusia database.');
  }

  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback grading schema fixtures');
  const prefix = `GR${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    await expect(db.transaction(async (tx) => {
      const tableRows = await tx.execute(sql<{ table_name: string }>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('komponen_nilai', 'nilai_mahasiswa', 'hasil_studi')
        order by table_name
      `);
      expect(tableRows.map((row) => row.table_name)).toEqual([
        'hasil_studi',
        'komponen_nilai',
        'nilai_mahasiswa',
      ]);

      const foreignKeys = await tx.execute(sql<{
        table_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        delete_rule: string;
        update_rule: string;
      }>`
        select
          tc.table_name,
          kcu.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
        join information_schema.referential_constraints rc
          on rc.constraint_schema = tc.constraint_schema
         and rc.constraint_name = tc.constraint_name
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_schema = rc.unique_constraint_schema
         and ccu.constraint_name = rc.unique_constraint_name
        where tc.constraint_schema = 'public'
          and tc.constraint_type = 'FOREIGN KEY'
          and tc.table_name in ('komponen_nilai', 'nilai_mahasiswa', 'hasil_studi')
        order by tc.table_name, kcu.column_name
      `);
      expect(foreignKeys.map((row) => ({
        from: `${row.table_name}.${row.column_name}`,
        to: `${row.foreign_table_name}.${row.foreign_column_name}`,
        onDelete: row.delete_rule,
        onUpdate: row.update_rule,
      }))).toEqual([
        { from: 'hasil_studi.difinalisasi_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'hasil_studi.dikoreksi_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'hasil_studi.kelas_kuliah_id', to: 'kelas_kuliah.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'hasil_studi.mahasiswa_id', to: 'mahasiswa.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'komponen_nilai.kelas_kuliah_id', to: 'kelas_kuliah.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'nilai_mahasiswa.dicatat_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'nilai_mahasiswa.diubah_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'nilai_mahasiswa.komponen_nilai_id', to: 'komponen_nilai.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'nilai_mahasiswa.mahasiswa_id', to: 'mahasiswa.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
      ]);

      const constraintRows = await tx.execute(sql<{ conname: string }>`
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname in ('komponen_nilai', 'nilai_mahasiswa', 'hasil_studi')
      `);
      const constraintNames = constraintRows.map((row) => row.conname);
      for (const name of [
        'komponen_nilai_bobot_range_check',
        'komponen_nilai_urutan_positive_check',
        'komponen_nilai_nama_nonblank_check',
        'nilai_mahasiswa_komponen_nilai_id_mahasiswa_id_unique',
        'nilai_mahasiswa_nilai_range_check',
        'hasil_studi_kelas_kuliah_id_mahasiswa_id_unique',
        'hasil_studi_nilai_angka_range_check',
        'hasil_studi_nilai_indeks_nonnegative_check',
        'hasil_studi_nilai_huruf_canonical_check',
        'hasil_studi_koreksi_fields_check',
        'hasil_studi_dikoreksi_at_range_check',
      ]) expect(constraintNames).toContain(name);

      const indexRows = await tx.execute(sql<{ indexname: string }>`
        select indexname
        from pg_indexes
        where schemaname = 'public'
          and tablename in ('komponen_nilai', 'nilai_mahasiswa', 'hasil_studi')
      `);
      const indexNames = indexRows.map((row) => row.indexname);
      for (const name of [
        'komponen_nilai_active_nama_unique',
        'komponen_nilai_kelas_kuliah_id_is_active_urutan_id_idx',
        'nilai_mahasiswa_mahasiswa_id_komponen_nilai_id_idx',
        'hasil_studi_mahasiswa_id_kelas_kuliah_id_idx',
      ]) expect(indexNames).toContain(name);

      const usedYears = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map((row) => row.year));
      let year = 9700;
      while (usedYears.has(year)) year -= 1;

      const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
      const [program] = await tx.insert(programStudi).values({
        fakultasId: faculty!.id,
        kode: prefix,
        nama: prefix,
        jenjang: 'S1',
      }).returning();
      const [course] = await tx.insert(mataKuliah).values({ kode: prefix, nama: prefix, sks: 3 }).returning();
      const [curriculum] = await tx.insert(kurikulum).values({
        programStudiId: program!.id,
        kode: prefix,
        nama: prefix,
        tahunBerlaku: 2026,
      }).returning();
      const [term] = await tx.insert(semester).values({
        kode: `${year}1`,
        nama: prefix,
        tahunMulai: year,
        jenis: 'GANJIL',
        tanggalMulai: `${year}-01-01`,
        tanggalSelesai: `${year}-06-30`,
      }).returning();
      const [offering] = await tx.insert(kelasKuliah).values({
        semesterId: term!.id,
        mataKuliahId: course!.id,
        programStudiId: program!.id,
        namaKelas: 'A',
        kapasitas: 30,
      }).returning();
      const students = await tx.insert(mahasiswa).values(Array.from({ length: 5 }, (_, index) => ({
        programStudiId: program!.id,
        kurikulumId: curriculum!.id,
        nim: `${prefix}${index + 1}`,
        nama: `${prefix} ${index + 1}`,
        angkatan: 2026,
      }))).returning();
      const actors = await tx.insert(users).values([
        {
          email: `${prefix.toLowerCase()}-finalizer@example.test`,
          passwordHash: 'unused-test-hash',
          role: 'AKADEMIK' as const,
        },
        {
          email: `${prefix.toLowerCase()}-corrector@example.test`,
          passwordHash: 'unused-test-hash',
          role: 'ADMIN' as const,
        },
      ]).returning();

      const expectRejected = async (statement: SQL) => {
        await expect(tx.transaction((savepoint) => savepoint.execute(statement))).rejects.toThrow();
      };

      for (const bobot of ['0', '-0.01', '100.01']) {
        await expectRejected(sql`
          insert into komponen_nilai (kelas_kuliah_id, nama, bobot, urutan)
          values (${offering!.id}, ${`Invalid weight ${bobot}`}, ${bobot}, 1)
        `);
      }
      await expectRejected(sql`
        insert into komponen_nilai (kelas_kuliah_id, nama, bobot, urutan)
        values (${offering!.id}, 'Invalid order', 50, 0)
      `);
      await expectRejected(sql`
        insert into komponen_nilai (kelas_kuliah_id, nama, bobot, urutan)
        values (${offering!.id}, '   ', 50, 1)
      `);
      await expectRejected(sql`
        insert into komponen_nilai (kelas_kuliah_id, nama, bobot, urutan)
        values (${crypto.randomUUID()}, 'Invalid class', 50, 1)
      `);

      const [component] = await tx.insert(komponenNilai).values({
        kelasKuliahId: offering!.id,
        nama: 'Tugas',
        bobot: '60.00',
        urutan: 1,
      }).returning();
      expect(component!.isActive).toBe(true);
      await expectRejected(sql`
        insert into komponen_nilai (kelas_kuliah_id, nama, bobot, urutan)
        values (${offering!.id}, ' tugas ', 40, 2)
      `);
      await tx.insert(komponenNilai).values({
        kelasKuliahId: offering!.id,
        nama: ' tugas ',
        bobot: '40.00',
        urutan: 2,
        isActive: false,
      });

      const [missingScore] = await tx.insert(nilaiMahasiswa).values({
        komponenNilaiId: component!.id,
        mahasiswaId: students[0]!.id,
        nilai: null,
        dicatatOleh: actors[0]!.id,
        diubahOleh: actors[0]!.id,
      }).returning();
      expect(missingScore!.nilai).toBeNull();

      const [zeroScore] = await tx.insert(nilaiMahasiswa).values({
        komponenNilaiId: component!.id,
        mahasiswaId: students[1]!.id,
        nilai: '0.00',
        dicatatOleh: actors[0]!.id,
        diubahOleh: actors[0]!.id,
      }).returning();
      expect(zeroScore!.nilai).toBe('0.00');

      await expectRejected(sql`
        insert into nilai_mahasiswa (komponen_nilai_id, mahasiswa_id, nilai, dicatat_oleh, diubah_oleh)
        values (${component!.id}, ${students[1]!.id}, 75, ${actors[0]!.id}, ${actors[0]!.id})
      `);
      for (const nilai of ['-0.01', '100.01']) {
        await expectRejected(sql`
          insert into nilai_mahasiswa (komponen_nilai_id, mahasiswa_id, nilai, dicatat_oleh, diubah_oleh)
          values (${component!.id}, ${students[2]!.id}, ${nilai}, ${actors[0]!.id}, ${actors[0]!.id})
        `);
      }
      await expectRejected(sql`
        insert into nilai_mahasiswa (komponen_nilai_id, mahasiswa_id, nilai, dicatat_oleh, diubah_oleh)
        values (${component!.id}, ${students[2]!.id}, 75, ${crypto.randomUUID()}, ${actors[0]!.id})
      `);
      await expectRejected(sql`
        insert into nilai_mahasiswa (komponen_nilai_id, mahasiswa_id, nilai, dicatat_oleh, diubah_oleh)
        values (${component!.id}, ${students[2]!.id}, 75, ${actors[0]!.id}, ${crypto.randomUUID()})
      `);

      const finalizedAt = new Date('2026-09-15T08:00:00.000Z');
      const [result] = await tx.insert(hasilStudi).values({
        kelasKuliahId: offering!.id,
        mahasiswaId: students[0]!.id,
        nilaiAngka: '0.00',
        nilaiHuruf: 'E',
        nilaiIndeks: '0.00',
        difinalisasiAt: finalizedAt,
        difinalisasiOleh: actors[0]!.id,
      }).returning();
      expect(result!.nilaiAngka).toBe('0.00');
      expect(result!.dikoreksiAt).toBeNull();
      expect(result!.dikoreksiOleh).toBeNull();
      expect(result!.alasanKoreksi).toBeNull();

      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh
        ) values (
          ${offering!.id}, ${students[0]!.id}, 80, 'B', 3,
          ${finalizedAt}, ${actors[0]!.id}
        )
      `);
      for (const nilaiAngka of ['-0.01', '100.01']) {
        await expectRejected(sql`
          insert into hasil_studi (
            kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
            difinalisasi_at, difinalisasi_oleh
          ) values (
            ${offering!.id}, ${students[2]!.id}, ${nilaiAngka}, 'B', 3,
            ${finalizedAt}, ${actors[0]!.id}
          )
        `);
      }
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'b', 3,
          ${finalizedAt}, ${actors[0]!.id}
        )
      `);
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'B', -0.01,
          ${finalizedAt}, ${actors[0]!.id}
        )
      `);
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh, dikoreksi_at
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'B', 3,
          ${finalizedAt}, ${actors[0]!.id}, ${new Date('2026-09-15T09:00:00.000Z')}
        )
      `);
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh, dikoreksi_at, dikoreksi_oleh, alasan_koreksi
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'B', 3,
          ${finalizedAt}, ${actors[0]!.id}, ${new Date('2026-09-15T09:00:00.000Z')}, ${actors[1]!.id}, '   '
        )
      `);
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh, dikoreksi_at, dikoreksi_oleh, alasan_koreksi
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'B', 3,
          ${finalizedAt}, ${actors[0]!.id}, ${new Date('2026-09-15T07:59:59.000Z')}, ${actors[1]!.id}, 'Correction'
        )
      `);
      await expectRejected(sql`
        insert into hasil_studi (
          kelas_kuliah_id, mahasiswa_id, nilai_angka, nilai_huruf, nilai_indeks,
          difinalisasi_at, difinalisasi_oleh
        ) values (
          ${offering!.id}, ${students[2]!.id}, 80, 'B', 3,
          ${finalizedAt}, ${crypto.randomUUID()}
        )
      `);

      const [corrected] = await tx.insert(hasilStudi).values({
        kelasKuliahId: offering!.id,
        mahasiswaId: students[2]!.id,
        nilaiAngka: '80.00',
        nilaiHuruf: 'B',
        nilaiIndeks: '3.00',
        difinalisasiAt: finalizedAt,
        difinalisasiOleh: actors[0]!.id,
        dikoreksiAt: new Date('2026-09-15T09:00:00.000Z'),
        dikoreksiOleh: actors[1]!.id,
        alasanKoreksi: 'Correction',
      }).returning();
      expect(corrected!.dikoreksiOleh).toBe(actors[1]!.id);

      // Restrictive references retain source configuration and actor history.
      await expectRejected(sql`delete from komponen_nilai where id = ${component!.id}`);
      await expectRejected(sql`delete from users where id = ${actors[0]!.id}`);

      throw rollback;
    })).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
}, 30000);
