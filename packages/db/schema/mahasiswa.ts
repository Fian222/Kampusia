import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, smallint, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { canonicalCode, commonColumns, nonBlank, restrictReference } from './shared';
import { users } from './users';
import { programStudi } from './program-studi';
import { kurikulum } from './kurikulum';
import { dosen } from './dosen';

export const mahasiswa = pgTable(
  'mahasiswa',
  {
    ...commonColumns(),
    userId: uuid('user_id').references(() => users.id, restrictReference),
    programStudiId: uuid('program_studi_id').notNull().references(() => programStudi.id, restrictReference),
    kurikulumId: uuid('kurikulum_id').notNull(),
    dosenPaId: uuid('dosen_pa_id').references(() => dosen.id, restrictReference),
    nim: varchar('nim', { length: 30 }).notNull(),
    nama: varchar('nama', { length: 150 }).notNull(),
    angkatan: smallint('angkatan').notNull(),
    status: varchar('status', { length: 16, enum: ['AKTIF', 'CUTI', 'LULUS', 'KELUAR', 'NONAKTIF'] }).notNull().default('AKTIF'),
  },
  (t) => [
    unique('mahasiswa_nim_unique').on(t.nim),
    unique('mahasiswa_user_id_unique').on(t.userId),
    index('mahasiswa_program_studi_id_angkatan_idx').on(t.programStudiId, t.angkatan),
    index('mahasiswa_kurikulum_id_idx').on(t.kurikulumId),
    index('mahasiswa_dosen_pa_id_idx').on(t.dosenPaId),
    nonBlank('mahasiswa_nim_nonblank_check', t.nim),
    canonicalCode('mahasiswa_nim_canonical_check', t.nim),
    nonBlank('mahasiswa_nama_nonblank_check', t.nama),
    check('mahasiswa_status_check', sql`${t.status} IN ('AKTIF', 'CUTI', 'LULUS', 'KELUAR', 'NONAKTIF')`),
    check('mahasiswa_angkatan_range_check', sql`${t.angkatan} BETWEEN 1900 AND 9999`),
    foreignKey({
      name: 'mahasiswa_kurikulum_program_studi_fk',
      columns: [t.kurikulumId, t.programStudiId],
      foreignColumns: [kurikulum.id, kurikulum.programStudiId],
    }).onDelete('restrict').onUpdate('restrict'),
  ],
);
