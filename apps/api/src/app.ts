import { Elysia, t } from 'elysia';
import { authorization, requireRole } from './middleware/authorization';
import { areaRoles, AuthError } from './modules/auth/auth.model';
import { authRoutes } from './modules/auth/auth.route';
import type { AuthService } from './modules/auth/auth.service';
import { MasterDataError } from './utils/master-data';
import { fakultasRoutes } from './modules/fakultas/fakultas.route';
import { programStudiRoutes } from './modules/program-studi/program-studi.route';
import type { FakultasService } from './modules/fakultas/fakultas.service';
import type { ProgramStudiService } from './modules/program-studi/program-studi.service';
import { mahasiswaRoutes } from './modules/mahasiswa/mahasiswa.route';
import { dosenRoutes } from './modules/dosen/dosen.route';
import type { MahasiswaService } from './modules/mahasiswa/mahasiswa.service';
import type { DosenService } from './modules/dosen/dosen.service';

export function createApp(auth: AuthService, options: { webOrigin: string; production: boolean }, academic?: { fakultas?: FakultasService; programStudi?: ProgramStudiService; mahasiswa?: MahasiswaService; dosen?: DosenService }) {
  return new Elysia()
    .onRequest(({ set }) => { set.headers['cache-control'] = 'no-store'; })
    .onError(({ code, error, set }) => {
      if (error instanceof AuthError || error instanceof MasterDataError) {
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
    .use(fakultasRoutes(auth, options.webOrigin, academic?.fakultas))
    .use(programStudiRoutes(auth, options.webOrigin, academic?.programStudi))
    .use(mahasiswaRoutes(auth, options.webOrigin, academic?.mahasiswa))
    .use(dosenRoutes(auth, options.webOrigin, academic?.dosen))
    .group('/dashboard', app => app.use(authorization(auth))
      .get('/:area', ({ user, params }) => {
        requireRole(user, [areaRoles[params.area]]);
        return { success: true as const, data: { user, area: params.area } };
      }, { params: t.Object({ area: t.Union([t.Literal('admin'), t.Literal('akademik'), t.Literal('dosen'), t.Literal('mahasiswa')]) }) })
    );
}

export type App = ReturnType<typeof createApp>;
export type { AuthUser, Role } from './modules/auth/auth.model';
