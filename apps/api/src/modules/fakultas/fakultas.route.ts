import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { fakultasBody, fakultasPatch } from './fakultas.model';
import type { FakultasService } from './fakultas.service';

export function fakultasRoutes(auth: AuthService, origin: string, service?: FakultasService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan fakultas tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/fakultas' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: listQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: fakultasBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: fakultasPatch });
}
