import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, smallint, unique, uuid } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { kurikulum } from './kurikulum';
import { mataKuliah } from './mata-kuliah';

export const kurikulumMatkul = pgTable(
  'kurikulum_matkul',
  {
    ...commonColumns(),
    kurikulumId: uuid('kurikulum_id').notNull().references(() => kurikulum.id, restrictReference),
    mataKuliahId: uuid('mata_kuliah_id').notNull().references(() => mataKuliah.id, restrictReference),
    semesterRekomendasi: smallint('semester_rekomendasi'),
    isWajib: boolean('is_wajib').notNull().default(true),
  },
  (t) => [
    unique('kurikulum_matkul_kurikulum_id_mata_kuliah_id_unique').on(t.kurikulumId, t.mataKuliahId),
    index('kurikulum_matkul_mata_kuliah_id_idx').on(t.mataKuliahId),
    check('kurikulum_matkul_semester_rekomendasi_positive_check', sql`${t.semesterRekomendasi} IS NULL OR ${t.semesterRekomendasi} > 0`),
  ],
);
