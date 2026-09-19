import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { apiMessage, integer, requireMasterAccess } from './master-data';
import { read } from './academic-offerings';

function lecturerAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'DOSEN') error(403, 'Akses khusus dosen.');
}
function studentAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'MAHASISWA') error(403, 'Akses khusus mahasiswa.');
}
export function meetingQuery(event: RequestEvent) {
  return { page: integer(event.url.searchParams.get('meeting_page'), 1, 1000000), limit: 20 };
}
export async function loadLecturerClasses(event: RequestEvent) {
  lecturerAccess(event); const p = event.url.searchParams;
  const statuses = ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'] as const;
  const status = statuses.find(item => item === p.get('status'));
  if (p.get('status') && !status) error(400, 'Status kelas tidak valid.');
  const query = { page: integer(p.get('page'), 1, 1000000), limit: 20, search: p.get('search') ?? '', semester_id: p.get('semester_id') || undefined, status };
  const records = await read(serverApi(event).dosen.me['kelas-kuliah'].get({ query }));
  return { records, query, statuses };
}
export async function loadLecturerClass(event: RequestEvent) {
  lecturerAccess(event); const client = serverApi(event); const id = event.params.id!;
  const [kelas, meetings] = await Promise.all([
    read(client.dosen.me['kelas-kuliah']({ id }).get()),
    read(client['kelas-kuliah']({ id }).pertemuan.get({ query: meetingQuery(event) })),
  ]);
  return { kelas: kelas.data, meetings };
}
export async function loadAttendance(event: RequestEvent, admin: boolean) {
  if (admin) requireMasterAccess(event); else lecturerAccess(event);
  const result = await read(serverApi(event).pertemuan({ id: event.params.id! }).absensi.get());
  return { roster: result.data, area: admin ? 'akademik' as const : 'dosen' as const };
}
export async function loadStudentAttendance(event: RequestEvent) {
  studentAccess(event); const p = event.url.searchParams;
  const records = await read(serverApi(event).mahasiswa.me.absensi.get({ query: { page: integer(p.get('page'), 1, 1000000), limit: 20, search: '' } }));
  const summary = records.data.reduce((totals, row) => ({ ...totals, [row.status]: totals[row.status] + 1 }), { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 });
  return { records, summary };
}
function status(value: string) {
  const found = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'].find((item): item is 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA' => item === value);
  if (!found) throw new Error('Status absensi tidak valid.');
  return found;
}
async function respond(result: { status: number; error: unknown; data: { success: boolean } | null }, values?: Record<string, string>) {
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error && typeof result.error === 'object' && 'value' in result.error ? result.error.value : null) });
  return { saved: true as const, message: 'Perubahan berhasil disimpan.' };
}
export async function saveMeeting(event: RequestEvent) {
  requireMasterAccess(event);
  const form = await event.request.formData(); const values: Record<string, string> = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const client = serverApi(event); const classId = event.params.id!; let result;
  try {
    if (values.mode === 'meeting-save') {
      const body = { nomor_pertemuan: Number(values.nomor_pertemuan), tanggal: values.tanggal!, jam_mulai: values.jam_mulai!, jam_selesai: values.jam_selesai!, materi: values.materi?.trim() || null };
      result = values.pertemuan_id
        ? await client.pertemuan({ id: values.pertemuan_id }).patch(values.koreksi === 'yes' ? { tanggal: body.tanggal, jam_mulai: body.jam_mulai, jam_selesai: body.jam_selesai, materi: body.materi, koreksi: true } : body)
        : await client['kelas-kuliah']({ id: classId }).pertemuan.post(body);
    } else if (values.mode === 'meeting-cancel') {
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan pembatalan pertemuan.' });
      result = await client.pertemuan({ id: values.pertemuan_id! }).cancel.post({});
    } else if (values.mode === 'meeting-complete') {
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan penyelesaian absensi.' });
      result = await client.pertemuan({ id: values.pertemuan_id! }).complete.post({});
    } else return fail(400, { values, message: 'Tindakan pertemuan tidak valid.' });
  } catch { return fail(503, { values, message: apiMessage(null) }); }
  return respond(result, values);
}
export async function saveAttendance(event: RequestEvent, admin: boolean) {
  if (admin) requireMasterAccess(event); else lecturerAccess(event);
  const form = await event.request.formData(); const values: Record<string, string> = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const client = serverApi(event); let result;
  try {
    if (values.mode === 'complete') {
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan penyelesaian absensi.' });
      result = await client.pertemuan({ id: event.params.id! }).complete.post({});
    } else {
      const body = { status: status(values.status!), keterangan: values.keterangan?.trim() || null };
      const endpoint = client.pertemuan({ id: event.params.id! }).absensi({ mahasiswaId: values.mahasiswa_id! });
      result = values.mode === 'correct' ? await endpoint.patch(body) : await endpoint.put({ ...body, koreksi_terlambat: values.koreksi_terlambat === 'yes' });
    }
  } catch (cause) { return fail(400, { values, message: cause instanceof Error && cause.message.includes('Status') ? cause.message : apiMessage(null) }); }
  return respond(result, values);
}
