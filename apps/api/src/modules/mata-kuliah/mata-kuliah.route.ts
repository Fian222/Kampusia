import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { mataKuliahBody, mataKuliahPatch } from './mata-kuliah.model';
import type { MataKuliahService } from './mata-kuliah.service';

export function mataKuliahRoutes(auth: AuthService, origin: string, service?: MataKuliahService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan mata kuliah tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/mata-kuliah' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: listQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: mataKuliahBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: mataKuliahPatch });
}
