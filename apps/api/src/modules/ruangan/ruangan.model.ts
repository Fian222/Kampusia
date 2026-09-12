import { t } from 'elysia';
export const ruanganBody = t.Object({
  kode: t.String({ minLength: 1, maxLength: 30 }),
  nama: t.String({ minLength: 1, maxLength: 100 }),
  gedung: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 100 }), t.Null()])),
  kapasitas: t.Integer({ minimum: 1, maximum: 2147483647 }),
  is_active: t.Optional(t.Boolean()),
});
export const ruanganPatch = t.Partial(ruanganBody);
export type RuanganInput = typeof ruanganBody.static;
