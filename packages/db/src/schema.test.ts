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
  .replace('time without time zone', 'time');

describe('DATABASE.md schema contract', () => {
  test('exports exactly the documented tables', () => {
    expect(sections).toHaveLength(15);
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
    expect(keys).toHaveLength(21);
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

  test('query relations resolve enrollment, team teaching, and the composite curriculum join', async () => {
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
            } } } },
          } },
        },
      }).toSQL();
      expect(studentQuery.sql).toContain('"mahasiswa_kurikulum"."id" = "mahasiswa"."kurikulum_id"');
      expect(studentQuery.sql).toContain('"mahasiswa_kurikulum"."program_studi_id" = "mahasiswa"."program_studi_id"');
      expect(() => db.query.users.findMany({
        with: { mahasiswa: true, dosen: true, krsDisetujui: true },
      }).toSQL()).not.toThrow();
      expect(() => db.query.kurikulum.findMany({ with: { mahasiswa: true } }).toSQL()).not.toThrow();
    } finally {
      await client.end();
    }
  });
});
