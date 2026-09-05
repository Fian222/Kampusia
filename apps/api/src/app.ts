import { Elysia, t } from 'elysia';
import { authorization, requireRole } from './middleware/authorization';
import { areaRoles, AuthError } from './modules/auth/auth.model';
import { authRoutes } from './modules/auth/auth.route';
import type { AuthService } from './modules/auth/auth.service';

export function createApp(auth: AuthService, options: { webOrigin: string; production: boolean }) {
  return new Elysia()
    .onRequest(({ set }) => { set.headers['cache-control'] = 'no-store'; })
    .onError(({ code, error, set }) => {
      if (error instanceof AuthError) {
        set.status = error.status;
        return { success: false as const, message: error.message };
      }
      if (code === 'VALIDATION' || code === 'PARSE') {
        set.status = 400;
        return { success: false as const, message: 'Periksa format dan kelengkapan data yang dikirim.' };
      }
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { success: false as const, message: 'Halaman tidak ditemukan.' };
      }
      console.error('Unexpected API error', { code, name: error instanceof Error ? error.name : 'UnknownError' });
      set.status = 500;
      return { success: false as const, message: 'Terjadi kesalahan pada server. Silakan coba lagi.' };
    })
    .use(authRoutes(auth, options))
    .group('/dashboard', app => app.use(authorization(auth))
      .get('/:area', ({ user, params }) => {
        requireRole(user, [areaRoles[params.area]]);
        return { success: true as const, data: { user, area: params.area } };
      }, { params: t.Object({ area: t.Union([t.Literal('admin'), t.Literal('akademik'), t.Literal('dosen'), t.Literal('mahasiswa')]) }) })
    );
}

export type App = ReturnType<typeof createApp>;
export type { AuthUser, Role } from './modules/auth/auth.model';
