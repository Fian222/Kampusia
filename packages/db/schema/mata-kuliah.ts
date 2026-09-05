import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, smallint, unique, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank } from './shared';

export const mataKuliah = pgTable(
  'mata_kuliah',
  {
    ...commonColumns(),
    kode: varchar('kode', { length: 30 }).notNull(),
    nama: varchar('nama', { length: 150 }).notNull(),
    sks: smallint('sks').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('mata_kuliah_kode_unique').on(t.kode),
    nonBlank('mata_kuliah_kode_nonblank_check', t.kode),
    canonicalCode('mata_kuliah_kode_canonical_check', t.kode),
    nonBlank('mata_kuliah_nama_nonblank_check', t.nama),
    check('mata_kuliah_sks_positive_check', sql`${t.sks} > 0`),
  ],
);
