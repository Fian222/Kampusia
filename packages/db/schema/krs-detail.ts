import { sql } from 'drizzle-orm';
import { check, index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { krs } from './krs';
import { kelasKuliah } from './kelas-kuliah';

export const krsDetail = pgTable(
  'krs_detail',
  {
    ...commonColumns(),
    krsId: uuid('krs_id').notNull().references(() => krs.id, restrictReference),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    status: varchar('status', { length: 12, enum: ['AKTIF', 'DIBATALKAN'] }).notNull().default('AKTIF'),
  },
  (t) => [
    unique('krs_detail_krs_id_kelas_kuliah_id_unique').on(t.krsId, t.kelasKuliahId),
    index('krs_detail_kelas_kuliah_id_status_idx').on(t.kelasKuliahId, t.status),
    check('krs_detail_status_check', sql`${t.status} IN ('AKTIF', 'DIBATALKAN')`),
  ],
);
