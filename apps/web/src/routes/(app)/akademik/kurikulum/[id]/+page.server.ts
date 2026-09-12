import { error, fail, redirect } from '@sveltejs/kit';
import { serverApi } from '$lib/server/api';
import { requireMasterAccess, apiMessage, integer } from '$lib/server/master-data';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async event => {
  requireMasterAccess(event);
  const params = event.url.searchParams;
  const query = { page: integer(params.get('page'), 1, 1000000), limit: 20, search: params.get('search') ?? '' };
  const courseQuery = { page: integer(params.get('course_page'), 1, 1000000), limit: 20, search: params.get('course_search') ?? '', is_active: 'true' as const };
  const client = serverApi(event);
  const results = await Promise.all([
    client.kurikulum({ id: event.params.id }).get(),
    client.kurikulum({ id: event.params.id })['mata-kuliah'].get({ query }),
    client['mata-kuliah'].get({ query: courseQuery }),
  ]).catch(() => error(503, apiMessage(null)));
  const [curriculum, memberships, courses] = results;
  for (const result of results) {
    if (result.status === 401) redirect(303, '/login');
    if (result.error || !result.data?.success) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error?.value));
  }
  if (!curriculum.data?.success || !memberships.data?.success || !courses.data?.success) error(503, apiMessage(null));
  return { curriculum: curriculum.data.data, memberships: memberships.data, courses: courses.data, query, courseQuery };
};
export const actions: Actions = {
  default: async event => {
    requireMasterAccess(event);
    const form = await event.request.formData();
    const values = Object.fromEntries(['mode', 'membership_id', 'mata_kuliah_id', 'semester_rekomendasi', 'is_wajib'].map(key => [key, String(form.get(key) ?? '')]));
    const invalid = (message: string) => fail(400, { values, message });
    if (!['add', 'update', 'remove'].includes(values.mode!)) return invalid('Tindakan tidak valid.');
    if (values.mode !== 'add' && !values.membership_id) return invalid('Pilih keanggotaan mata kuliah.');
    if (values.mode === 'add' && !values.mata_kuliah_id) return invalid('Pilih mata kuliah aktif.');
    const semester = values.semester_rekomendasi?.trim() ? Number(values.semester_rekomendasi) : null;
    if (values.mode !== 'remove' && (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 32767))) return invalid('Semester rekomendasi harus kosong atau bilangan bulat antara 1 dan 32767.');
    if (values.mode !== 'remove' && !['true', 'false'].includes(values.is_wajib!)) return invalid('Pilih Wajib atau Pilihan.');
    const body = { semester_rekomendasi: semester, is_wajib: values.is_wajib === 'true' };
    const client = serverApi(event).kurikulum({ id: event.params.id })['mata-kuliah'];
    let result;
    try {
      result = values.mode === 'add' ? await client.post({ ...body, mata_kuliah_id: values.mata_kuliah_id! })
        : values.mode === 'update' ? await client({ membershipId: values.membership_id! }).patch(body)
        : await client({ membershipId: values.membership_id! }).delete();
    } catch { return fail(503, { values, message: apiMessage(null) }); }
    if (result.status === 401) redirect(303, '/login');
    if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error?.value) });
    return { saved: true as const, message: 'Perubahan berhasil disimpan.' };
  },
};
