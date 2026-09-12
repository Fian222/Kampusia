import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { kurikulumBody, kurikulumPatch, kurikulumQuery } from './kurikulum.model';
import type { KurikulumService } from './kurikulum.service';

export function kurikulumRoutes(auth: AuthService, origin: string, service?: KurikulumService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan kurikulum tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/kurikulum' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: kurikulumQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: kurikulumBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: kurikulumPatch });
}
