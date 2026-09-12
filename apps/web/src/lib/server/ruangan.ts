import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { requireMasterAccess, apiMessage, active } from './master-data';
import { read, query } from './academic-offerings';
export async function loadRuangan(event: RequestEvent) {
  requireMasterAccess(event); const client = serverApi(event);
  const filters = { ...query(event), is_active: active(event.url.searchParams.get('is_active')) };
  const records = await read(client.ruangan.get({ query: filters }));
  const id = event.url.searchParams.get('edit');
  const edit = id ? (await read(client.ruangan({ id }).get())).data : null;
  return { records, filters, edit };
}
export async function saveRuangan(event: RequestEvent) {
  requireMasterAccess(event);
  const form = await event.request.formData();
  const values: Record<string, string> = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const client = serverApi(event); let result;
  try {
    if (values.mode === 'status') {
      if (values.confirm !== 'yes' || !['true', 'false'].includes(values.is_active!)) return fail(400, { values, message: 'Konfirmasikan perubahan status ruangan.' });
      result = await client.ruangan({ id: values.id! }).patch({ is_active: values.is_active === 'true' });
    } else if (values.mode === 'save') {
      const body = { kode: values.kode!, nama: values.nama!, gedung: values.gedung?.trim() || null, kapasitas: Number(values.kapasitas) };
      result = values.id ? await client.ruangan({ id: values.id }).patch(body) : await client.ruangan.post(body);
    } else return fail(400, { values, message: 'Tindakan tidak valid.' });
  } catch { return fail(503, { values, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error?.value) });
  return { saved: true as const, message: 'Perubahan berhasil disimpan.' };
}
