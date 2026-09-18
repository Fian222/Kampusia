import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { mahasiswaStatusValues } from 'api/mahasiswa-options';
import { active, apiMessage, integer, requireMasterAccess } from './master-data';
import { serverApi } from './api';

export type ProfileKind = 'mahasiswa' | 'dosen';
function status(value: string | null) {
  if (!value) return undefined;
  const found = mahasiswaStatusValues.find(item => item === value);
  if (!found) error(400, 'Status mahasiswa tidak valid.');
  return found;
}
// Preserve each Eden response's inferred data type while sharing transport errors.
async function read<T>(request: Promise<{ data: T | null; error: { value: unknown } | null; status: number }>) {
  const result = await request.catch(() => error(503, apiMessage(null)));
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error?.value));
  return result.data;
}
export async function loadProfiles(event: RequestEvent, kind: ProfileKind) {
  requireMasterAccess(event);
  const params = event.url.searchParams;
  const filters = {
    page: integer(params.get('page'), 1, 1000000), limit: 20,
    search: params.get('search') ?? '', program_studi_id: params.get('program_studi_id') || undefined,
    kurikulum_id: params.get('kurikulum_id') || undefined,
    angkatan: params.get('angkatan') ? integer(params.get('angkatan'), 1900, 9999) : undefined,
    status: status(params.get('status')), is_active: active(params.get('is_active')),
  };
  const programQuery = { page: integer(params.get('program_page'), 1, 1000000), limit: 20, search: params.get('program_search') ?? '' };
  const curriculumQuery = { page: integer(params.get('curriculum_page'), 1, 1000000), limit: 20, search: params.get('curriculum_search') ?? '', program_studi_id: params.get('choice_program') || undefined };
  const adviserQuery = { page: integer(params.get('adviser_page'), 1, 1000000), limit: 20, search: params.get('adviser_search') ?? '', is_active: 'true' as const };
  const client = serverApi(event);
  const programs = await read(client['program-studi'].get({ query: programQuery }));
  if (!programs.success) error(503, apiMessage(programs));
  const selectedProgramId = params.get('program_studi_id');
  const selectedProgram = selectedProgramId ? await read(client['program-studi']({ id: selectedProgramId }).get()) : null;
  if (selectedProgram && !selectedProgram.success) error(503, apiMessage(selectedProgram));
  const editId = params.get('edit');
  const common = { filters, programs, programQuery, curriculumQuery, selectedProgram: selectedProgram?.data ?? null, statuses: mahasiswaStatusValues };
  if (kind === 'mahasiswa') {
    const [records, advisers] = await Promise.all([read(client.mahasiswa.get({ query: filters })), read(client.dosen.get({ query: adviserQuery }))]);
    const edit = editId ? await read(client.mahasiswa({ id: editId }).get()) : null;
    const curricula = await read(client.mahasiswa['kurikulum-options'].get({ query: curriculumQuery }));
    if (!records.success || (edit && !edit.success) || !curricula.success) error(503, apiMessage(null));
    return { ...common, kind, records: records.data, meta: records.meta, edit: edit?.data ?? null, curricula, advisers, adviserQuery };
  }
  const records = await read(client.dosen.get({ query: filters }));
  const edit = editId ? await read(client.dosen({ id: editId }).get()) : null;
  if (!records.success || (edit && !edit.success)) error(503, apiMessage(null));
  return { ...common, kind, records: records.data, meta: records.meta, edit: edit?.data ?? null, curricula: null, advisers: null, adviserQuery };
}

export async function saveProfile(event: RequestEvent, kind: ProfileKind) {
  requireMasterAccess(event);
  const form = await event.request.formData();
  const values = Object.fromEntries(['mode', 'id', 'user_id', 'program_studi_id', 'kurikulum_id', 'dosen_pa_id', 'nim', 'nama', 'angkatan', 'status', 'kode_dosen', 'nidn', 'is_active'].map(key => [key, String(form.get(key) ?? '')]));
  const invalid = (message: string) => fail(400, { values, message });
  const mode = form.get('mode');
  if (mode !== 'save' && mode !== 'status') return invalid('Tindakan tidak valid.');
  const submitted = mode === 'status' ? {} : { values };
  const client = serverApi(event);
  let result;
  try {
    if (mode === 'status') {
      if (kind !== 'dosen' || !values.id || !['true', 'false'].includes(values.is_active!)) return invalid('Perubahan status tidak valid.');
      result = await client.dosen({ id: values.id }).patch({ is_active: values.is_active === 'true' });
    } else {
      if (!values.nama?.trim()) return invalid('Nama wajib diisi.');
      const common = { nama: values.nama, user_id: values.user_id?.trim() || null };
      if (kind === 'mahasiswa') {
        const selectedStatus = mahasiswaStatusValues.find(item => item === values.status);
        const angkatan = Number(values.angkatan);
        if (!selectedStatus) return invalid('Pilih status mahasiswa yang valid.');
        if (!Number.isInteger(angkatan) || angkatan < 1900 || angkatan > 9999) return invalid('Angkatan harus berupa tahun antara 1900 dan 9999.');
        if (!values.nim?.trim() || !values.program_studi_id || !values.kurikulum_id) return invalid('NIM, program studi, dan kurikulum wajib diisi.');
        const body = { ...common, nim: values.nim, program_studi_id: values.program_studi_id, kurikulum_id: values.kurikulum_id, dosen_pa_id: values.dosen_pa_id || null, angkatan, status: selectedStatus };
        result = values.id ? await client.mahasiswa({ id: values.id }).patch(body) : await client.mahasiswa.post(body);
      } else {
        if (!values.kode_dosen?.trim()) return invalid('Kode dosen wajib diisi.');
        const body = { ...common, kode_dosen: values.kode_dosen, nidn: values.nidn?.trim() || null, program_studi_id: values.program_studi_id || null };
        result = values.id ? await client.dosen({ id: values.id }).patch(body) : await client.dosen.post(body);
      }
    }
  } catch { return fail(503, { ...submitted, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { ...submitted, message: apiMessage(result.error?.value) });
  return { saved: true as const, message: 'Perubahan berhasil disimpan.' };
}
export type ProfileData = Awaited<ReturnType<typeof loadProfiles>>;
