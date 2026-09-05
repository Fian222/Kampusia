import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, unique, varchar } from 'drizzle-orm/pg-core';
import { commonColumns, nonBlank } from './shared';

export const users = pgTable(
  'users',
  {
    ...commonColumns(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 16, enum: ['ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA'] }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    unique('users_email_unique').on(t.email),
    nonBlank('users_email_nonblank_check', t.email),
    check('users_email_canonical_check', sql`${t.email} = lower(${t.email}) AND ${t.email} !~ '^[[:space:]]|[[:space:]]$'`),
    nonBlank('users_password_hash_nonblank_check', t.passwordHash),
    check('users_role_check', sql`${t.role} IN ('ADMIN', 'AKADEMIK', 'DOSEN', 'MAHASISWA')`),
  ],
);
