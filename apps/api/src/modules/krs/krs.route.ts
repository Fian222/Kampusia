import { Elysia } from 'elysia';
import { authorization, requireRole } from '../../middleware/authorization';
import { requireMasterData } from '../../middleware/master-data';
import { AuthError } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import { detailParams, emptyBody, krsQuery, selectionBody } from './krs.model';
import type { KrsService } from './krs.service';
export function krsRoutes(auth: AuthService, origin: string, service?: KrsService) {
  const get = () => { if (!service) throw new MasterDataError(503, 'Layanan KRS tidak tersedia.'); return service; };
  const admin = new Elysia({ prefix: '/krs' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ user, query }) => ({ success: true as const, ...await get().list(user, query) }), { query: krsQuery })
    .get('/:id', async ({ user, params }) => ({ success: true as const, data: await get().get(user, params.id) }), { params: idParams })
    .post('/:id/approve', async ({ user, params }) => ({ success: true as const, data: await get().approve(user, params.id) }), { params: idParams, body: emptyBody })
    .post('/:id/reject', async ({ user, params }) => ({ success: true as const, data: await get().reject(user, params.id) }), { params: idParams, body: emptyBody })
    .post('/:id/cancel', async ({ user, params }) => ({ success: true as const, data: await get().cancel(user, params.id) }), { params: idParams, body: emptyBody })
    .post('/:id/reopen', async ({ user, params }) => ({ success: true as const, data: await get().reopen(user, params.id, true) }), { params: idParams, body: emptyBody });
  const student = new Elysia({ prefix: '/mahasiswa/me/krs' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => {
      requireRole(user, ['MAHASISWA']);
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin) throw new AuthError(403, 'Asal permintaan tidak diizinkan.');
    })
    .get('/', async ({ user, query }) => ({ success: true as const, ...await get().mine(user, query) }), { query: listQuery })
    .get('/:id', async ({ user, params }) => ({ success: true as const, data: await get().bySemester(user, params.id) }), { params: idParams })
    .get('/:id/kelas', async ({ user, params, query }) => ({ success: true as const, ...await get().available(user, params.id, query) }), { params: idParams, query: listQuery })
    .post('/:id', async ({ user, params }) => ({ success: true as const, data: await get().create(user, params.id) }), { params: idParams, body: emptyBody })
    .post('/:id/kelas', async ({ user, params, body }) => ({ success: true as const, data: await get().add(user, params.id, body.kelas_kuliah_id) }), { params: idParams, body: selectionBody })
    .delete('/:id/kelas/:detailId', async ({ user, params }) => ({ success: true as const, data: await get().remove(user, params.id, params.detailId) }), { params: detailParams })
    .post('/:id/submit', async ({ user, params }) => ({ success: true as const, data: await get().submit(user, params.id) }), { params: idParams, body: emptyBody })
    .post('/:id/reopen', async ({ user, params }) => ({ success: true as const, data: await get().reopen(user, params.id) }), { params: idParams, body: emptyBody });
  return new Elysia().use(admin).use(student);
}
