import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { jadwalBody, jadwalPatch, jadwalParams } from './jadwal.model';
import type { JadwalService } from './jadwal.service';
export function jadwalRoutes(auth: AuthService, origin: string, service?: JadwalService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan jadwal kuliah tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/kelas-kuliah/:id/jadwal' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ params, query }) => ({ success: true as const, ...await getService().list(params.id, query) }), { params: idParams, query: listQuery })
    .post('/', async ({ params, body, set }) => { const data = await getService().add(params.id, body); set.status = 201; return { success: true as const, data }; }, { params: idParams, body: jadwalBody })
    .patch('/:jadwalId', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, params.jadwalId, body) }), { params: jadwalParams, body: jadwalPatch })
    .delete('/:jadwalId', async ({ params }) => ({ success: true as const, data: await getService().remove(params.id, params.jadwalId) }), { params: jadwalParams });
}
