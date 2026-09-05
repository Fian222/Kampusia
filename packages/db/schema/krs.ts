import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
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
  },
  (t) => [
    unique('krs_mahasiswa_id_semester_id_unique').on(t.mahasiswaId, t.semesterId),
    index('krs_semester_id_status_idx').on(t.semesterId, t.status),
    index('krs_disetujui_oleh_idx').on(t.disetujuiOleh),
    check('krs_status_check', sql`${t.status} IN ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN')`),
    check('krs_batas_sks_positive_check', sql`${t.batasSks} > 0`),
    check('krs_approval_pair_check', sql`(${t.disetujuiAt} IS NULL) = (${t.disetujuiOleh} IS NULL)`),
    check('krs_status_timestamps_check', sql`(
      (${t.status} = 'DRAFT' AND ${t.diajukanAt} IS NULL AND ${t.disetujuiAt} IS NULL AND ${t.disetujuiOleh} IS NULL)
      OR (${t.status} IN ('DIAJUKAN', 'DITOLAK') AND ${t.diajukanAt} IS NOT NULL AND ${t.disetujuiAt} IS NULL AND ${t.disetujuiOleh} IS NULL)
      OR (${t.status} = 'DISETUJUI' AND ${t.diajukanAt} IS NOT NULL AND ${t.disetujuiAt} IS NOT NULL AND ${t.disetujuiOleh} IS NOT NULL)
      OR ${t.status} = 'DIBATALKAN'
    )`),
  ],
);
