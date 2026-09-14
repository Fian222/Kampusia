import { expect, test } from 'bun:test';
import { sql, type SQL } from 'drizzle-orm';
import {
  absensi,
  fakultas,
  kelasKuliah,
  kurikulum,
  mahasiswa,
  mataKuliah,
  pertemuan,
  programStudi,
  semester,
  users,
} from '../schema';
import { createDatabase } from './index';

const enabled = Bun.env.RUN_ATTENDANCE_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL pertemuan and absensi schema contracts reject invalid records (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') {
    throw new Error('Attendance database tests require the local kampusia database.');
  }

  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback attendance schema fixtures');
  const prefix = `AT${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    await expect(db.transaction(async (tx) => {
      const tableRows = await tx.execute(sql<{ table_name: string }>`
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_name in ('pertemuan', 'absensi')
        order by table_name
      `);
      expect(tableRows.map((row) => row.table_name)).toEqual(['absensi', 'pertemuan']);

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
          and tc.table_name in ('pertemuan', 'absensi')
        order by tc.table_name, kcu.column_name
      `);
      expect(foreignKeys.map((row) => ({
        from: `${row.table_name}.${row.column_name}`,
        to: `${row.foreign_table_name}.${row.foreign_column_name}`,
        onDelete: row.delete_rule,
        onUpdate: row.update_rule,
      }))).toEqual([
        { from: 'absensi.dicatat_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'absensi.diubah_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'absensi.mahasiswa_id', to: 'mahasiswa.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'absensi.pertemuan_id', to: 'pertemuan.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'pertemuan.kelas_kuliah_id', to: 'kelas_kuliah.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
      ]);

      const constraintNames = await tx.execute(sql<{ conname: string }>`
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname in ('pertemuan', 'absensi')
      `);
      const names = constraintNames.map((row) => row.conname);
      for (const name of [
        'pertemuan_kelas_kuliah_id_nomor_pertemuan_unique',
        'pertemuan_nomor_pertemuan_positive_check',
        'pertemuan_jam_range_check',
        'pertemuan_status_check',
        'pertemuan_materi_nonblank_check',
        'absensi_pertemuan_id_mahasiswa_id_unique',
        'absensi_status_check',
        'absensi_keterangan_nonblank_check',
        'absensi_dicatat_oleh_users_id_fk',
        'absensi_diubah_oleh_users_id_fk',
      ]) expect(names).toContain(name);

      const usedYears = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map((row) => row.year));
      let year = 9800;
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
      const students = await tx.insert(mahasiswa).values(Array.from({ length: 7 }, (_, index) => ({
        programStudiId: program!.id,
        kurikulumId: curriculum!.id,
        nim: `${prefix}${index + 1}`,
        nama: `${prefix} ${index + 1}`,
        angkatan: 2026,
      }))).returning();
      const [actor] = await tx.insert(users).values({
        email: `${prefix.toLowerCase()}@example.test`,
        passwordHash: 'unused-test-hash',
        role: 'AKADEMIK',
      }).returning();

      const [meeting] = await tx.insert(pertemuan).values({
        kelasKuliahId: offering!.id,
        nomorPertemuan: 1,
        tanggal: `${year}-02-01`,
        jamMulai: '08:00',
        jamSelesai: '09:30',
      }).returning();
      expect(meeting!.status).toBe('TERJADWAL');
      expect(await tx.select().from(absensi)).toHaveLength(0);

      const expectRejected = async (statement: SQL) => {
        await expect(tx.transaction((savepoint) => savepoint.execute(statement))).rejects.toThrow();
      };

      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai)
        values (${offering!.id}, 1, ${`${year}-02-08`}, '08:00', '09:30')
      `);
      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai)
        values (${offering!.id}, 0, ${`${year}-02-08`}, '08:00', '09:30')
      `);
      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai)
        values (${offering!.id}, 2, ${`${year}-02-08`}, '10:00', '09:30')
      `);
      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai, status)
        values (${offering!.id}, 2, ${`${year}-02-08`}, '08:00', '09:30', 'INVALID')
      `);
      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai, materi)
        values (${offering!.id}, 2, ${`${year}-02-08`}, '08:00', '09:30', '   ')
      `);
      await expectRejected(sql`
        insert into pertemuan (kelas_kuliah_id, nomor_pertemuan, tanggal, jam_mulai, jam_selesai)
        values (${crypto.randomUUID()}, 2, ${`${year}-02-08`}, '08:00', '09:30')
      `);

      const [attendance] = await tx.insert(absensi).values({
        pertemuanId: meeting!.id,
        mahasiswaId: students[0]!.id,
        status: 'HADIR',
        dicatatOleh: actor!.id,
        diubahOleh: actor!.id,
      }).returning();
      expect(attendance!.status).toBe('HADIR');

      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[0]!.id}, 'ALPHA', ${actor!.id}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[1]!.id}, ${actor!.id}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[2]!.id}, 'INVALID', ${actor!.id}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, keterangan, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[3]!.id}, 'IZIN', '   ', ${actor!.id}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[4]!.id}, 'SAKIT', ${crypto.randomUUID()}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${students[5]!.id}, 'SAKIT', ${actor!.id}, ${crypto.randomUUID()})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${meeting!.id}, ${crypto.randomUUID()}, 'SAKIT', ${actor!.id}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into absensi (pertemuan_id, mahasiswa_id, status, dicatat_oleh, diubah_oleh)
        values (${crypto.randomUUID()}, ${students[6]!.id}, 'SAKIT', ${actor!.id}, ${actor!.id})
      `);

      throw rollback;
    })).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
}, 30000);
