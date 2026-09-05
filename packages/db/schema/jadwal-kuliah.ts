import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, time, unique, uuid } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { kelasKuliah } from './kelas-kuliah';
import { ruangan } from './ruangan';

export const jadwalKuliah = pgTable(
  'jadwal_kuliah',
  {
    ...commonColumns(),
    kelasKuliahId: uuid('kelas_kuliah_id').notNull().references(() => kelasKuliah.id, restrictReference),
    ruanganId: uuid('ruangan_id').notNull().references(() => ruangan.id, restrictReference),
    hari: smallint('hari').notNull(),
    jamMulai: time('jam_mulai', { withTimezone: false }).notNull(),
    jamSelesai: time('jam_selesai', { withTimezone: false }).notNull(),
  },
  (t) => [
    unique('jadwal_kuliah_kelas_kuliah_id_hari_jam_mulai_jam_selesai_unique').on(t.kelasKuliahId, t.hari, t.jamMulai, t.jamSelesai),
    index('jadwal_kuliah_ruangan_id_hari_jam_mulai_idx').on(t.ruanganId, t.hari, t.jamMulai),
    check('jadwal_kuliah_hari_range_check', sql`${t.hari} BETWEEN 1 AND 7`),
    check('jadwal_kuliah_jam_range_check', sql`${t.jamMulai} < ${t.jamSelesai}`),
  ],
);
