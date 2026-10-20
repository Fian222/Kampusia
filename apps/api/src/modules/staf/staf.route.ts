import { Elysia } from 'elysia';
import { authorization, requireRole } from '../../middleware/authorization';
import { MasterDataError } from '../../utils/master-data';
import { AuthError } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { stafBody, stafParams, stafPatch, stafQuery } from './staf.model';
import type { StafService } from './staf.service';

export function stafRoutes(auth: AuthService, origin: string, service?: StafService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan akun staf tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/staf' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => {
      requireRole(user, ['ADMIN']);
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin) throw new AuthError(403, 'Asal permintaan tidak diizinkan.');
    })
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: stafQuery })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: stafBody })
    .patch('/:loginId', async ({ user, params, body }) => ({ success: true as const, data: await getService().update(user, params.loginId, body) }), { params: stafParams, body: stafPatch })
    .post('/:loginId/reset-password', async ({ user, params }) => ({ success: true as const, data: await getService().resetPassword(user, params.loginId) }), { params: stafParams });
}
