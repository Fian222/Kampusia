import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { commonColumns, restrictReference } from './shared';
import { users } from './users';

export const userSession = pgTable(
  'user_session',
  {
    ...commonColumns(),
    userId: uuid('user_id').notNull().references(() => users.id, restrictReference),
    tokenDigest: varchar('token_digest', { length: 64 }).notNull(),
    passwordFingerprint: varchar('password_fingerprint', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique('user_session_token_digest_unique').on(t.tokenDigest),
    index('user_session_user_id_idx').on(t.userId),
    index('user_session_expires_at_idx').on(t.expiresAt),
    check('user_session_token_digest_check', sql`${t.tokenDigest} ~ '^[0-9a-f]{64}$'`),
    check('user_session_password_fingerprint_check', sql`${t.passwordFingerprint} ~ '^[0-9a-f]{64}$'`),
  ],
);
