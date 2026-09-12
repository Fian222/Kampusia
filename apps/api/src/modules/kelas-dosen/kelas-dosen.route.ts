import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { kelasDosenBody, kelasDosenPatch, kelasDosenQuery, assignmentParams } from './kelas-dosen.model';
import type { KelasDosenService } from './kelas-dosen.service';
export function kelasDosenRoutes(auth: AuthService, origin: string, service?: KelasDosenService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan kelas dosen tidak tersedia.'); return service; };
  return new Elysia({ prefix: '/kelas-kuliah/:id/dosen' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ params, query }) => ({ success: true as const, ...await getService().list(params.id, query) }), { params: idParams, query: kelasDosenQuery })
    .post('/', async ({ params, body, set }) => { const data = await getService().add(params.id, body); set.status = 201; return { success: true as const, data }; }, { params: idParams, body: kelasDosenBody })
    .patch('/:assignmentId', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, params.assignmentId, body) }), { params: assignmentParams, body: kelasDosenPatch })
    .delete('/:assignmentId', async ({ params }) => ({ success: true as const, data: await getService().remove(params.id, params.assignmentId) }), { params: assignmentParams });
}
