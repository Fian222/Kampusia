import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { apiMessage, integer, requireMasterAccess } from './master-data';
function studentAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'MAHASISWA') error(403, 'Akses khusus mahasiswa.');
}
function resultError(status: number, value: unknown): never {
  if (status === 401) redirect(303, '/login');
  error(status >= 400 && status < 500 ? status : 503, apiMessage(value));
}
export async function loadStudentKrs(event: RequestEvent) {
  studentAccess(event); const client = serverApi(event).mahasiswa.me.krs; const params = event.url.searchParams;
  const history = await client.get({ query: { page: integer(params.get('history_page'), 1, 1000000), limit: 20 } }).catch(() => error(503, apiMessage(null)));
  if (history.error || !history.data?.success) resultError(history.status, history.error?.value);
  const semesterId = params.get('semester_id') || history.data.activeSemester?.id;
  const term = semesterId ? await client({ id: semesterId }).get().catch(() => error(503, apiMessage(null))) : null;
  if (term && (term.error || !term.data?.success)) resultError(term.status, term.error?.value);
  const selected = term?.data?.success ? term.data.data : null;
  const query = { page: integer(params.get('page'), 1, 1000000), limit: 20, search: params.get('search') ?? '' };
  const canBrowse = semesterId && selected?.semester.isActive && (!selected.krs || selected.krs.status === 'DRAFT');
  const available = canBrowse
    ? await client({ id: semesterId }).kelas.get({ query }).catch(() => null) : null;
  return { history: history.data, selected, available: available?.data?.success ? available.data : null, availabilityMessage: canBrowse && (!available || available.error) ? apiMessage(available?.error?.value) : null, query };
}
export async function loadKrsList(event: RequestEvent) {
  requireMasterAccess(event); const client = serverApi(event); const p = event.url.searchParams;
  const status = p.get('status') || undefined;
  const statuses = ['DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN'] as const;
  const selectedStatus = statuses.find(item => item === status);
  if (status && !selectedStatus) error(400, 'Status KRS tidak valid.');
  const query = { page: integer(p.get('page'), 1, 1000000), limit: 20, search: p.get('search') ?? '', semester_id: p.get('semester_id') || undefined, program_studi_id: p.get('program_studi_id') || undefined, status: selectedStatus };
  const [list, terms, programs] = await Promise.all([
    client.krs.get({ query }),
    client.semester.get({ query: { search: p.get('term_search') ?? '', page: integer(p.get('term_page'), 1, 1000000), limit: 20 } }),
    client['program-studi'].get({ query: { search: p.get('program_search') ?? '', page: integer(p.get('program_page'), 1, 1000000), limit: 20 } }),
  ]).catch(() => error(503, apiMessage(null)));
  if (list.error || !list.data?.success) resultError(list.status, list.error?.value);
  if (terms.error || !terms.data?.success) resultError(terms.status, terms.error?.value);
  if (programs.error || !programs.data?.success) resultError(programs.status, programs.error?.value);
  return { records: list.data, terms: terms.data, programs: programs.data, query, statuses };
}
export async function loadKrsDetail(event: RequestEvent) {
  requireMasterAccess(event);
  const result = await serverApi(event).krs({ id: event.params.id! }).get().catch(() => error(503, apiMessage(null)));
  if (result.error || !result.data?.success) resultError(result.status, result.error?.value);
  return { krs: result.data.data };
}
export type KrsDetailData = Awaited<ReturnType<typeof loadKrsDetail>>['krs'];
export async function saveKrs(event: RequestEvent, admin = false) {
  if (admin) requireMasterAccess(event); else studentAccess(event);
  const form = await event.request.formData();
  const mode = String(form.get('mode') ?? ''); const id = admin ? event.params.id! : String(form.get('id') ?? '');
  if (['submit', 'approve', 'reject', 'cancel', 'reopen'].includes(mode) && form.get('confirmed') !== 'yes') return fail(400, { message: 'Konfirmasikan perubahan status terlebih dahulu.' });
  const client = serverApi(event); let result;
  if (!admin && mode === 'create') {
    let creation;
    try { creation = await client.mahasiswa.me.krs({ id }).post({}); }
    catch { return fail(503, { message: apiMessage(null) }); }
    if (creation.status === 401) redirect(303, '/login');
    if (creation.error || !creation.data?.success) return fail(creation.status >= 400 && creation.status < 500 ? creation.status : 503, { message: apiMessage(creation.error?.value) });
    const created = creation.data.data;
    if (created.batasSksSource === 'PREVIOUS_IPS') return { saved: true, message: `KRS dibuat dengan batas ${created.batasSks} SKS berdasarkan IPS ${created.previousIps} dari ${created.previousSemester?.nama ?? 'semester sebelumnya'}.` };
    if (created.batasSksSource === 'INITIAL_FALLBACK') return { saved: true, message: `KRS dibuat dengan batas awal ${created.batasSks} SKS karena belum tersedia IPS semester sebelumnya yang lengkap.` };
    return { saved: true, message: 'DRAFT KRS yang sudah ada digunakan kembali dengan batas SKS tersimpan.' };
  }
  try {
    if (admin) {
      const api = client.krs({ id });
      if (mode === 'approve') result = await api.approve.post({});
      else if (mode === 'reject') result = await api.reject.post({});
      else if (mode === 'cancel') result = await api.cancel.post({});
      else if (mode === 'reopen') result = await api.reopen.post({});
      else return fail(400, { message: 'Tindakan tidak valid.' });
    } else {
      const api = client.mahasiswa.me.krs({ id });
      if (mode === 'add') result = await api.kelas.post({ kelas_kuliah_id: String(form.get('kelas_id') ?? '') });
      else if (mode === 'remove') result = await api.kelas({ detailId: String(form.get('detail_id') ?? '') }).delete();
      else if (mode === 'submit') result = await api.submit.post({});
      else if (mode === 'reopen') result = await api.reopen.post({});
      else return fail(400, { message: 'Tindakan tidak valid.' });
    }
  } catch { return fail(503, { message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { message: apiMessage(result.error?.value) });
  return { saved: true, message: 'KRS berhasil diperbarui.' };
}
