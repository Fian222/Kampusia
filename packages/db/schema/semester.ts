import { sql } from 'drizzle-orm';
import { boolean, check, date, pgTable, smallint, unique, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank } from './shared';

export const semester = pgTable(
  'semester',
  {
    ...commonColumns(),
    kode: varchar('kode', { length: 5 }).notNull(),
    nama: varchar('nama', { length: 100 }).notNull(),
    tahunMulai: smallint('tahun_mulai').notNull(),
    jenis: varchar('jenis', { length: 8, enum: ['GANJIL', 'GENAP'] }).notNull(),
    tanggalMulai: date('tanggal_mulai').notNull(),
    tanggalSelesai: date('tanggal_selesai').notNull(),
    isActive: boolean('is_active').notNull().default(false),
  },
  (t) => [
    unique('semester_kode_unique').on(t.kode),
    unique('semester_tahun_mulai_jenis_unique').on(t.tahunMulai, t.jenis),
    nonBlank('semester_kode_nonblank_check', t.kode),
    canonicalCode('semester_kode_canonical_check', t.kode),
    nonBlank('semester_nama_nonblank_check', t.nama),
    check('semester_jenis_check', sql`${t.jenis} IN ('GANJIL', 'GENAP')`),
    check('semester_tahun_mulai_range_check', sql`${t.tahunMulai} BETWEEN 1900 AND 9998`),
    check('semester_tanggal_range_check', sql`${t.tanggalMulai} <= ${t.tanggalSelesai}`),
    check('semester_kode_matches_term_check', sql`${t.kode} = ${t.tahunMulai}::text || CASE ${t.jenis} WHEN 'GANJIL' THEN '1' ELSE '2' END`),
    uniqueIndex('semester_active_unique').on(t.isActive).where(sql`${t.isActive} = true`),
  ],
);
