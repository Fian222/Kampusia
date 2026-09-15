import { t } from 'elysia';

const uuid = t.String({ format: 'uuid' });
const decimal = t.String({ pattern: '^(?:0|[1-9]\\d{0,2})(?:\\.\\d{1,2})?$' });

export const komponenNilaiBody = t.Object({
  nama: t.String({ minLength: 1, maxLength: 100 }),
  bobot: decimal,
  urutan: t.Integer({ minimum: 1, maximum: 32767 }),
  is_active: t.Optional(t.Boolean()),
}, { additionalProperties: false });

export const komponenNilaiPatch = t.Object({
  nama: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  bobot: t.Optional(decimal),
  urutan: t.Optional(t.Integer({ minimum: 1, maximum: 32767 })),
  is_active: t.Optional(t.Boolean()),
}, { additionalProperties: false });

export const nilaiBody = t.Object({ nilai: t.Nullable(decimal) }, { additionalProperties: false });
export const koreksiNilaiBody = t.Object({
  component_id: uuid,
  nilai: decimal,
  alasan: t.String({ minLength: 1, maxLength: 5000 }),
}, { additionalProperties: false });

export const componentParams = t.Object({ id: uuid, componentId: uuid });
export const scoreParams = t.Object({ id: uuid, mahasiswaId: uuid, componentId: uuid });
export const correctionParams = t.Object({ id: uuid, mahasiswaId: uuid });

export type KomponenNilaiInput = typeof komponenNilaiBody.static;
export type KomponenNilaiPatch = typeof komponenNilaiPatch.static;
export type NilaiInput = typeof nilaiBody.static;
export type KoreksiNilaiInput = typeof koreksiNilaiBody.static;
