import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { programStudiBody, programStudiPatch, programStudiQuery } from './program-studi.model';
import type { ProgramStudiService } from './program-studi.service';

export function programStudiRoutes(auth: AuthService, origin: string, service?: ProgramStudiService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan program studi tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/program-studi' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: programStudiQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: programStudiBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: programStudiPatch });
}
