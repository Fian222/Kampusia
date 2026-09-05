import { boolean, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank } from './shared';

export const fakultas = pgTable(
  'fakultas',
  {
    ...commonColumns(),
    kode: varchar('kode', { length: 20 }).notNull(),
    nama: varchar('nama', { length: 150 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('fakultas_kode_unique').on(t.kode),
    nonBlank('fakultas_kode_nonblank_check', t.kode),
    canonicalCode('fakultas_kode_canonical_check', t.kode),
    nonBlank('fakultas_nama_nonblank_check', t.nama),
  ],
);
