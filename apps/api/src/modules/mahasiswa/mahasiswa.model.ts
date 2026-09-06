import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
import { mahasiswaStatusValues } from './mahasiswa.options';

const uuid = t.String({ format: 'uuid' });
export const mahasiswaStatus = t.UnionEnum(mahasiswaStatusValues, { default: undefined });
export const mahasiswaBody = t.Object({
  user_id: t.Optional(t.Nullable(uuid)),
  program_studi_id: uuid,
  kurikulum_id: uuid,
  nim: t.String({ minLength: 1, maxLength: 30 }),
  nama: t.String({ minLength: 1, maxLength: 150 }),
  angkatan: t.Integer({ minimum: 1900, maximum: 9999 }),
  status: t.Optional(mahasiswaStatus),
});
export const mahasiswaPatch = t.Partial(mahasiswaBody);
const { is_active: _active, ...paging } = listQuery.properties;
export const mahasiswaQuery = t.Object({
  ...paging,
  program_studi_id: t.Optional(uuid),
  kurikulum_id: t.Optional(uuid),
  angkatan: t.Optional(t.Numeric({ minimum: 1900, maximum: 9999, multipleOf: 1 })),
  status: t.Optional(mahasiswaStatus),
});
export const kurikulumOptionsQuery = t.Object({ ...listQuery.properties, program_studi_id: t.Optional(uuid) });
export type MahasiswaInput = typeof mahasiswaBody.static;
export type MahasiswaQuery = typeof mahasiswaQuery.static;
export type KurikulumOptionsQuery = typeof kurikulumOptionsQuery.static;
