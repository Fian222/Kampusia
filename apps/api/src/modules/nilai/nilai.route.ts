import { Elysia, t } from 'elysia';
import { authorization } from '../../middleware/authorization';
import { AuthError } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { idParams, MasterDataError } from '../../utils/master-data';
import { componentParams, correctionParams, komponenNilaiBody, komponenNilaiPatch, koreksiNilaiBody, nilaiBody, scoreParams } from './nilai.model';
import type { NilaiService } from './nilai.service';
const empty = t.Object({}, { additionalProperties: false });
export function nilaiRoutes(auth: AuthService, origin: string, service?: NilaiService) {
  const get = () => { if (!service) throw new MasterDataError(503, 'Layanan penilaian tidak tersedia.'); return service; };
  const csrf = (request: Request) => { if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin) throw new AuthError(403, 'Asal permintaan tidak diizinkan.'); };
  return new Elysia({ prefix: '/kelas-kuliah' }).use(authorization(auth)).onBeforeHandle(({ request }) => csrf(request))
    .get('/:id/komponen-nilai', ({ user, params }) => get().listComponents(user, params.id), { params: idParams })
    .post('/:id/komponen-nilai', async ({ user, params, body, set }) => { const data = await get().createComponent(user, params.id, body); set.status = 201; return { success: true as const, data }; }, { params: idParams, body: komponenNilaiBody })
    .patch('/:id/komponen-nilai/:componentId', async ({ user, params, body }) => ({ success: true as const, data: await get().updateComponent(user, params.id, params.componentId, body) }), { params: componentParams, body: komponenNilaiPatch })
    .delete('/:id/komponen-nilai/:componentId', async ({ user, params }) => ({ success: true as const, data: await get().deleteComponent(user, params.id, params.componentId) }), { params: componentParams })
    .get('/:id/nilai', async ({ user, params }) => ({ success: true as const, data: await get().roster(user, params.id) }), { params: idParams })
    .put('/:id/nilai/:componentId/mahasiswa/:mahasiswaId', async ({ user, params, body }) => ({ success: true as const, data: await get().record(user, params.id, params.mahasiswaId, params.componentId, body) }), { params: scoreParams, body: nilaiBody })
    .post('/:id/nilai/finalize', async ({ user, params }) => ({ success: true as const, ...await get().finalize(user, params.id) }), { params: idParams, body: empty })
    .post('/:id/nilai/corrections/:mahasiswaId', async ({ user, params, body }) => ({ success: true as const, data: await get().correct(user, params.id, params.mahasiswaId, body) }), { params: correctionParams, body: koreksiNilaiBody });
}
