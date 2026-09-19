import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { dosenBody, dosenPatch, dosenQuery } from './dosen.model';
import type { DosenService } from './dosen.service';

export function dosenRoutes(auth: AuthService, origin: string, service?: DosenService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan dosen tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/dosen' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: dosenQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/:id/account', async ({ params, set }) => { set.status = 201; return { success: true as const, data: await getService().provisionAccount(params.id) }; }, { params: idParams })
    .post('/:id/account/reset', async ({ params }) => ({ success: true as const, data: await getService().resetPassword(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: dosenBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: dosenPatch });
}
