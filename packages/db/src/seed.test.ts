import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import { createDatabase } from './index';
import { assertFixtureRows, developmentData, requireDevelopmentTarget } from './seed-data';
import { seedDevelopment } from './seed';

const data = developmentData('unit-test-hash-placeholder');

test('seed requires an explicit development environment and local kampusia target', () => {
  const local = 'postgresql://localhost:5432/kampusia';
  expect(() => requireDevelopmentTarget(local, 'development')).not.toThrow();
  for (const env of [undefined, 'production', 'test']) {
    expect(() => requireDevelopmentTarget(local, env)).toThrow();
  }
  for (const url of ['postgresql://example.com/kampusia', 'postgresql://localhost/production', 'postgresql://localhost:5433/kampusia']) {
    expect(() => requireDevelopmentTarget(url, 'development')).toThrow();
  }
});

test('repeat fixture validation preserves passwords but rejects changed academic records', () => {
  expect(() => assertFixtureRows(data.users, data.users.map(row => ({ ...row, passwordHash: 'existing-hash' })))).not.toThrow();
  expect(() => assertFixtureRows(data.mahasiswa, data.mahasiswa.map(row => ({ ...row, kurikulumId: 'different' })))).toThrow();
  expect(() => assertFixtureRows(data.mahasiswa, [])).toThrow();
});

test('demo offerings have eligible courses, lecturers, sufficient rooms, and nonconflicting schedules', () => {
  for (const offering of data.kelasKuliah) {
    expect(data.kurikulumMatkul.some(link => link.mataKuliahId === offering.mataKuliahId
      && data.kurikulum.some(curriculum => curriculum.id === link.kurikulumId && curriculum.programStudiId === offering.programStudiId))).toBe(true);
    const assignments = data.kelasDosen.filter(row => row.kelasKuliahId === offering.id);
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments.filter(row => row.isKoordinator)).toHaveLength(1);
    for (const assignment of assignments) expect(data.dosen.some(row => row.id === assignment.dosenId && row.isActive)).toBe(true);
    const schedules = data.jadwalKuliah.filter(row => row.kelasKuliahId === offering.id);
    expect(schedules.length).toBeGreaterThan(0);
    for (const schedule of schedules) {
      const room = data.ruangan.find(row => row.id === schedule.ruanganId)!;
      expect(room.kapasitas).toBeGreaterThanOrEqual(offering.kapasitas);
      expect(schedule.jamMulai < schedule.jamSelesai).toBe(true);
    }
  }
  // The fixture intentionally uses distinct weekdays even where rooms/lecturers differ.
  expect(new Set(data.jadwalKuliah.map(row => row.hari)).size).toBe(data.jadwalKuliah.length);
});

test('approved plans have matching programs, curricula, terms, SKS limits, and approval fields', () => {
  for (const plan of data.krs) {
    const student = data.mahasiswa.find(row => row.id === plan.mahasiswaId)!;
    expect(student.status).toBe('AKTIF');
    expect(data.kurikulum.find(row => row.id === student.kurikulumId)!.programStudiId).toBe(student.programStudiId);
    expect(data.users.find(row => row.id === plan.disetujuiOleh)!.role).toBe('AKADEMIK');
    expect(plan.diajukanAt.getTime()).toBeLessThanOrEqual(plan.disetujuiAt.getTime());
    const selections = data.krsDetail.filter(row => row.krsId === plan.id);
    expect(selections.length).toBeGreaterThan(0);
    const courses = selections.map(selection => {
      const offering = data.kelasKuliah.find(row => row.id === selection.kelasKuliahId)!;
      expect(offering.semesterId).toBe(plan.semesterId);
      expect(offering.programStudiId).toBe(student.programStudiId);
      expect(data.kurikulumMatkul.some(row => row.kurikulumId === student.kurikulumId && row.mataKuliahId === offering.mataKuliahId)).toBe(true);
      return data.mataKuliah.find(row => row.id === offering.mataKuliahId)!;
    });
    expect(new Set(courses.map(row => row.id)).size).toBe(courses.length);
    expect(courses.reduce((sum, row) => sum + row.sks, 0)).toBeLessThanOrEqual(plan.batasSks);
  }
});

test.skipIf(process.env.RUN_DB_SEED_TESTS !== '1')('live seed is repeatable and produces the documented enrollment counts', async () => {
  const url = process.env.DATABASE_URL ?? '';
  const password = process.env.SEED_PASSWORD ?? '';
  requireDevelopmentTarget(url, process.env.NODE_ENV);
  const firstCounts = await seedDevelopment(url, password, process.env.NODE_ENV);
  const { db, client } = createDatabase(url);
  try {
    const fingerprint = async () => {
      const hash = createHash('sha256');
      for (const table of Object.values(schema).filter(value => is(value, PgTable))) {
        const rows = await db.select().from(table);
        rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        hash.update(JSON.stringify(rows));
      }
      return hash.digest('hex');
    };
    const before = await fingerprint();
    const secondCounts = await seedDevelopment(url, password, process.env.NODE_ENV);
    expect(await fingerprint()).toBe(before);
    expect(secondCounts).toEqual(firstCounts);
    for (const row of secondCounts) {
      expect(row.jumlahMahasiswa).toBe(data.krsDetail.filter(detail => detail.kelasKuliahId === row.id).length);
    }
    const account = await db.query.users.findFirst({ where: (user, { eq }) => eq(user.id, data.users[0]!.id) });
    expect(account!.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await Bun.password.verify(password, account!.passwordHash)).toBe(true);
    const invalid = await db.execute(sql`
      select m.id from mahasiswa m left join kurikulum k
        on k.id = m.kurikulum_id and k.program_studi_id = m.program_studi_id
      where k.id is null
    `);
    expect(invalid).toHaveLength(0);
    const constraints = await db.execute(sql`
      select c.conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.contype = 'f' and not c.convalidated
    `);
    expect(constraints).toHaveLength(0);
  } finally {
    await client.end();
  }
}, 30000);
