import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

export function createDatabase(url: string) {
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }

  const client = postgres(url);
  const db = drizzle(client, { schema });

  return { db, client };
}
