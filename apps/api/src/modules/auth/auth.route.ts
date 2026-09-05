import { Elysia } from 'elysia';
import { authorization, readSession } from '../../middleware/authorization';
import { AuthError, loginBody, sessionCookie, sessionSeconds } from './auth.model';
import type { AuthService } from './auth.service';

export function authRoutes(auth: AuthService, options: { webOrigin: string; production: boolean }) {
  const cookieOptions = { httpOnly: true, secure: options.production, sameSite: 'lax' as const, path: '/' };
  const checkOrigin = (request: Request) => {
    if (request.headers.get('origin') !== options.webOrigin) {
      throw new AuthError(403, 'Asal permintaan tidak diizinkan.');
    }
  };
  return new Elysia({ prefix: '/auth' })
    .post('/login', async ({ body, request, cookie }) => {
      const result = await auth.login(body.email, body.password, readSession(request));
      cookie[sessionCookie]!.set({ ...cookieOptions, value: result.token, maxAge: sessionSeconds });
      return { success: true as const, data: result.user };
    }, { body: loginBody, beforeHandle: ({ request }) => checkOrigin(request) })
    .post('/logout', ({ request, cookie }) => {
      auth.logout(readSession(request));
      cookie[sessionCookie]!.set({ ...cookieOptions, value: '', maxAge: 0, expires: new Date(0) });
      return { success: true as const, data: null };
    }, { beforeHandle: ({ request }) => checkOrigin(request) })
    .use(authorization(auth))
    .get('/me', ({ user }) => ({ success: true as const, data: user }));
}
