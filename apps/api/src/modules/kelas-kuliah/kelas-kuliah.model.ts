import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
export const kelasStatus = t.Union([t.Literal('DRAFT'), t.Literal('DIBUKA'), t.Literal('DITUTUP'), t.Literal('DIBATALKAN')]);
const uuid = t.String({ format: 'uuid' });
export const kelasKuliahBody = t.Object({ semester_id: uuid, mata_kuliah_id: uuid, program_studi_id: uuid,
  nama_kelas: t.String({ minLength: 1, maxLength: 20 }), kapasitas: t.Integer({ minimum: 1, maximum: 2147483647 }), status: t.Optional(kelasStatus) });
export const kelasKuliahPatch = t.Partial(kelasKuliahBody);
export const kelasKuliahQuery = t.Object({ page: listQuery.properties.page, limit: listQuery.properties.limit, search: listQuery.properties.search,
  semester_id: t.Optional(uuid), mata_kuliah_id: t.Optional(uuid), program_studi_id: t.Optional(uuid), status: t.Optional(kelasStatus) });
export type KelasKuliahInput = typeof kelasKuliahBody.static;
export type KelasKuliahQuery = typeof kelasKuliahQuery.static;
