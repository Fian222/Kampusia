import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';

const uuid = t.String({ format: 'uuid' });
export const pertemuanStatuses = ['TERJADWAL', 'SELESAI', 'DIBATALKAN'] as const;
export const absensiStatuses = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as const;

export const pertemuanQuery = t.Object({
  page: listQuery.properties.page,
  limit: listQuery.properties.limit,
});

export const dosenKelasQuery = t.Object({
  page: listQuery.properties.page,
  limit: listQuery.properties.limit,
  search: listQuery.properties.search,
  semester_id: t.Optional(uuid),
  status: t.Optional(t.Union([t.Literal('DRAFT'), t.Literal('DIBUKA'), t.Literal('DITUTUP'), t.Literal('DIBATALKAN')])),
});

export const pertemuanBody = t.Object({
  nomor_pertemuan: t.Integer({ minimum: 1, maximum: 32767 }),
  tanggal: t.String({ minLength: 10, maxLength: 10 }),
  jam_mulai: t.String({ minLength: 5, maxLength: 15 }),
  jam_selesai: t.String({ minLength: 5, maxLength: 15 }),
  materi: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
}, { additionalProperties: false });

export const pertemuanPatch = t.Object({
  nomor_pertemuan: t.Optional(t.Integer({ minimum: 1, maximum: 32767 })),
  tanggal: t.Optional(t.String({ minLength: 10, maxLength: 10 })),
  jam_mulai: t.Optional(t.String({ minLength: 5, maxLength: 15 })),
  jam_selesai: t.Optional(t.String({ minLength: 5, maxLength: 15 })),
  materi: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
  koreksi: t.Optional(t.Boolean()),
}, { additionalProperties: false });

export const absensiBody = t.Object({
  status: t.Union([t.Literal('HADIR'), t.Literal('IZIN'), t.Literal('SAKIT'), t.Literal('ALPHA')]),
  keterangan: t.Optional(t.Nullable(t.String({ maxLength: 5000 }))),
  koreksi_terlambat: t.Optional(t.Boolean()),
}, { additionalProperties: false });

export const absensiPatch = t.Object({
  status: t.Optional(t.Union([t.Literal('HADIR'), t.Literal('IZIN'), t.Literal('SAKIT'), t.Literal('ALPHA')])),
  keterangan: t.Optional(t.Nullable(t.String({ maxLength: 5000 }))),
}, { additionalProperties: false });

export const attendanceParams = t.Object({ id: uuid, mahasiswaId: uuid });
export type PertemuanInput = typeof pertemuanBody.static;
export type PertemuanPatch = typeof pertemuanPatch.static;
export type AbsensiInput = typeof absensiBody.static;
export type AbsensiPatch = typeof absensiPatch.static;
export type DosenKelasQuery = typeof dosenKelasQuery.static;
