import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { requireMasterAccess, apiMessage, integer, active } from './master-data';

export type CatalogKind = 'mata-kuliah' | 'kurikulum';
export async function loadCatalog(event: RequestEvent, kind: CatalogKind) {
  requireMasterAccess(event);
  const params = event.url.searchParams;
  const filters = { page: integer(params.get('page'), 1, 1000000), limit: 20, search: params.get('search') ?? '', is_active: active(params.get('is_active')),
    program_studi_id: params.get('program_studi_id') || undefined, tahun_berlaku: params.get('tahun_berlaku') ? integer(params.get('tahun_berlaku'), 1900, 9999) : undefined };
  const programQuery = { page: integer(params.get('program_page'), 1, 1000000), limit: 20, search: params.get('program_search') ?? '' };
  const client = serverApi(event);
  const result = await (kind === 'mata-kuliah' ? client['mata-kuliah'].get({ query: filters }).then(result => ({ ...result,
    data: result.data?.success ? { ...result.data, data: result.data.data.map(row => ({ ...row, programStudi: null, tahunBerlaku: null })) } : null,
  })) : client.kurikulum.get({ query: filters }).then(result => ({ ...result,
    data: result.data?.success ? { ...result.data, data: result.data.data.map(row => ({ ...row, sks: null })) } : null,
  }))).catch(() => error(503, apiMessage(null)));
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error?.value));
  let edit = null;
  const editId = params.get('edit');
  if (editId) {
    const detail = await (kind === 'mata-kuliah' ? client['mata-kuliah']({ id: editId }).get().then(result => ({ ...result,
      data: result.data?.success ? { ...result.data, data: { ...result.data.data, programStudi: null, tahunBerlaku: null } } : null,
    })) : client.kurikulum({ id: editId }).get().then(result => ({ ...result,
      data: result.data?.success ? { ...result.data, data: { ...result.data.data, sks: null } } : null,
    }))).catch(() => error(503, apiMessage(null)));
    if (detail.error || !detail.data?.success) error(detail.status >= 400 && detail.status < 500 ? detail.status : 503, apiMessage(detail.error?.value));
    edit = detail.data.data;
  }
  let programs = null;
  if (kind === 'kurikulum') {
    const list = await client['program-studi'].get({ query: programQuery }).catch(() => error(503, apiMessage(null)));
    if (list.error || !list.data?.success) error(503, apiMessage(list.error?.value));
    programs = list.data;
  }
  return { kind, records: result.data.data, meta: result.data.meta, filters, edit, programs, programQuery };
}
export async function saveCatalog(event: RequestEvent, kind: CatalogKind) {
  requireMasterAccess(event);
  const form = await event.request.formData();
  const values = Object.fromEntries(['mode', 'id', 'kode', 'nama', 'sks', 'program_studi_id', 'tahun_berlaku', 'is_active'].map(key => [key, String(form.get(key) ?? '')]));
  const invalid = (message: string) => fail(400, { values, message });
  const mode = form.get('mode');
  const submitted = mode === 'status' ? {} : { values };
  if (mode !== 'save' && mode !== 'status') return invalid('Tindakan tidak valid.');
  if (mode === 'status' && (!values.id || !['true', 'false'].includes(values.is_active!))) return invalid('Perubahan status tidak valid.');
  if (mode === 'save') {
    if (!values.kode?.trim() || !values.nama?.trim()) return invalid('Kode dan nama wajib diisi.');
    const number = Number(kind === 'mata-kuliah' ? values.sks : values.tahun_berlaku);
    if (!Number.isInteger(number) || number < (kind === 'mata-kuliah' ? 1 : 1900) || number > (kind === 'mata-kuliah' ? 32767 : 9999)) return invalid(kind === 'mata-kuliah' ? 'SKS harus berupa bilangan bulat antara 1 dan 32767.' : 'Tahun berlaku harus antara 1900 dan 9999.');
    if (kind === 'kurikulum' && !values.program_studi_id) return invalid('Pilih program studi.');
  }
  const common = { kode: values.kode!, nama: values.nama! };
  const client = serverApi(event);
  let result;
  try {
    if (kind === 'mata-kuliah') {
      const body = { ...common, sks: Number(values.sks) };
      result = mode === 'status' ? await client['mata-kuliah']({ id: values.id! }).patch({ is_active: values.is_active === 'true' })
        : values.id ? await client['mata-kuliah']({ id: values.id }).patch(body) : await client['mata-kuliah'].post(body);
    } else {
      const body = { ...common, program_studi_id: values.program_studi_id!, tahun_berlaku: Number(values.tahun_berlaku) };
      result = mode === 'status' ? await client.kurikulum({ id: values.id! }).patch({ is_active: values.is_active === 'true' })
        : values.id ? await client.kurikulum({ id: values.id }).patch(body) : await client.kurikulum.post(body);
    }
  } catch { return fail(503, { ...submitted, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { ...submitted, message: apiMessage(result.error?.value) });
  return { message: 'Perubahan berhasil disimpan.', saved: true as const };
}
export type CatalogData = Awaited<ReturnType<typeof loadCatalog>>;
