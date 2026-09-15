import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { komponenNilai } from './komponen-nilai';
import { mahasiswa } from './mahasiswa';
import { commonColumns, restrictReference } from './shared';
import { users } from './users';

export const nilaiMahasiswa = pgTable(
  'nilai_mahasiswa',
  {
    ...commonColumns(),
    komponenNilaiId: uuid('komponen_nilai_id').notNull().references(() => komponenNilai.id, restrictReference),
    mahasiswaId: uuid('mahasiswa_id').notNull().references(() => mahasiswa.id, restrictReference),
    nilai: numeric('nilai', { precision: 5, scale: 2 }),
    dicatatOleh: uuid('dicatat_oleh').notNull().references(() => users.id, restrictReference),
    diubahOleh: uuid('diubah_oleh').notNull().references(() => users.id, restrictReference),
  },
  (t) => [
    unique('nilai_mahasiswa_komponen_nilai_id_mahasiswa_id_unique').on(t.komponenNilaiId, t.mahasiswaId),
    index('nilai_mahasiswa_mahasiswa_id_komponen_nilai_id_idx').on(t.mahasiswaId, t.komponenNilaiId),
    check('nilai_mahasiswa_nilai_range_check', sql`${t.nilai} IS NULL OR (${t.nilai} >= 0 AND ${t.nilai} <= 100)`),
  ],
);
