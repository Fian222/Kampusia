import { Elysia } from 'elysia';
import { authorization, requireRole } from '../../middleware/authorization';
import { MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { ownSemesterResultParams, studentResultParams, studentSemesterResultParams } from './hasil-studi.model';
import type { HasilStudiService } from './hasil-studi.service';

export function hasilStudiRoutes(auth: AuthService, service?: HasilStudiService) {
  const get = () => { if (!service) throw new MasterDataError(503, 'Layanan hasil studi tidak tersedia.'); return service; };
  const own = new Elysia({ prefix: '/mahasiswa/me' }).use(authorization(auth))
    .onBeforeHandle(({ user }) => requireRole(user, ['MAHASISWA']))
    .get('/hasil-studi', async ({ user }) => ({ success: true as const, data: await get().ownSummary(user) }))
    .get('/khs/:semesterId', async ({ user, params }) => ({ success: true as const, data: await get().ownKhs(user, params.semesterId) }), { params: ownSemesterResultParams })
    .get('/ipk', async ({ user }) => ({ success: true as const, data: await get().ownIpk(user) }));
  const managed = new Elysia({ prefix: '/mahasiswa' }).use(authorization(auth))
    .onBeforeHandle(({ user }) => requireRole(user, ['ADMIN', 'AKADEMIK']))
    .get('/:id/hasil-studi', async ({ user, params }) => ({ success: true as const, data: await get().studentSummary(user, params.id) }), { params: studentResultParams })
    .get('/:id/khs/:semesterId', async ({ user, params }) => ({ success: true as const, data: await get().studentKhs(user, params.id, params.semesterId) }), { params: studentSemesterResultParams })
    .get('/:id/ipk', async ({ user, params }) => ({ success: true as const, data: await get().studentIpk(user, params.id) }), { params: studentResultParams });
  return new Elysia().use(own).use(managed);
}
