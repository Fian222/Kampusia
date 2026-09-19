import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank, restrictReference } from './shared';
import { users } from './users';
import { programStudi } from './program-studi';

export const dosen = pgTable(
  'dosen',
  {
    ...commonColumns(),
    userId: uuid('user_id').references(() => users.id, restrictReference),
    programStudiId: uuid('program_studi_id').references(() => programStudi.id, restrictReference),
    nik: varchar('nik', { length: 30 }),
    kodeDosen: varchar('kode_dosen', { length: 30 }).notNull(),
    nidn: varchar('nidn', { length: 30 }),
    nama: varchar('nama', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('dosen_nik_unique').on(t.nik),
    unique('dosen_kode_dosen_unique').on(t.kodeDosen),
    unique('dosen_nidn_unique').on(t.nidn),
    unique('dosen_user_id_unique').on(t.userId),
    index('dosen_program_studi_id_idx').on(t.programStudiId),
    check('dosen_nik_digits_check', sql`${t.nik} IS NULL OR ${t.nik} ~ '^[0-9]+$'`),
    nonBlank('dosen_kode_dosen_nonblank_check', t.kodeDosen),
    canonicalCode('dosen_kode_dosen_canonical_check', t.kodeDosen),
    nonBlank('dosen_nidn_nonblank_check', t.nidn),
    canonicalCode('dosen_nidn_canonical_check', t.nidn),
    nonBlank('dosen_nama_nonblank_check', t.nama),
  ],
);
