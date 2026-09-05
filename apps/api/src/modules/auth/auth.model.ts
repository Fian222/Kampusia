import { t } from 'elysia';
import type { users } from '@kampusia/db/schema';

export type AuthRecord = typeof users.$inferSelect;
export type AuthUser = Pick<AuthRecord, 'id' | 'email' | 'role'>;
export type Role = AuthUser['role'];
export const sessionCookie = 'kampusia_session';
export const sessionSeconds = 8 * 60 * 60;

export const loginBody = t.Object({
  email: t.String({ minLength: 1, maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 1024 }),
});
export const areaRoles = { admin: 'ADMIN', akademik: 'AKADEMIK', dosen: 'DOSEN', mahasiswa: 'MAHASISWA' } as const;

export class AuthError extends Error {
  constructor(public status: 400 | 401 | 403 | 429 | 503, message: string) {
    super(message);
  }
}
