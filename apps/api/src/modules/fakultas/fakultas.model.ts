import { t } from 'elysia';

export const fakultasBody = t.Object({
  kode: t.String({ minLength: 1, maxLength: 20 }),
  nama: t.String({ minLength: 1, maxLength: 150 }),
  is_active: t.Optional(t.Boolean()),
});
export const fakultasPatch = t.Partial(fakultasBody);
export type FakultasInput = typeof fakultasBody.static;
