import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, smallint, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank, restrictReference } from './shared';
import { programStudi } from './program-studi';

export const kurikulum = pgTable(
  'kurikulum',
  {
    ...commonColumns(),
    programStudiId: uuid('program_studi_id').notNull().references(() => programStudi.id, restrictReference),
    kode: varchar('kode', { length: 30 }).notNull(),
    nama: varchar('nama', { length: 150 }).notNull(),
    tahunBerlaku: smallint('tahun_berlaku').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('kurikulum_program_studi_id_kode_unique').on(t.programStudiId, t.kode),
    unique('kurikulum_id_program_studi_id_unique').on(t.id, t.programStudiId),
    nonBlank('kurikulum_kode_nonblank_check', t.kode),
    canonicalCode('kurikulum_kode_canonical_check', t.kode),
    nonBlank('kurikulum_nama_nonblank_check', t.nama),
    check('kurikulum_tahun_berlaku_range_check', sql`${t.tahunBerlaku} BETWEEN 1900 AND 9999`),
  ],
);
