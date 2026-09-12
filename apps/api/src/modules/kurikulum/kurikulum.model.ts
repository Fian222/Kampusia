import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
export const kurikulumBody = t.Object({
  kode: t.String({ minLength: 1, maxLength: 30 }), nama: t.String({ minLength: 1, maxLength: 150 }),
  program_studi_id: t.String({ format: 'uuid' }), tahun_berlaku: t.Integer({ minimum: 1900, maximum: 9999 }),
  is_active: t.Optional(t.Boolean()),
});
export const kurikulumPatch = t.Partial(kurikulumBody);
export const kurikulumQuery = t.Object({ ...listQuery.properties,
  program_studi_id: t.Optional(t.String({ format: 'uuid' })),
  tahun_berlaku: t.Optional(t.Numeric({ minimum: 1900, maximum: 9999, multipleOf: 1 })),
});
export type KurikulumInput = typeof kurikulumBody.static;
export type KurikulumQuery = typeof kurikulumQuery.static;
