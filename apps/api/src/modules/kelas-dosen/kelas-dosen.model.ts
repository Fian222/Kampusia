import { t } from 'elysia';
import { idParams, listQuery } from '../../utils/master-data';
export const kelasDosenBody = t.Object({ dosen_id: t.String({ format: 'uuid' }), is_koordinator: t.Optional(t.Boolean()) });
export const kelasDosenPatch = t.Object({ is_koordinator: t.Boolean() });
export const assignmentParams = t.Object({ ...idParams.properties, assignmentId: t.String({ format: 'uuid' }) });
export const kelasDosenQuery = t.Object({ page: listQuery.properties.page, limit: listQuery.properties.limit, search: listQuery.properties.search });
export type KelasDosenInput = typeof kelasDosenBody.static;
export type KelasDosenQuery = typeof kelasDosenQuery.static;
