import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { mahasiswa } from './mahasiswa';
import { pertemuan } from './pertemuan';
import { commonColumns, nonBlank, restrictReference } from './shared';
import { users } from './users';

export const absensi = pgTable(
  'absensi',
  {
    ...commonColumns(),
    pertemuanId: uuid('pertemuan_id').notNull().references(() => pertemuan.id, restrictReference),
    mahasiswaId: uuid('mahasiswa_id').notNull().references(() => mahasiswa.id, restrictReference),
    status: varchar('status', { length: 8, enum: ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] }).notNull(),
    keterangan: text('keterangan'),
    dicatatOleh: uuid('dicatat_oleh').notNull().references(() => users.id, restrictReference),
    diubahOleh: uuid('diubah_oleh').notNull().references(() => users.id, restrictReference),
  },
  (t) => [
    unique('absensi_pertemuan_id_mahasiswa_id_unique').on(t.pertemuanId, t.mahasiswaId),
    index('absensi_mahasiswa_id_pertemuan_id_idx').on(t.mahasiswaId, t.pertemuanId),
    check('absensi_status_check', sql`${t.status} IN ('HADIR', 'IZIN', 'SAKIT', 'ALPHA')`),
    nonBlank('absensi_keterangan_nonblank_check', t.keterangan),
  ],
);
