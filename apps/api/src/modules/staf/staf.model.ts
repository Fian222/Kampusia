import { t } from 'elysia';
import { listQuery } from '../../utils/master-data';

export const staffRoles = ['ADMIN', 'AKADEMIK'] as const;
export type StaffRole = (typeof staffRoles)[number];
const role = t.Union([t.Literal('ADMIN'), t.Literal('AKADEMIK')]);
const email = t.Union([t.String({ maxLength: 254 }), t.Null()]);

export const stafQuery = t.Object({ ...listQuery.properties, role: t.Optional(role) });
export const stafParams = t.Object({ loginId: t.String({ pattern: '^[0-9]{1,30}$' }) });
export const stafBody = t.Object({ login_id: t.String({ minLength: 1, maxLength: 40 }), role, email: t.Optional(email) });
export const stafPatch = t.Object({ role: t.Optional(role), email: t.Optional(email), is_active: t.Optional(t.Boolean()) });
export type StafQuery = typeof stafQuery.static;
export type StafInput = typeof stafBody.static;
export type StafPatch = typeof stafPatch.static;
