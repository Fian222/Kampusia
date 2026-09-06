import { t } from 'elysia';

export class MasterDataError extends Error {
  constructor(public status: 400 | 404 | 409 | 503, message: string) { super(message); }
}

export const listQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 1000000, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  search: t.Optional(t.String({ maxLength: 150 })),
  is_active: t.Optional(t.Union([t.Literal('true'), t.Literal('false')])),
});
export const idParams = t.Object({ id: t.String({ format: 'uuid' }) });
export type ListQuery = typeof listQuery.static;
export function pagination(query: ListQuery) {
  return { page: query.page ?? 1, limit: query.limit ?? 20 };
}
export function normalizeText(value: string, label: string, max: number, code = false) {
  const normalized = code ? value.trim().toUpperCase() : value.trim();
  if (!normalized || normalized.length > max) {
    throw new MasterDataError(400, `${label} wajib diisi dan maksimal ${max} karakter.`);
  }
  return normalized;
}
export function requirePatch(input: object) {
  if (!Object.values(input).some(value => value !== undefined)) {
    throw new MasterDataError(400, 'Kirim setidaknya satu perubahan.');
  }
}
export const searchPattern = (search: string) => '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%';

// Drizzle wraps postgres-js errors in a cause. Only map known unique constraints.
export async function withDuplicateCode<T>(label: string, constraint: string, operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    let cause: unknown = error;
    for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
      if ('code' in cause && cause.code === '23505' && 'constraint_name' in cause && cause.constraint_name === constraint) {
        throw new MasterDataError(409, `Kode ${label} sudah digunakan.`);
      }
      cause = 'cause' in cause ? cause.cause : undefined;
    }
    throw error;
  }
}
