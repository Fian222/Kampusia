import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { kelasKuliah } from './kelas-kuliah';
import { dosen } from './dosen';

export const kelasDosen = pgTable(
  'kelas_dosen',
  {
    ...commonColumns(),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    dosenId: uuid('dosen_id').notNull().references(() => dosen.id, restrictReference),
    isKoordinator: boolean('is_koordinator').notNull().default(false),
  },
  (t) => [
    unique('kelas_dosen_kelas_kuliah_id_dosen_id_unique').on(t.kelasKuliahId, t.dosenId),
    index('kelas_dosen_dosen_id_idx').on(t.dosenId),
    uniqueIndex('kelas_dosen_koordinator_unique').on(t.kelasKuliahId).where(sql`${t.isKoordinator} = true`),
  ],
);
