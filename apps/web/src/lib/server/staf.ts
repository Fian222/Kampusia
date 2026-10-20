import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { apiMessage, integer } from './master-data';

const roles = ['ADMIN', 'AKADEMIK'] as const;
type StaffRole = (typeof roles)[number];
const roleOf = (value: string | null | undefined) => roles.find((role): role is StaffRole => role === value);

function requireAdmin(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'ADMIN') error(403, 'Anda tidak memiliki akses ke halaman ini.');
}

export async function loadStaf(event: RequestEvent) {
  requireAdmin(event);
  const params = event.url.searchParams;
  const role = params.get('role') || undefined;
  if (role && !roleOf(role)) error(400, 'Peran tidak valid.');
  const isActive = params.get('is_active') || undefined;
  if (isActive && !['true', 'false'].includes(isActive)) error(400, 'Status tidak valid.');
  const filters = { page: integer(params.get('page'), 1, 1000000), limit: 20, search: params.get('search') ?? '', role: roleOf(role), is_active: isActive as 'true' | 'false' | undefined };
  const result = await serverApi(event).staf.get({ query: filters }).catch(() => error(503, apiMessage(null)));
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error?.value));
  return { records: result.data, filters, roles, currentLoginId: event.locals.user!.loginId };
}

export async function saveStaf(event: RequestEvent) {
  requireAdmin(event);
  const form = await event.request.formData();
  const values = Object.fromEntries(['mode', 'login_id', 'role', 'email', 'is_active'].map(key => [key, String(form.get(key) ?? '')]));
  const invalid = (message: string) => fail(400, { values, message });
  const client = serverApi(event).staf;
  let result;
  try {
    if (values.mode === 'create') {
      const role = roleOf(values.role);
      if (!/^\s*[0-9]{1,30}\s*$/.test(values.login_id!)) return invalid('NIK harus terdiri dari 1–30 digit.');
      if (!role) return invalid('Pilih peran ADMIN atau AKADEMIK.');
      result = await client.post({ login_id: values.login_id!, role, email: values.email!.trim() || null });
    } else if (values.mode === 'update') {
      const role = roleOf(values.role);
      if (!role) return invalid('Pilih peran ADMIN atau AKADEMIK.');
      result = await client({ loginId: values.login_id! }).patch({ role, email: values.email!.trim() || null });
    } else if (values.mode === 'status') {
      if (!['true', 'false'].includes(values.is_active!)) return invalid('Perubahan status tidak valid.');
      result = await client({ loginId: values.login_id! }).patch({ is_active: values.is_active === 'true' });
    } else if (values.mode === 'reset-password') {
      result = await client({ loginId: values.login_id! })['reset-password'].post();
    } else return invalid('Tindakan tidak valid.');
  } catch { return fail(503, { values, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error?.value) });
  const data = result.data.data;
  if ('temporaryPassword' in data) return { accountCredential: data, mode: values.mode };
  return { saved: true as const, message: 'Perubahan akun staf berhasil disimpan.' };
}
