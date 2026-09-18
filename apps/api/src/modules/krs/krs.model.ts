import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
export const krsStatuses = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN'] as const;
export const krsQuery = t.Object({ ...listQuery.properties,
  semester_id: t.Optional(t.String({ format: 'uuid' })),
  program_studi_id: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.Union(krsStatuses.map(value => t.Literal(value)))),
});
export type KrsQuery = typeof krsQuery.static;
export const selectionBody = t.Object({ kelas_kuliah_id: t.String({ format: 'uuid' }) }, { additionalProperties: false });
export const emptyBody = t.Object({}, { additionalProperties: false });
export const reasonBody = t.Object({ alasan: t.String({ minLength: 1, maxLength: 2000 }) }, { additionalProperties: false });
export const detailParams = t.Object({ id: t.String({ format: 'uuid' }), detailId: t.String({ format: 'uuid' }) });
