import { expect, test } from 'bun:test';
import { sql, type SQL } from 'drizzle-orm';
import {
  dosen,
  fakultas,
  krs,
  kurikulum,
  mahasiswa,
  programStudi,
  semester,
  users,
} from '../schema';
import { createDatabase } from './index';

const enabled = Bun.env.RUN_KRS_ADVISING_DB_TESTS === '1';

test.skipIf(!enabled)('PostgreSQL KRS advising schema enforces documented contracts (rolled back)', async () => {
  const url = new URL(Bun.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/kampusia') {
    throw new Error('KRS advising database tests require the local kampusia database.');
  }

  const { db, client } = createDatabase(url.toString());
  const rollback = new Error('Rollback KRS advising schema fixtures');
  const prefix = `KA${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    await expect(db.transaction(async (tx) => {
      const expectRejected = async (statement: SQL) => {
        await expect(tx.transaction((savepoint) => savepoint.execute(statement))).rejects.toThrow();
      };

      const columns = await tx.execute(sql<{
        table_name: string;
        column_name: string;
        is_nullable: string;
        data_type: string;
      }>`
        select table_name, column_name, is_nullable, data_type
        from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('semester', 'krs_mulai_at'),
            ('semester', 'krs_selesai_at'),
            ('mahasiswa', 'dosen_pa_id'),
            ('krs', 'ditolak_at'),
            ('krs', 'ditolak_oleh'),
            ('krs', 'alasan_penolakan'),
            ('krs', 'dibuka_kembali_at'),
            ('krs', 'dibuka_kembali_oleh'),
            ('krs', 'dibatalkan_at'),
            ('krs', 'dibatalkan_oleh'),
            ('krs', 'alasan_pembatalan')
          )
        order by table_name, column_name
      `);
      expect(columns).toHaveLength(11);
      expect(columns.every((row) => row.is_nullable === 'YES')).toBe(true);
      expect(columns.filter((row) => String(row.column_name).endsWith('_at'))
        .every((row) => row.data_type === 'timestamp with time zone')).toBe(true);

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
          and (
            (tc.table_name = 'mahasiswa' and kcu.column_name = 'dosen_pa_id')
            or (tc.table_name = 'krs' and kcu.column_name in (
              'disetujui_oleh', 'ditolak_oleh', 'dibuka_kembali_oleh', 'dibatalkan_oleh'
            ))
          )
        order by tc.table_name, kcu.column_name
      `);
      expect(foreignKeys.map((row) => ({
        from: `${row.table_name}.${row.column_name}`,
        to: `${row.foreign_table_name}.${row.foreign_column_name}`,
        onDelete: row.delete_rule,
        onUpdate: row.update_rule,
      }))).toEqual([
        { from: 'krs.dibatalkan_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'krs.dibuka_kembali_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'krs.disetujui_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'krs.ditolak_oleh', to: 'users.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
        { from: 'mahasiswa.dosen_pa_id', to: 'dosen.id', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
      ]);

      const constraints = await tx.execute(sql<{ conname: string }>`
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname in ('semester', 'krs')
      `);
      const constraintNames = constraints.map((row) => row.conname);
      for (const name of [
        'semester_krs_window_check',
        'krs_status_check',
        'krs_approval_pair_check',
        'krs_rejection_fields_check',
        'krs_reopening_pair_check',
        'krs_cancellation_fields_check',
        'krs_event_timestamps_check',
        'krs_status_timestamps_check',
      ]) expect(constraintNames).toContain(name);

      const indexes = await tx.execute(sql<{ indexname: string }>`
        select indexname from pg_indexes
        where schemaname = 'public' and tablename = 'mahasiswa'
      `);
      expect(indexes.map((row) => row.indexname)).toContain('mahasiswa_dosen_pa_id_idx');

      const usedYears = new Set((await tx.select({ year: semester.tahunMulai }).from(semester)).map((row) => row.year));
      let year = 9600;
      while (usedYears.has(year)) year -= 1;

      const [faculty] = await tx.insert(fakultas).values({ kode: prefix, nama: prefix }).returning();
      const [program] = await tx.insert(programStudi).values({
        fakultasId: faculty!.id,
        kode: prefix,
        nama: prefix,
        jenjang: 'S1',
      }).returning();
      const [curriculum] = await tx.insert(kurikulum).values({
        programStudiId: program!.id,
        kode: prefix,
        nama: prefix,
        tahunBerlaku: 2026,
      }).returning();
      const [adviser] = await tx.insert(dosen).values({
        programStudiId: program!.id,
        kodeDosen: prefix,
        nama: prefix,
      }).returning();
      const [actor] = await tx.insert(users).values({
        email: `${prefix.toLowerCase()}@example.test`,
        passwordHash: 'unused-test-hash',
        role: 'AKADEMIK',
      }).returning();
      const students = await tx.insert(mahasiswa).values(Array.from({ length: 14 }, (_, index) => ({
        programStudiId: program!.id,
        kurikulumId: curriculum!.id,
        dosenPaId: index === 0 ? adviser!.id : null,
        nim: `${prefix}${index + 1}`,
        nama: `${prefix} ${index + 1}`,
        angkatan: 2026,
      }))).returning();

      const [nullWindow] = await tx.insert(semester).values({
        kode: `${year}1`,
        nama: prefix,
        tahunMulai: year,
        jenis: 'GANJIL',
        tanggalMulai: `${year}-01-01`,
        tanggalSelesai: `${year}-06-30`,
      }).returning();
      expect(nullWindow!.krsMulaiAt).toBeNull();
      expect(nullWindow!.krsSelesaiAt).toBeNull();

      const krsMulaiAt = new Date('2026-08-01T00:00:00.000Z');
      const krsSelesaiAt = new Date('2026-08-15T00:00:00.000Z');
      await tx.update(semester).set({ krsMulaiAt, krsSelesaiAt }).where(sql`${semester.id} = ${nullWindow!.id}`);
      await expectRejected(sql`
        update semester set krs_mulai_at = ${krsMulaiAt}, krs_selesai_at = null
        where id = ${nullWindow!.id}
      `);
      await expectRejected(sql`
        update semester set krs_mulai_at = null, krs_selesai_at = ${krsSelesaiAt}
        where id = ${nullWindow!.id}
      `);
      await expectRejected(sql`
        update semester set krs_mulai_at = ${krsSelesaiAt}, krs_selesai_at = ${krsSelesaiAt}
        where id = ${nullWindow!.id}
      `);
      await expectRejected(sql`
        update semester set krs_mulai_at = ${new Date('2026-08-16T00:00:00.000Z')}, krs_selesai_at = ${krsSelesaiAt}
        where id = ${nullWindow!.id}
      `);

      await tx.insert(mahasiswa).values({
        programStudiId: program!.id,
        kurikulumId: curriculum!.id,
        nim: `${prefix}NULL`,
        nama: `${prefix} nullable adviser`,
        angkatan: 2026,
      });
      await expectRejected(sql`
        update mahasiswa set dosen_pa_id = ${crypto.randomUUID()} where id = ${students[1]!.id}
      `);
      await expectRejected(sql`delete from dosen where id = ${adviser!.id}`);
      await expectRejected(sql`update dosen set id = ${crypto.randomUUID()} where id = ${adviser!.id}`);

      const createdAt = new Date('2026-08-01T00:00:00.000Z');
      const submittedAt = new Date('2026-08-02T00:00:00.000Z');
      const decidedAt = new Date('2026-08-03T00:00:00.000Z');
      const reopenedAt = new Date('2026-08-04T00:00:00.000Z');

      await tx.insert(krs).values([
        {
          mahasiswaId: students[0]!.id,
          semesterId: nullWindow!.id,
          status: 'DRAFT',
          batasSks: 18,
          disetujuiAt: decidedAt,
          disetujuiOleh: actor!.id,
          dibukaKembaliAt: reopenedAt,
          dibukaKembaliOleh: actor!.id,
          createdAt,
        },
        {
          mahasiswaId: students[1]!.id,
          semesterId: nullWindow!.id,
          status: 'DIAJUKAN',
          batasSks: 18,
          diajukanAt: submittedAt,
          createdAt,
        },
        {
          mahasiswaId: students[2]!.id,
          semesterId: nullWindow!.id,
          status: 'DISETUJUI',
          batasSks: 18,
          diajukanAt: submittedAt,
          disetujuiAt: decidedAt,
          disetujuiOleh: actor!.id,
          createdAt,
        },
        {
          mahasiswaId: students[3]!.id,
          semesterId: nullWindow!.id,
          status: 'DITOLAK',
          batasSks: 18,
          diajukanAt: submittedAt,
          ditolakAt: decidedAt,
          ditolakOleh: actor!.id,
          alasanPenolakan: 'Jadwal perlu diperbaiki',
          createdAt,
        },
        {
          mahasiswaId: students[4]!.id,
          semesterId: nullWindow!.id,
          status: 'DIBATALKAN',
          batasSks: 18,
          dibatalkanAt: decidedAt,
          dibatalkanOleh: actor!.id,
          alasanPembatalan: 'Koreksi administratif',
          createdAt,
        },
      ]);

      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, diajukan_at)
        values (${students[5]!.id}, ${nullWindow!.id}, 'DRAFT', 18, ${submittedAt})
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks)
        values (${students[5]!.id}, ${nullWindow!.id}, 'DIAJUKAN', 18)
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, diajukan_at, ditolak_at, ditolak_oleh)
        values (${students[5]!.id}, ${nullWindow!.id}, 'DITOLAK', 18, ${submittedAt}, ${decidedAt}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, diajukan_at, ditolak_at, ditolak_oleh, alasan_penolakan)
        values (${students[6]!.id}, ${nullWindow!.id}, 'DITOLAK', 18, ${submittedAt}, ${decidedAt}, ${actor!.id}, '   ')
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, dibuka_kembali_at)
        values (${students[7]!.id}, ${nullWindow!.id}, 'DRAFT', 18, ${reopenedAt})
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, dibatalkan_at, dibatalkan_oleh, alasan_pembatalan)
        values (${students[8]!.id}, ${nullWindow!.id}, 'DIBATALKAN', 18, ${decidedAt}, ${actor!.id}, '   ')
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, created_at, diajukan_at)
        values (${students[9]!.id}, ${nullWindow!.id}, 'DIAJUKAN', 18, ${submittedAt}, ${createdAt})
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, diajukan_at, disetujui_at, disetujui_oleh)
        values (${students[10]!.id}, ${nullWindow!.id}, 'DISETUJUI', 18, ${decidedAt}, ${submittedAt}, ${actor!.id})
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks, diajukan_at, ditolak_at, ditolak_oleh, alasan_penolakan)
        values (${students[11]!.id}, ${nullWindow!.id}, 'DITOLAK', 18, ${submittedAt}, ${decidedAt}, ${crypto.randomUUID()}, 'Tidak valid')
      `);
      await expectRejected(sql`
        insert into krs (mahasiswa_id, semester_id, status, batas_sks)
        values (${students[12]!.id}, ${nullWindow!.id}, 'KOSONG', 18)
      `);
      await expectRejected(sql`delete from users where id = ${actor!.id}`);

      throw rollback;
    })).rejects.toBe(rollback);
  } finally {
    await client.end();
  }
}, 30000);
