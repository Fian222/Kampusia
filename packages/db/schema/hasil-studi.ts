import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { kelasKuliah } from './kelas-kuliah';
import { mahasiswa } from './mahasiswa';
import { commonColumns, restrictReference } from './shared';
import { users } from './users';

export const hasilStudi = pgTable(
  'hasil_studi',
  {
    ...commonColumns(),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    mahasiswaId: uuid('mahasiswa_id').notNull().references(() => mahasiswa.id, restrictReference),
    nilaiAngka: numeric('nilai_angka', { precision: 5, scale: 2 }).notNull(),
    nilaiHuruf: varchar('nilai_huruf', { length: 8 }).notNull(),
    nilaiIndeks: numeric('nilai_indeks', { precision: 5, scale: 2 }).notNull(),
    difinalisasiAt: timestamp('difinalisasi_at', { withTimezone: true }).notNull(),
    difinalisasiOleh: uuid('difinalisasi_oleh').notNull().references(() => users.id, restrictReference),
    dikoreksiAt: timestamp('dikoreksi_at', { withTimezone: true }),
    dikoreksiOleh: uuid('dikoreksi_oleh').references(() => users.id, restrictReference),
    alasanKoreksi: text('alasan_koreksi'),
  },
  (t) => [
    unique('hasil_studi_kelas_kuliah_id_mahasiswa_id_unique').on(t.kelasKuliahId, t.mahasiswaId),
    index('hasil_studi_mahasiswa_id_kelas_kuliah_id_idx').on(t.mahasiswaId, t.kelasKuliahId),
    check('hasil_studi_nilai_angka_range_check', sql`${t.nilaiAngka} >= 0 AND ${t.nilaiAngka} <= 100`),
    check('hasil_studi_nilai_indeks_nonnegative_check', sql`${t.nilaiIndeks} >= 0`),
    check(
      'hasil_studi_nilai_huruf_canonical_check',
      sql`${t.nilaiHuruf} = upper(btrim(${t.nilaiHuruf})) AND ${t.nilaiHuruf} <> ''`,
    ),
    check(
      'hasil_studi_koreksi_fields_check',
      sql`(
        ${t.dikoreksiAt} IS NULL
        AND ${t.dikoreksiOleh} IS NULL
        AND ${t.alasanKoreksi} IS NULL
      ) OR (
        ${t.dikoreksiAt} IS NOT NULL
        AND ${t.dikoreksiOleh} IS NOT NULL
        AND ${t.alasanKoreksi} IS NOT NULL
        AND btrim(${t.alasanKoreksi}) <> ''
      )`,
    ),
    check(
      'hasil_studi_dikoreksi_at_range_check',
      sql`${t.dikoreksiAt} IS NULL OR ${t.dikoreksiAt} >= ${t.difinalisasiAt}`,
    ),
  ],
);
