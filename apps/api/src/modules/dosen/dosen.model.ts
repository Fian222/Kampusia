import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
const uuid = t.String({ format: 'uuid' });
export const dosenBody = t.Object({
  program_studi_id: t.Optional(t.Nullable(uuid)),
  nik: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 30 }))),
  kode_dosen: t.String({ minLength: 1, maxLength: 30 }),
  nidn: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 30 }))),
  nama: t.String({ minLength: 1, maxLength: 150 }),
  is_active: t.Optional(t.Boolean()),
});
export const dosenPatch = t.Partial(dosenBody);
export const dosenQuery = t.Object({ ...listQuery.properties, program_studi_id: t.Optional(uuid) });
export type DosenInput = typeof dosenBody.static;
export type DosenQuery = typeof dosenQuery.static;
