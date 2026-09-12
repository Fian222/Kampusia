import { t } from 'elysia';
export const jadwalBody = t.Object({
  ruangan_id: t.String({ format: 'uuid' }),
  hari: t.Integer({ minimum: 1, maximum: 7 }),
  jam_mulai: t.String({ maxLength: 15 }),
  jam_selesai: t.String({ maxLength: 15 }),
});
export const jadwalPatch = t.Partial(jadwalBody);
export const jadwalParams = t.Object({ id: t.String({ format: 'uuid' }), jadwalId: t.String({ format: 'uuid' }) });
export type JadwalInput = typeof jadwalBody.static;
