import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import { createDatabase } from './index';

const design = readFileSync(new URL('../../../docs/DATABASE.md', import.meta.url), 'utf8');
const dialect = new PgDialect();
const tables = Object.values(schema).filter((value) => is(value, PgTable));
const sections = [...design.matchAll(/^### ([a-z_]+)\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)];
const sqlText = (value: unknown) => is(value, SQL) ? dialect.sqlToQuery(value).sql : value;
const normalizeType = (value: string) => value
  .replace('timestamp with time zone', 'timestamptz')
  .replace('time without time zone', 'time')
  .replace(/,\s+/g, ',');

describe('DATABASE.md schema contract', () => {
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
    expect(keys).toHaveLength(35);
    for (const key of keys) {
      expect(key.onDelete).toBe('restrict');
      expect(key.onUpdate).toBe('restrict');
    }
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

  test('active semester and class coordinator uniqueness have the required predicates', () => {
    const active = getTableConfig(schema.semester).indexes.find((index) => index.config.unique)!;
    expect(active.config.columns.map((column) => 'name' in column ? column.name : undefined)).toEqual(['is_active']);
    expect(sqlText(active.config.where)).toBe('"semester"."is_active" = true');
    const coordinator = getTableConfig(schema.kelasDosen).indexes.find((index) => index.config.unique)!;
    expect(coordinator.config.columns.map((column) => 'name' in column ? column.name : undefined)).toEqual(['kelas_kuliah_id']);
    expect(sqlText(coordinator.config.where)).toBe('"kelas_dosen"."is_koordinator" = true');
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
          krs: { with: {
            semester: true,
            disetujuiOleh: true,
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
          absensiDicatat: true,
          absensiDiubah: true,
          nilaiMahasiswaDicatat: true,
          nilaiMahasiswaDiubah: true,
          hasilStudiDifinalisasi: true,
          hasilStudiDikoreksi: true,
        },
      }).toSQL()).not.toThrow();
      expect(() => db.query.kurikulum.findMany({ with: { mahasiswa: true } }).toSQL()).not.toThrow();
    } finally {
      await client.end();
    }
  });
});
