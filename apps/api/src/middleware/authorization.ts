import { Elysia } from 'elysia';
import { AuthError, sessionCookie, type AuthUser, type Role } from '../modules/auth/auth.model';
import type { AuthService } from '../modules/auth/auth.service';

export function readSession(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function requireRole(user: AuthUser, roles: readonly Role[]) {
  if (!roles.includes(user.role)) throw new AuthError(403, 'Anda tidak memiliki akses ke halaman ini.');
}

export function authorization(auth: AuthService) {
  return new Elysia({ name: 'authorization' })
    .resolve({ as: 'scoped' }, async ({ request }) => {
      const user = await auth.current(readSession(request));
      if (!user) throw new AuthError(401, 'Silakan masuk untuk melanjutkan.');
      return { user };
    });
}
