import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, smallint, text, time, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { kelasKuliah } from './kelas-kuliah';
import { commonColumns, nonBlank, restrictReference } from './shared';

export const pertemuan = pgTable(
  'pertemuan',
  {
    ...commonColumns(),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    nomorPertemuan: smallint('nomor_pertemuan').notNull(),
    tanggal: date('tanggal').notNull(),
    jamMulai: time('jam_mulai', { withTimezone: false }).notNull(),
    jamSelesai: time('jam_selesai', { withTimezone: false }).notNull(),
    materi: text('materi'),
    status: varchar('status', { length: 16, enum: ['TERJADWAL', 'SELESAI', 'DIBATALKAN'] }).notNull().default('TERJADWAL'),
  },
  (t) => [
    unique('pertemuan_kelas_kuliah_id_nomor_pertemuan_unique').on(t.kelasKuliahId, t.nomorPertemuan),
    index('pertemuan_tanggal_status_idx').on(t.tanggal, t.status),
    check('pertemuan_nomor_pertemuan_positive_check', sql`${t.nomorPertemuan} > 0`),
    check('pertemuan_jam_range_check', sql`${t.jamMulai} < ${t.jamSelesai}`),
    check('pertemuan_status_check', sql`${t.status} IN ('TERJADWAL', 'SELESAI', 'DIBATALKAN')`),
    nonBlank('pertemuan_materi_nonblank_check', t.materi),
  ],
);
