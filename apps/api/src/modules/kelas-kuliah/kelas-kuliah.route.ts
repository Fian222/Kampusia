import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { kelasKuliahBody, kelasKuliahPatch, kelasKuliahQuery } from './kelas-kuliah.model';
import type { KelasKuliahService } from './kelas-kuliah.service';

export function kelasKuliahRoutes(auth: AuthService, origin: string, service?: KelasKuliahService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan kelas kuliah tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/kelas-kuliah' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: kelasKuliahQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: kelasKuliahBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: kelasKuliahPatch });
}
