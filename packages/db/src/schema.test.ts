import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import { createDatabase } from './index';

const design = readFileSync(new URL('../../../docs/DATABASE.md', import.meta.url), 'utf8');
const identityMigration = readFileSync(new URL('../migrations/0004_ordinary_donald_blake.sql', import.meta.url), 'utf8');
const dialect = new PgDialect();
const tables = Object.values(schema).filter((value) => is(value, PgTable));
const sections = [...design.matchAll(/^### ([a-z_]+)\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
const sqlText = (value: unknown) => is(value, SQL) ? dialect.sqlToQuery(value).sql : value;
const normalizeType = (value: string) => value
  .replace('timestamp with time zone', 'timestamptz')
  .replace('time without time zone', 'time')
  .replace(/,\s+/g, ',');

describe('DATABASE.md schema contract', () => {
  test('identity migration uses only documented fixture mappings and safe student backfill', () => {
    for (const value of ['99000001', '99000002', '99000003', '99202601']) {
      expect(identityMigration).toContain(value);
    }
    for (const value of ['DEV20260001', 'DEV20260005', '99202605']) {
      expect(identityMigration).toContain(value);
    }
    expect(identityMigration).toContain('"m"."user_id" = "u"."id"');
    expect(identityMigration).toContain('"m"."nim" ~ \'^[0-9]+$\'');
    expect(identityMigration).toContain('"u"."login_id" IS NULL');
    expect(identityMigration).not.toMatch(/SET\s+"login_id"\s*=\s*[^;]*"email"/i);
    expect(identityMigration).not.toContain('ALTER COLUMN "login_id" SET NOT NULL');
  });

  test('exports exactly the documented tables', () => {
    expect(sections).toHaveLength(20);
    expect(tables.map((table) => getTableConfig(table).name).sort())
      .toEqual(sections.map((section) => section[1]!).sort());
  });

  for (const section of sections) {
    const name = section[1]!;
    const body = section[2]!;
    test(name + ' columns, defaults, nullability, unique keys, and indexes match the design', () => {
      const table = tables.find((entry) => getTableConfig(entry).name === name);
      expect(table).toBeDefined();
      const config = getTableConfig(table!);
      const rows = [...body.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| (No|Yes) \| ([^|]+) \|/gm)];
      expect(config.columns.map((column) => column.name).sort())
        .toEqual(rows.map((row) => row[1]!).sort());

      for (const row of rows) {
        const column = config.columns.find((entry) => entry.name === row[1])!;
        expect(normalizeType(column.getSQLType())).toBe(normalizeType(row[2]!));
        expect(column.notNull).toBe(row[3] === 'No');
        const documentedDefault = row[4]!.trim();
        const expectedDefault = documentedDefault === '—' ? undefined
          : documentedDefault === 'true' ? true
          : documentedDefault === 'false' ? false : documentedDefault;
        expect(sqlText(column.default)).toBe(expectedDefault);
        expect(column.primary).toBe(column.name === 'id');
      }

      const uniqueLine = body.match(/\*\*Unique constraints:\*\* ([^\r\n]+)/)![1]!;
      const expectedUnique = [...uniqueLine.matchAll(/UNIQUE \(([^)]+)\)/g)]
        .map((match) => match[1]!.replaceAll(' ', '')).sort();
      expect(config.uniqueConstraints.map((key) => key.columns.map((column) => column.name).join(',')).sort())
        .toEqual(expectedUnique);

      const indexLine = body.match(/\*\*Additional indexes:\*\* ([^\r\n]+)/)![1]!;
      const expectedIndexes = [...indexLine.matchAll(/`\(([^)]+)\)`/g)]
        .map((match) => match[1]!.replaceAll(' ', '')).sort();
      expect(config.indexes.filter((index) => !index.config.unique)
        .map((index) => index.config.columns.map((column) => {
          if (!('name' in column)) throw new Error('Unexpected expression index');
          return column.name;
        }).join(',')).sort()).toEqual(expectedIndexes);
    });
  }

  test('all foreign keys restrict deletion and updates', () => {
    const keys = tables.flatMap((table) => getTableConfig(table).foreignKeys);
    expect(keys).toHaveLength(39);
    for (const key of keys) {
      expect(key.onDelete).toBe('restrict');
      expect(key.onUpdate).toBe('restrict');
    }
  });

  test('identity-number authentication columns match the nullable migration phase', () => {
    const account = getTableConfig(schema.users);
    const loginId = account.columns.find((column) => column.name === 'login_id');
    const email = account.columns.find((column) => column.name === 'email');
    const mustChangePassword = account.columns.find((column) => column.name === 'must_change_password');
    expect(loginId?.getSQLType()).toBe('varchar(30)');
    expect(loginId?.notNull).toBe(false);
    expect(email?.getSQLType()).toBe('varchar(254)');
    expect(email?.notNull).toBe(false);
    expect(mustChangePassword?.notNull).toBe(true);
    expect(sqlText(mustChangePassword?.default)).toBe(false);
    expect(account.uniqueConstraints.map((key) => ({
      name: key.name,
      columns: key.columns.map((column) => column.name),
    }))).toContainEqual({ name: 'users_login_id_unique', columns: ['login_id'] });
    const loginCheck = account.checks.find((entry) => entry.name === 'users_login_id_digits_check');
    expect(loginCheck).toBeDefined();
    expect(sqlText(loginCheck?.value)).toBe('"users"."login_id" IS NULL OR "users"."login_id" ~ \'^[0-9]+$\'');

    const lecturer = getTableConfig(schema.dosen);
    const nik = lecturer.columns.find((column) => column.name === 'nik');
    expect(nik?.getSQLType()).toBe('varchar(30)');
    expect(nik?.notNull).toBe(false);
    expect(lecturer.uniqueConstraints.map((key) => ({
      name: key.name,
      columns: key.columns.map((column) => column.name),
    }))).toContainEqual({ name: 'dosen_nik_unique', columns: ['nik'] });
    const nikCheck = lecturer.checks.find((entry) => entry.name === 'dosen_nik_digits_check');
    expect(nikCheck).toBeDefined();
    expect(sqlText(nikCheck?.value)).toBe('"dosen"."nik" IS NULL OR "dosen"."nik" ~ \'^[0-9]+$\'');
  });

  test('student curriculum and program are enforced by one non-null composite reference', () => {
    const keys = getTableConfig(schema.mahasiswa).foreignKeys;
    const key = keys.find((entry) => entry.reference().foreignTable === schema.kurikulum)!;
    expect(key).toBeDefined();
    expect(keys.filter((entry) => entry.reference().foreignTable === schema.kurikulum)).toHaveLength(1);
    const reference = key.reference();
    expect(reference.columns.map((column) => column.name)).toEqual(['kurikulum_id', 'program_studi_id']);
    expect(reference.columns.every((column) => column.notNull)).toBe(true);
    expect(reference.foreignColumns.map((column) => column.name)).toEqual(['id', 'program_studi_id']);
  });

  test('KRS window, adviser, and transition metadata constraints match the documented contract', () => {
    expect(getTableConfig(schema.semester).checks.map((entry) => entry.name))
      .toContain('semester_krs_window_check');

    const student = getTableConfig(schema.mahasiswa);
    const adviserKey = student.foreignKeys.find((entry) =>
      entry.reference().columns[0]?.name === 'dosen_pa_id');
    expect(adviserKey?.reference().foreignTable).toBe(schema.dosen);
    expect(adviserKey?.onDelete).toBe('restrict');
    expect(adviserKey?.onUpdate).toBe('restrict');
    expect(student.indexes.map((entry) => entry.config.name)).toContain('mahasiswa_dosen_pa_id_idx');

    const plan = getTableConfig(schema.krs);
    expect(plan.checks.map((entry) => entry.name).sort()).toEqual([
      'krs_approval_pair_check',
      'krs_batas_sks_positive_check',
      'krs_cancellation_fields_check',
      'krs_event_timestamps_check',
      'krs_rejection_fields_check',
      'krs_reopening_pair_check',
      'krs_status_check',
      'krs_status_timestamps_check',
    ]);
    expect(plan.foreignKeys.filter((entry) => entry.reference().foreignTable === schema.users)
      .map((entry) => entry.reference().columns[0]?.name).sort()).toEqual([
      'dibatalkan_oleh',
      'dibuka_kembali_oleh',
      'disetujui_oleh',
      'ditolak_oleh',
    ]);
  });

  test('active semester and class coordinator uniqueness have the required predicates', () => {
    const active = getTableConfig(schema.semester).indexes.find((index) => index.config.unique)!;
    expect(active.config.columns.map((column) => 'name' in column ? column.name : undefined)).toEqual(['is_active']);
    expect(sqlText(active.config.where)).toBe('"semester"."is_active" = true');
    const coordinator = getTableConfig(schema.kelasDosen).indexes.find((index) => index.config.unique)!;
    expect(coordinator.config.columns.map((column) => 'name' in column ? column.name : undefined)).toEqual(['kelas_kuliah_id']);
    expect(sqlText(coordinator.config.where)).toBe('"kelas_dosen"."is_koordinator" = true');
  });

  test('classes have at most one regular schedule while meetings remain repeatable', () => {
    const schedules = getTableConfig(schema.jadwalKuliah);
    expect(schedules.uniqueConstraints.map((key) => ({
      name: key.name,
      columns: key.columns.map((column) => column.name),
    }))).toContainEqual({
      name: 'jadwal_kuliah_kelas_kuliah_id_unique',
      columns: ['kelas_kuliah_id'],
    });

    const meetings = getTableConfig(schema.pertemuan);
    expect(meetings.uniqueConstraints.map((key) => key.columns.map((column) => column.name)))
      .toContainEqual(['kelas_kuliah_id', 'nomor_pertemuan']);
  });

  test('attendance constraints and actor references match the documented contract', () => {
    const meeting = getTableConfig(schema.pertemuan);
    expect(meeting.uniqueConstraints.map((key) => key.columns.map((column) => column.name)))
      .toContainEqual(['kelas_kuliah_id', 'nomor_pertemuan']);
    expect(meeting.checks.map((entry) => entry.name).sort()).toEqual([
      'pertemuan_jam_range_check',
      'pertemuan_materi_nonblank_check',
      'pertemuan_nomor_pertemuan_positive_check',
      'pertemuan_status_check',
    ]);

    const attendance = getTableConfig(schema.absensi);
    expect(attendance.columns.find((column) => column.name === 'status')?.default).toBeUndefined();
    expect(attendance.uniqueConstraints.map((key) => key.columns.map((column) => column.name)))
      .toContainEqual(['pertemuan_id', 'mahasiswa_id']);
    expect(attendance.checks.map((entry) => entry.name).sort()).toEqual([
      'absensi_keterangan_nonblank_check',
      'absensi_status_check',
    ]);
    const actorKeys = attendance.foreignKeys.filter((key) => key.reference().foreignTable === schema.users);
    expect(actorKeys.map((key) => key.reference().columns[0]?.name).sort()).toEqual(['dicatat_oleh', 'diubah_oleh']);
  });

  test('grading constraints, uniqueness, partial component-name index, and actor references match the contract', () => {
    const components = getTableConfig(schema.komponenNilai);
    expect(components.checks.map((entry) => entry.name).sort()).toEqual([
      'komponen_nilai_bobot_range_check',
      'komponen_nilai_nama_nonblank_check',
      'komponen_nilai_urutan_positive_check',
    ]);
    const activeName = components.indexes.find((entry) => entry.config.unique)!;
    expect(activeName).toBeDefined();
    expect(sqlText(activeName.config.where)).toBe('"komponen_nilai"."is_active" = true');
    expect(activeName.config.columns).toHaveLength(2);
    expect('name' in activeName.config.columns[0]!).toBe(true);
    expect('name' in activeName.config.columns[0]! ? activeName.config.columns[0]!.name : undefined)
      .toBe('kelas_kuliah_id');
    expect(sqlText(activeName.config.columns[1])).toBe('lower(btrim("komponen_nilai"."nama"))');

    const scores = getTableConfig(schema.nilaiMahasiswa);
    expect(scores.columns.find((column) => column.name === 'nilai')?.notNull).toBe(false);
    expect(scores.columns.find((column) => column.name === 'nilai')?.default).toBeUndefined();
    expect(scores.uniqueConstraints.map((key) => key.columns.map((column) => column.name)))
      .toContainEqual(['komponen_nilai_id', 'mahasiswa_id']);
    expect(scores.checks.map((entry) => entry.name)).toEqual(['nilai_mahasiswa_nilai_range_check']);
    expect(scores.foreignKeys.filter((key) => key.reference().foreignTable === schema.users)
      .map((key) => key.reference().columns[0]?.name).sort()).toEqual(['dicatat_oleh', 'diubah_oleh']);

    const results = getTableConfig(schema.hasilStudi);
    expect(results.uniqueConstraints.map((key) => key.columns.map((column) => column.name)))
      .toContainEqual(['kelas_kuliah_id', 'mahasiswa_id']);
    expect(results.checks.map((entry) => entry.name).sort()).toEqual([
      'hasil_studi_dikoreksi_at_range_check',
      'hasil_studi_koreksi_fields_check',
      'hasil_studi_nilai_angka_range_check',
      'hasil_studi_nilai_huruf_canonical_check',
      'hasil_studi_nilai_indeks_nonnegative_check',
    ]);
    expect(results.foreignKeys.filter((key) => key.reference().foreignTable === schema.users)
      .map((key) => key.reference().columns[0]?.name).sort()).toEqual(['difinalisasi_oleh', 'dikoreksi_oleh']);
  });

  test('query relations resolve enrollment, attendance actors, team teaching, and the composite curriculum join', async () => {
    // postgres.js connects lazily; SQL generation does not contact this address.
    const { db, client } = createDatabase('postgresql://localhost/kampusia_schema_validation');
    try {
      const studentQuery = db.query.mahasiswa.findMany({
        with: {
          users: true,
          programStudi: { with: { fakultas: true } },
          kurikulum: { with: { kurikulumMatkul: { with: { mataKuliah: true } } } },
          dosenPa: true,
          krs: { with: {
            semester: true,
            disetujuiOleh: true,
            ditolakOleh: true,
            dibukaKembaliOleh: true,
            dibatalkanOleh: true,
            krsDetail: { with: { kelasKuliah: { with: {
              kelasDosen: { with: { dosen: true } },
              jadwalKuliah: { with: { ruangan: true } },
              pertemuan: { with: { absensi: { with: { dicatatOleh: true, diubahOleh: true } } } },
              komponenNilai: { with: { nilaiMahasiswa: { with: {
                mahasiswa: true,
                dicatatOleh: true,
                diubahOleh: true,
              } } } },
              hasilStudi: { with: { difinalisasiOleh: true, dikoreksiOleh: true } },
            } } } },
          } },
        },
      }).toSQL();
      expect(studentQuery.sql).toContain('"mahasiswa_kurikulum"."id" = "mahasiswa"."kurikulum_id"');
      expect(studentQuery.sql).toContain('"mahasiswa_kurikulum"."program_studi_id" = "mahasiswa"."program_studi_id"');
      expect(() => db.query.users.findMany({
        with: {
          mahasiswa: true,
          dosen: true,
          krsDisetujui: true,
          krsDitolak: true,
          krsDibukaKembali: true,
          krsDibatalkan: true,
          absensiDicatat: true,
          absensiDiubah: true,
          nilaiMahasiswaDicatat: true,
          nilaiMahasiswaDiubah: true,
          hasilStudiDifinalisasi: true,
          hasilStudiDikoreksi: true,
        },
      }).toSQL()).not.toThrow();
      expect(() => db.query.kurikulum.findMany({ with: { mahasiswa: true } }).toSQL()).not.toThrow();
      expect(() => db.query.dosen.findMany({ with: { mahasiswaBimbingan: true } }).toSQL()).not.toThrow();
    } finally {
      await client.end();
    }
  });
});
