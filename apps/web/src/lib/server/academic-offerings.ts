import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { requireMasterAccess, apiMessage, integer, active } from './master-data';

async function read<T>(request: Promise<{ data: T | null; error: unknown; status: number }>): Promise<NonNullable<T>> {
  const result = await request.catch(() => error(503, apiMessage(null)));
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data) error(result.status >= 400 && result.status < 500 ? result.status : 503, apiMessage(result.error && typeof result.error === 'object' && 'value' in result.error ? result.error.value : null));
  return result.data;
}
function enumFilter<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  if (!value) return undefined;
  const found = values.find(item => item === value);
  if (!found) error(400, 'Filter tidak valid.');
  return found;
}
export const statuses = ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'] as const;
function query(event: RequestEvent, prefix = '') {
  return { page: integer(event.url.searchParams.get(prefix + 'page'), 1, 1000000), limit: 20, search: event.url.searchParams.get(prefix + 'search') ?? '' };
}
export async function loadSemester(event: RequestEvent) {
  requireMasterAccess(event);
  const client = serverApi(event); const p = event.url.searchParams;
  const filters = { ...query(event), jenis: enumFilter(p.get('jenis'), ['GANJIL', 'GENAP'] as const), tahun_mulai: p.get('tahun_mulai') ? integer(p.get('tahun_mulai'), 1900, 9998) : undefined, is_active: active(p.get('is_active')) };
  const records = await read(client.semester.get({ query: filters }));
  const edit = p.get('edit') ? (await read(client.semester({ id: p.get('edit')! }).get())).data : null;
  return { records, filters, edit };
}
export async function loadKelas(event: RequestEvent) {
  requireMasterAccess(event);
  const client = serverApi(event); const p = event.url.searchParams;
  const filters = { ...query(event), semester_id: p.get('semester_id') || undefined, program_studi_id: p.get('program_studi_id') || undefined, mata_kuliah_id: p.get('mata_kuliah_id') || undefined, status: enumFilter(p.get('status'), statuses) };
  const [records, semesters, programs, courses] = await Promise.all([
    read(client['kelas-kuliah'].get({ query: filters })), read(client.semester.get({ query: query(event, 'semester_') })),
    read(client['program-studi'].get({ query: query(event, 'program_') })), read(client['mata-kuliah'].get({ query: query(event, 'course_') })),
  ]);
  const edit = p.get('edit') ? (await read(client['kelas-kuliah']({ id: p.get('edit')! }).get())).data : null;
  return { records, filters, edit, semesters, programs, courses, statuses };
}
export async function loadKelasDetail(event: RequestEvent) {
  requireMasterAccess(event); const client = serverApi(event); const id = event.params.id!;
  const [kelas, assignments, lecturers] = await Promise.all([
    read(client['kelas-kuliah']({ id }).get()), read(client['kelas-kuliah']({ id }).dosen.get({ query: query(event) })),
    read(client.dosen.get({ query: { ...query(event, 'lecturer_'), is_active: 'true' } })),
  ]);
  return { kelas: kelas.data, assignments, lecturers };
}
export async function saveOffering(event: RequestEvent, kind: 'semester' | 'kelas' | 'dosen') {
  requireMasterAccess(event);
  const form = await event.request.formData();
  const values: Record<string, string> = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const client = serverApi(event);
  const invalid = (message: string) => fail(400, { values, message });
  let result;
  try {
    if (kind === 'semester') {
      if (values.mode === 'activate') {
        if (!values.id || values.confirm !== 'yes') return invalid('Konfirmasikan penggantian semester aktif.');
        result = await client.semester({ id: values.id }).patch({ is_active: true });
      } else if (values.mode === 'save') {
        const jenis = ['GANJIL', 'GENAP'].find((item): item is 'GANJIL' | 'GENAP' => item === values.jenis);
        if (!jenis) return invalid('Pilih jenis semester.');
        const body = { kode: values.kode!, nama: values.nama!, tahun_mulai: Number(values.tahun_mulai), jenis, tanggal_mulai: values.tanggal_mulai!, tanggal_selesai: values.tanggal_selesai! };
        result = values.id ? await client.semester({ id: values.id }).patch(body) : await client.semester.post(body);
      } else return invalid('Tindakan tidak valid.');
    } else if (kind === 'kelas') {
      if (values.mode !== 'save') return invalid('Tindakan tidak valid.');
      const status = statuses.find(item => item === values.status);
      if (!status) return invalid('Pilih status kelas.');
      const body = { semester_id: values.semester_id!, mata_kuliah_id: values.mata_kuliah_id!, program_studi_id: values.program_studi_id!, nama_kelas: values.nama_kelas!, kapasitas: Number(values.kapasitas), status };
      result = values.id ? await client['kelas-kuliah']({ id: values.id }).patch(body) : await client['kelas-kuliah'].post(body);
    } else {
      const endpoint = client['kelas-kuliah']({ id: event.params.id! }).dosen;
      if (values.mode === 'remove') {
        if (values.confirm !== 'yes') return invalid('Konfirmasikan penghapusan penugasan.');
        result = await endpoint({ assignmentId: values.assignment_id! }).delete();
      } else {
        if (!['true', 'false'].includes(values.is_koordinator!)) return invalid('Status koordinator tidak valid.');
        const body = { is_koordinator: values.is_koordinator === 'true' };
        if (values.mode === 'add') result = await endpoint.post({ ...body, dosen_id: values.dosen_id! });
        else if (values.mode === 'update') result = await endpoint({ assignmentId: values.assignment_id! }).patch(body);
        else return invalid('Tindakan tidak valid.');
      }
    }
  } catch { return fail(503, { values, message: apiMessage(null) }); }
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error?.value) });
  return { saved: true as const, message: 'Perubahan berhasil disimpan.' };
}
