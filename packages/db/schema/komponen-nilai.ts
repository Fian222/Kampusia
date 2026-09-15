import { sql } from 'drizzle-orm';
import { boolean, check, index, numeric, pgTable, smallint, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { kelasKuliah } from './kelas-kuliah';
import { commonColumns, nonBlank, restrictReference } from './shared';

export const komponenNilai = pgTable(
  'komponen_nilai',
  {
    ...commonColumns(),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    nama: varchar('nama', { length: 100 }).notNull(),
    bobot: numeric('bobot', { precision: 5, scale: 2 }).notNull(),
    urutan: smallint('urutan').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('komponen_nilai_active_nama_unique')
      .on(t.kelasKuliahId, sql`lower(btrim(${t.nama}))`)
      .where(sql`${t.isActive} = true`),
    index('komponen_nilai_kelas_kuliah_id_is_active_urutan_id_idx')
      .on(t.kelasKuliahId, t.isActive, t.urutan, t.id),
    check('komponen_nilai_bobot_range_check', sql`${t.bobot} > 0 AND ${t.bobot} <= 100`),
    check('komponen_nilai_urutan_positive_check', sql`${t.urutan} > 0`),
    nonBlank('komponen_nilai_nama_nonblank_check', t.nama),
  ],
);
