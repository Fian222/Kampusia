import { Elysia, t } from 'elysia';
import { authorization } from '../../middleware/authorization';
import { AuthError } from '../auth/auth.model';
import type { AuthService } from '../auth/auth.service';
import { idParams, listQuery, MasterDataError } from '../../utils/master-data';
import { absensiBody, absensiPatch, attendanceParams, dosenKelasQuery, pertemuanBody, pertemuanPatch, pertemuanQuery } from './pertemuan.model';
import type { PertemuanService } from './pertemuan.service';

export function pertemuanRoutes(auth: AuthService, origin: string, service?: PertemuanService) {
  const get = () => { if (!service) throw new MasterDataError(503, 'Layanan pertemuan dan absensi tidak tersedia.'); return service; };
  const csrf = (request: Request) => {
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin) throw new AuthError(403, 'Asal permintaan tidak diizinkan.');
  };
  const classes = new Elysia({ prefix: '/kelas-kuliah' }).use(authorization(auth)).onBeforeHandle(({ request }) => csrf(request))
    .get('/:id/pertemuan', async ({ user, params, query }) => ({ success: true as const, ...await get().list(user, params.id, query) }), { params: idParams, query: pertemuanQuery })
    .post('/:id/pertemuan', async ({ user, params, body, set }) => { const data = await get().create(user, params.id, body); set.status = 201; return { success: true as const, data }; }, { params: idParams, body: pertemuanBody });
  const meetings = new Elysia({ prefix: '/pertemuan' }).use(authorization(auth)).onBeforeHandle(({ request }) => csrf(request))
    .get('/:id', async ({ user, params }) => ({ success: true as const, data: await get().get(user, params.id) }), { params: idParams })
    .patch('/:id', async ({ user, params, body }) => ({ success: true as const, data: await get().update(user, params.id, body) }), { params: idParams, body: pertemuanPatch })
    .post('/:id/cancel', async ({ user, params }) => ({ success: true as const, data: await get().cancel(user, params.id) }), { params: idParams, body: tEmpty })
    .post('/:id/complete', async ({ user, params }) => ({ success: true as const, data: await get().complete(user, params.id) }), { params: idParams, body: tEmpty })
    .get('/:id/absensi', async ({ user, params }) => ({ success: true as const, data: await get().roster(user, params.id) }), { params: idParams })
    .put('/:id/absensi/:mahasiswaId', async ({ user, params, body }) => ({ success: true as const, data: await get().record(user, params.id, params.mahasiswaId, body) }), { params: attendanceParams, body: absensiBody })
    .patch('/:id/absensi/:mahasiswaId', async ({ user, params, body }) => ({ success: true as const, data: await get().correct(user, params.id, params.mahasiswaId, body) }), { params: attendanceParams, body: absensiPatch });
  const lecturer = new Elysia({ prefix: '/dosen/me/kelas-kuliah' }).use(authorization(auth))
    .get('/', async ({ user, query }) => ({ success: true as const, ...await get().lecturerClasses(user, query) }), { query: dosenKelasQuery })
    .get('/:id', async ({ user, params }) => ({ success: true as const, data: await get().lecturerClass(user, params.id) }), { params: idParams });
  const student = new Elysia({ prefix: '/mahasiswa/me/absensi' }).use(authorization(auth))
    .get('/', async ({ user, query }) => ({ success: true as const, ...await get().studentHistory(user, query) }), { query: listQuery });
  return new Elysia().use(classes).use(meetings).use(lecturer).use(student);
}

const tEmpty = t.Object({}, { additionalProperties: false });
