import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank } from './shared';

export const ruangan = pgTable(
  'ruangan',
  {
    ...commonColumns(),
    kode: varchar('kode', { length: 30 }).notNull(),
    nama: varchar('nama', { length: 100 }).notNull(),
    gedung: varchar('gedung', { length: 100 }),
    kapasitas: integer('kapasitas').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('ruangan_kode_unique').on(t.kode),
    nonBlank('ruangan_kode_nonblank_check', t.kode),
    canonicalCode('ruangan_kode_canonical_check', t.kode),
    nonBlank('ruangan_nama_nonblank_check', t.nama),
    nonBlank('ruangan_gedung_nonblank_check', t.gedung),
    check('ruangan_kapasitas_positive_check', sql`${t.kapasitas} > 0`),
  ],
);
