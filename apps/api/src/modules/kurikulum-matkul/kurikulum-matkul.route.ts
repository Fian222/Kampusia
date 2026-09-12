import { Elysia } from 'elysia';
import { authorization } from '../../middleware/authorization';
import { requireMasterData } from '../../middleware/master-data';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { membershipBody, membershipPatch, membershipParams } from './kurikulum-matkul.model';
import type { KurikulumMatkulService } from './kurikulum-matkul.service';
export function kurikulumMatkulRoutes(auth: AuthService, origin: string, service?: KurikulumMatkulService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan kurikulum mata kuliah tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/kurikulum/:id/mata-kuliah' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ params, query }) => ({ success: true as const, ...await getService().list(params.id, query) }), { params: idParams, query: listQuery })
    .post('/', async ({ params, body, set }) => {
      const data = await getService().add(params.id, body); set.status = 201; return { success: true as const, data };
    }, { params: idParams, body: membershipBody })
    .patch('/:membershipId', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, params.membershipId, body) }), { params: membershipParams, body: membershipPatch })
    .delete('/:membershipId', async ({ params }) => ({ success: true as const, data: await getService().remove(params.id, params.membershipId) }), { params: membershipParams });
}
