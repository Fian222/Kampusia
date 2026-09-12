import { t } from 'elysia';
export const membershipPatch = t.Object({
  semester_rekomendasi: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 32767 }))),
  is_wajib: t.Optional(t.Boolean()),
});
export const membershipBody = t.Object({ ...membershipPatch.properties, mata_kuliah_id: t.String({ format: 'uuid' }) });
export const membershipParams = t.Object({ id: t.String({ format: 'uuid' }), membershipId: t.String({ format: 'uuid' }) });
export type MembershipInput = typeof membershipBody.static;
export type MembershipPatch = typeof membershipPatch.static;
