import { Elysia } from 'elysia';
import { requireMasterData } from '../../middleware/master-data';
import { authorization, requireRole } from '../../middleware/authorization';
import { idParams, MasterDataError } from '../../utils/master-data';
import type { AuthService } from '../auth/auth.service';
import { kurikulumOptionsQuery, mahasiswaBody, mahasiswaPatch, mahasiswaQuery } from './mahasiswa.model';
import type { MahasiswaService } from './mahasiswa.service';

export function mahasiswaRoutes(auth: AuthService, origin: string, service?: MahasiswaService) {
  const getService = () => { if (!service) throw new MasterDataError(503, 'Layanan mahasiswa tidak tersedia.'); return service; };
  const own = new Elysia({ prefix: '/mahasiswa/me' }).use(authorization(auth))
    .onBeforeHandle(({ user }) => requireRole(user, ['MAHASISWA']))
    .get('', async ({ user }) => ({ success: true as const, data: await getService().getOwn(user.id) }));
  const managed = new Elysia({ prefix: '/mahasiswa' }).use(authorization(auth))
    .onBeforeHandle(({ user, request }) => requireMasterData(user, request, origin))
    .get('/', async ({ query }) => ({ success: true as const, ...await getService().list(query) }), { query: mahasiswaQuery })
    .get('/kurikulum-options', async ({ query }) => ({ success: true as const, ...await getService().kurikulumOptions(query) }), { query: kurikulumOptionsQuery })
    .get('/:id', async ({ params }) => ({ success: true as const, data: await getService().get(params.id) }), { params: idParams })
    .post('/:id/account', async ({ params, set }) => { set.status = 201; return { success: true as const, data: await getService().provisionAccount(params.id) }; }, { params: idParams })
    .post('/:id/account/reset', async ({ params }) => ({ success: true as const, data: await getService().resetPassword(params.id) }), { params: idParams })
    .post('/', async ({ body, set }) => {
      const data = await getService().create(body);
      set.status = 201;
      return { success: true as const, data };
    }, { body: mahasiswaBody })
    .patch('/:id', async ({ params, body }) => ({ success: true as const, data: await getService().update(params.id, body) }), { params: idParams, body: mahasiswaPatch });
  return new Elysia().use(own).use(managed);
}
