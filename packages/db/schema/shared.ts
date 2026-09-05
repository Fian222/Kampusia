import { sql } from 'drizzle-orm';
import { check, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

export function commonColumns() {
  return {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // Services explicitly set updatedAt on mutations, as required by DATABASE.md.
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  };
}

export const restrictReference = { onDelete: 'restrict', onUpdate: 'restrict' } as const;

// Nullable text passes CHECK for NULL, but supplied text must contain a non-space character.
export function nonBlank(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} ~ '[^[:space:]]'`);
}

export function canonicalCode(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} = upper(${column}) AND ${column} !~ '^[[:space:]]|[[:space:]]$'`);
}
