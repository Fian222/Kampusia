import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { mahasiswa } from './mahasiswa';
import { semester } from './semester';
import { users } from './users';

export const krs = pgTable(
  'krs',
  {
    ...commonColumns(),
    mahasiswaId: uuid('mahasiswa_id').notNull().references(() => mahasiswa.id, restrictReference),
    semesterId: uuid('semester_id').notNull().references(() => semester.id, restrictReference),
    status: varchar('status', { length: 16, enum: ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN'] }).notNull().default('DRAFT'),
    batasSks: smallint('batas_sks').notNull(),
    diajukanAt: timestamp('diajukan_at', { withTimezone: true }),
    disetujuiAt: timestamp('disetujui_at', { withTimezone: true }),
    disetujuiOleh: uuid('disetujui_oleh').references(() => users.id, restrictReference),
    ditolakAt: timestamp('ditolak_at', { withTimezone: true }),
    ditolakOleh: uuid('ditolak_oleh').references(() => users.id, restrictReference),
    alasanPenolakan: text('alasan_penolakan'),
    dibukaKembaliAt: timestamp('dibuka_kembali_at', { withTimezone: true }),
    dibukaKembaliOleh: uuid('dibuka_kembali_oleh').references(() => users.id, restrictReference),
    dibatalkanAt: timestamp('dibatalkan_at', { withTimezone: true }),
    dibatalkanOleh: uuid('dibatalkan_oleh').references(() => users.id, restrictReference),
    alasanPembatalan: text('alasan_pembatalan'),
  },
  (t) => [
    unique('krs_mahasiswa_id_semester_id_unique').on(t.mahasiswaId, t.semesterId),
    index('krs_semester_id_status_idx').on(t.semesterId, t.status),
    index('krs_disetujui_oleh_idx').on(t.disetujuiOleh),
    check('krs_status_check', sql`${t.status} IN ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN')`),
    check('krs_batas_sks_positive_check', sql`${t.batasSks} > 0`),
    check('krs_approval_pair_check', sql`(${t.disetujuiAt} IS NULL) = (${t.disetujuiOleh} IS NULL)`),
    check('krs_rejection_fields_check', sql`(
      (${t.ditolakAt} IS NULL AND ${t.ditolakOleh} IS NULL AND ${t.alasanPenolakan} IS NULL)
      OR (${t.ditolakAt} IS NOT NULL AND ${t.ditolakOleh} IS NOT NULL AND ${t.alasanPenolakan} IS NOT NULL AND btrim(${t.alasanPenolakan}) <> '')
    )`),
    check('krs_reopening_pair_check', sql`(${t.dibukaKembaliAt} IS NULL) = (${t.dibukaKembaliOleh} IS NULL)`),
    check('krs_cancellation_fields_check', sql`(
      (${t.dibatalkanAt} IS NULL AND ${t.dibatalkanOleh} IS NULL AND ${t.alasanPembatalan} IS NULL)
      OR (${t.dibatalkanAt} IS NOT NULL AND ${t.dibatalkanOleh} IS NOT NULL AND ${t.alasanPembatalan} IS NOT NULL AND btrim(${t.alasanPembatalan}) <> '')
    )`),
    check('krs_event_timestamps_check', sql`
      (${t.diajukanAt} IS NULL OR ${t.diajukanAt} >= ${t.createdAt})
      AND (${t.disetujuiAt} IS NULL OR ${t.disetujuiAt} >= ${t.createdAt})
      AND (${t.ditolakAt} IS NULL OR ${t.ditolakAt} >= ${t.createdAt})
      AND (${t.dibukaKembaliAt} IS NULL OR ${t.dibukaKembaliAt} >= ${t.createdAt})
      AND (${t.dibatalkanAt} IS NULL OR ${t.dibatalkanAt} >= ${t.createdAt})
    `),
    check('krs_status_timestamps_check', sql`(
      (${t.status} = 'DRAFT' AND ${t.diajukanAt} IS NULL)
      OR (${t.status} = 'DIAJUKAN' AND ${t.diajukanAt} IS NOT NULL)
      OR (${t.status} = 'DISETUJUI' AND ${t.diajukanAt} IS NOT NULL AND ${t.disetujuiAt} IS NOT NULL AND ${t.disetujuiOleh} IS NOT NULL AND ${t.disetujuiAt} >= ${t.diajukanAt})
      OR (${t.status} = 'DITOLAK' AND ${t.diajukanAt} IS NOT NULL AND ${t.ditolakAt} IS NOT NULL AND ${t.ditolakOleh} IS NOT NULL AND ${t.alasanPenolakan} IS NOT NULL AND ${t.ditolakAt} >= ${t.diajukanAt})
      OR (${t.status} = 'DIBATALKAN' AND ${t.dibatalkanAt} IS NOT NULL AND ${t.dibatalkanOleh} IS NOT NULL AND ${t.alasanPembatalan} IS NOT NULL)
    )`),
  ],
);
