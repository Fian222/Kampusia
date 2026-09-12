import { t } from 'elysia';
export const mataKuliahBody = t.Object({
  kode: t.String({ minLength: 1, maxLength: 30 }),
  nama: t.String({ minLength: 1, maxLength: 150 }),
  sks: t.Integer({ minimum: 1, maximum: 32767 }),
  is_active: t.Optional(t.Boolean()),
});
export const mataKuliahPatch = t.Partial(mataKuliahBody);
export type MataKuliahInput = typeof mataKuliahBody.static;
