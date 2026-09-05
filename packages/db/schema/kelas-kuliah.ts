import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank, restrictReference } from './shared';
import { semester } from './semester';
import { mataKuliah } from './mata-kuliah';
import { programStudi } from './program-studi';

export const kelasKuliah = pgTable(
  'kelas_kuliah',
  {
    ...commonColumns(),
    semesterId: uuid('semester_id').notNull().references(() => semester.id, restrictReference),
    mataKuliahId: uuid('mata_kuliah_id').notNull().references(() => mataKuliah.id, restrictReference),
    programStudiId: uuid('program_studi_id').notNull().references(() => programStudi.id, restrictReference),
    namaKelas: varchar('nama_kelas', { length: 20 }).notNull(),
    kapasitas: integer('kapasitas').notNull(),
    status: varchar('status', { length: 16, enum: ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'] }).notNull().default('DRAFT'),
  },
  (t) => [
    unique('kelas_kuliah_offering_unique').on(t.semesterId, t.programStudiId, t.mataKuliahId, t.namaKelas),
    index('kelas_kuliah_mata_kuliah_id_idx').on(t.mataKuliahId),
    index('kelas_kuliah_program_studi_id_idx').on(t.programStudiId),
    index('kelas_kuliah_semester_id_status_idx').on(t.semesterId, t.status),
    nonBlank('kelas_kuliah_nama_kelas_nonblank_check', t.namaKelas),
    canonicalCode('kelas_kuliah_nama_kelas_canonical_check', t.namaKelas),
    check('kelas_kuliah_status_check', sql`${t.status} IN ('DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN')`),
    check('kelas_kuliah_kapasitas_positive_check', sql`${t.kapasitas} > 0`),
  ],
);
