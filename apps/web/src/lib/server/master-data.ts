import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { jenjangValues } from 'api/master-data';
import { serverApi } from './api';

export type MasterKind = 'fakultas' | 'program-studi';
export function requireMasterAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (!['ADMIN', 'AKADEMIK'].includes(event.locals.user.role)) error(403, 'Anda tidak memiliki akses ke halaman ini.');
}
function apiMessage(value: unknown) {
  return value && typeof value === 'object' && 'message' in value && typeof value.message === 'string'
    ? value.message : 'Layanan data akademik tidak tersedia. Silakan coba lagi.';
}
function integer(value: string | null, fallback: number, max: number) {
  if (value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) error(400, 'Parameter halaman tidak valid.');
  return number;
}
function active(value: string | null): 'true' | 'false' | undefined {
  if (!value) return undefined;
  if (value !== 'true' && value !== 'false') error(400, 'Filter status tidak valid.');
  return value;
}
function jenjang(value: string | null) {
  if (!value) return undefined;
  const result = jenjangValues.find(item => item === value);
  if (!result) error(400, 'Jenjang tidak valid.');
  return result;
}
export async function loadMaster(event: RequestEvent, kind: MasterKind) {
  requireMasterAccess(event);
  const params = event.url.searchParams;
  const query = {
    page: integer(params.get('page'), 1, 1000000), limit: 20,
    search: params.get('search') ?? '', is_active: active(params.get('is_active')),
  };
  const filters = { ...query, fakultas_id: params.get('fakultas_id') || undefined, jenjang: jenjang(params.get('jenjang')) };
  const facultyQuery = { page: integer(params.get('faculty_page'), 1, 1000000), limit: 20, search: params.get('faculty_search') ?? '' };
  const client = serverApi(event);
  const result = await (kind === 'fakultas' ? client.fakultas.get({ query }).then(result => ({ ...result,
    data: result.data?.success ? { ...result.data, data: result.data.data.map(row => ({ ...row, fakultas: null, jenjang: null })) } : null,
  })) : client['program-studi'].get({ query: filters })).catch(() => error(503, apiMessage(null)));
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error?.value));
  const editId = params.get('edit');
  let edit = null;
  if (editId) {
    const detail = await (kind === 'fakultas' ? client.fakultas({ id: editId }).get().then(result => ({ ...result,
      data: result.data?.success ? { ...result.data, data: { ...result.data.data, fakultas: null, jenjang: null } } : null,
    })) : client['program-studi']({ id: editId }).get()).catch(() => error(503, apiMessage(null)));
    if (detail.error || !detail.data?.success) error(detail.status >= 400 && detail.status < 500 ? detail.status : 503, apiMessage(detail.error?.value));
    edit = detail.data.data;
  }
  let faculties = null;
  if (kind === 'program-studi') {
    const list = await client.fakultas.get({ query: facultyQuery }).catch(() => error(503, apiMessage(null)));
    if (list.error || !list.data?.success) error(503, apiMessage(list.error?.value));
    faculties = list.data;
  }
  return { kind, records: result.data.data, meta: result.data.meta, filters, edit, faculties, facultyQuery, jenjangValues };
}
export async function saveMaster(event: RequestEvent, kind: MasterKind) {
  requireMasterAccess(event);
  const form = await event.request.formData();
  const values = Object.fromEntries(['id', 'kode', 'nama', 'fakultas_id', 'jenjang', 'is_active'].map(key => [key, String(form.get(key) ?? '')]));
  const invalid = (message: string) => fail(400, { values, message });
  const mode = form.get('mode');
  const submitted = mode === 'status' ? {} : { values };
  if (mode !== 'save' && mode !== 'status') return invalid('Tindakan tidak valid.');
  if (mode === 'status' && (!values.id || !['true', 'false'].includes(values.is_active!))) return invalid('Perubahan status tidak valid.');
  if (mode === 'save' && (!values.kode?.trim() || !values.nama?.trim())) return invalid('Kode dan nama wajib diisi.');
  const selectedJenjang = jenjangValues.find(value => value === values.jenjang);
  if (mode === 'save' && kind === 'program-studi' && (!selectedJenjang || !values.fakultas_id)) return invalid('Pilih fakultas dan jenjang yang valid.');
  const common = { kode: values.kode!, nama: values.nama! };
  const client = serverApi(event);
  let result;
  try {
    if (kind === 'fakultas') {
      result = mode === 'status' ? await client.fakultas({ id: values.id! }).patch({ is_active: values.is_active === 'true' })
        : values.id ? await client.fakultas({ id: values.id }).patch(common) : await client.fakultas.post(common);
    } else {
      const body = { ...common, fakultas_id: values.fakultas_id!, jenjang: selectedJenjang! };
      result = mode === 'status' ? await client['program-studi']({ id: values.id! }).patch({ is_active: values.is_active === 'true' })
        : values.id ? await client['program-studi']({ id: values.id }).patch(body) : await client['program-studi'].post(body);
    }
  } catch { return fail(503, { ...submitted, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { ...submitted, message: apiMessage(result.error?.value) });
  return { message: 'Perubahan berhasil disimpan.', saved: true as const };
}
export type MasterData = Awaited<ReturnType<typeof loadMaster>>;
export type MasterForm = Awaited<ReturnType<typeof saveMaster>>;
