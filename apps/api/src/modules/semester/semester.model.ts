import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';
const jenis = t.Union([t.Literal('GANJIL'), t.Literal('GENAP')]);
export const semesterBody = t.Object({
  kode: t.String({ minLength: 1, maxLength: 5 }), nama: t.String({ minLength: 1, maxLength: 100 }),
  tahun_mulai: t.Integer({ minimum: 1900, maximum: 9998 }), jenis,
  tanggal_mulai: t.String({ format: 'date' }), tanggal_selesai: t.String({ format: 'date' }),
  krs_mulai_at: t.Optional(t.Nullable(t.String({ minLength: 16, maxLength: 19 }))),
  krs_selesai_at: t.Optional(t.Nullable(t.String({ minLength: 16, maxLength: 19 }))),
  is_active: t.Optional(t.Boolean()),
});
export const semesterPatch = t.Partial(semesterBody);
export const semesterKrsPeriodBody = t.Object({
  krs_mulai_at: t.Nullable(t.String({ minLength: 16, maxLength: 19 })),
  krs_selesai_at: t.Nullable(t.String({ minLength: 16, maxLength: 19 })),
});
export const semesterQuery = t.Object({ ...listQuery.properties, jenis: t.Optional(jenis), tahun_mulai: t.Optional(t.Numeric({ minimum: 1900, maximum: 9998, multipleOf: 1 })) });
export type SemesterInput = typeof semesterBody.static;
export type SemesterKrsPeriodInput = typeof semesterKrsPeriodBody.static;
export type SemesterQuery = typeof semesterQuery.static;
