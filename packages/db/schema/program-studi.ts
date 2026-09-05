import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank, restrictReference } from './shared';
import { fakultas } from './fakultas';

export const programStudi = pgTable(
  'program_studi',
  {
    ...commonColumns(),
    fakultasId: uuid('fakultas_id').notNull().references(() => fakultas.id, restrictReference),
    kode: varchar('kode', { length: 20 }).notNull(),
    nama: varchar('nama', { length: 150 }).notNull(),
    jenjang: varchar('jenjang', { length: 12, enum: ['D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI'] }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('program_studi_kode_unique').on(t.kode),
    index('program_studi_fakultas_id_idx').on(t.fakultasId),
    nonBlank('program_studi_kode_nonblank_check', t.kode),
    canonicalCode('program_studi_kode_canonical_check', t.kode),
    nonBlank('program_studi_nama_nonblank_check', t.nama),
    check('program_studi_jenjang_check', sql`${t.jenjang} IN ('D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI')`),
  ],
);
