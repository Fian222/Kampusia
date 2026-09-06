import { t } from 'elysia';
import { jenjangValues } from './program-studi.options';
import { listQuery } from '../../utils/master-data';
import { fakultasBody } from '../fakultas/fakultas.model';

export { jenjangValues } from './program-studi.options';
// UnionEnum otherwise supplies its first value as a default, including on PATCH.
export const jenjangModel = t.UnionEnum(jenjangValues, { default: undefined });
export const programStudiBody = t.Object({
  ...fakultasBody.properties,
  fakultas_id: t.String({ format: 'uuid' }),
  jenjang: jenjangModel,
});
export const programStudiPatch = t.Partial(programStudiBody);
export const programStudiQuery = t.Object({
  ...listQuery.properties,
  fakultas_id: t.Optional(t.String({ format: 'uuid' })),
  jenjang: t.Optional(jenjangModel),
});
export type ProgramStudiInput = typeof programStudiBody.static;
export type ProgramStudiQuery = typeof programStudiQuery.static;
