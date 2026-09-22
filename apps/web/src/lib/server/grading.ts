import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { serverApi } from './api';
import { apiMessage, requireMasterAccess } from './master-data';
import { read } from './academic-offerings';

function lecturerAccess(event: RequestEvent) {
  if (!event.locals.user) redirect(303, '/login');
  if (event.locals.user.role !== 'DOSEN') error(403, 'Akses khusus dosen.');
}
function access(event: RequestEvent, admin: boolean) { if (admin) requireMasterAccess(event); else lecturerAccess(event); }
export async function loadGrading(event: RequestEvent, admin: boolean) {
  access(event, admin);
  const response = await read(serverApi(event)['kelas-kuliah']({ id: event.params.id! }).nilai.get());
  return response.data;
}
function decimal(value: string, label: string, nullable = false) {
  const normalized = value.trim();
  if (nullable && !normalized) return null;
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(normalized)) throw new Error(`${label} harus berupa angka 0–100 dengan maksimal dua desimal.`);
  return normalized;
}
async function response(result: { status: number; error: unknown; data: { success: boolean } | null }, values: Record<string, string>, message: string) {
  if (result.status === 401) redirect(303, '/login');
  if (result.error || !result.data?.success) return fail(result.status >= 400 && result.status < 500 ? result.status : 503, { values, message: apiMessage(result.error && typeof result.error === 'object' && 'value' in result.error ? result.error.value : null) });
  return { saved: true as const, message };
}
export async function saveGrading(event: RequestEvent, admin: boolean) {
  access(event, admin);
  const form = await event.request.formData();
  const values: Record<string, string> = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const client = serverApi(event); const classId = event.params.id!; const base = client['kelas-kuliah']({ id: classId });
  try {
    if (admin && values.mode !== 'correct') return fail(403, { values, message: 'Penilaian biasa dilakukan oleh Dosen pengajar. ADMIN/AKADEMIK hanya melakukan pengawasan dan koreksi terkontrol.' });
    if (values.mode === 'component-create') {
      return response(await base['komponen-nilai'].post({ nama: values.nama!, bobot: decimal(values.bobot!, 'Bobot')!, urutan: Number(values.urutan), is_active: values.is_active !== 'false' }), values, 'Komponen nilai ditambahkan.');
    }
    if (values.mode === 'component-update') {
      return response(await base['komponen-nilai']({ componentId: values.component_id! }).patch({ nama: values.nama!, bobot: decimal(values.bobot!, 'Bobot')!, urutan: Number(values.urutan), is_active: values.is_active === 'true' }), values, 'Komponen nilai diperbarui.');
    }
    if (values.mode === 'component-delete') {
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan penghapusan komponen.' });
      return response(await base['komponen-nilai']({ componentId: values.component_id! }).delete(), values, 'Komponen nilai dihapus.');
    }
    if (values.mode === 'score-save') {
      return response(await base.nilai({ componentId: values.component_id! }).mahasiswa({ mahasiswaId: values.mahasiswa_id! }).put({ nilai: decimal(values.nilai ?? '', 'Nilai', true) }), values, values.nilai?.trim() ? 'Nilai disimpan.' : 'Nilai dikosongkan dan tetap berstatus belum dinilai.');
    }
    if (values.mode === 'finalize') {
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan finalisasi nilai kelas.' });
      return response(await base.nilai.finalize.post({}), values, 'Nilai kelas berhasil difinalisasi.');
    }
    if (values.mode === 'correct') {
      if (!admin) return fail(403, { values, message: 'Koreksi pascafinalisasi hanya untuk ADMIN/AKADEMIK.' });
      if (values.confirm !== 'yes') return fail(400, { values, message: 'Konfirmasikan koreksi nilai resmi.' });
      return response(await base.nilai.corrections({ mahasiswaId: values.mahasiswa_id! }).post({ component_id: values.component_id!, nilai: decimal(values.nilai!, 'Nilai')!, alasan: values.alasan! }), values, 'Nilai resmi dikoreksi dan hasil studi dihitung ulang.');
    }
    return fail(400, { values, message: 'Tindakan penilaian tidak valid.' });
  } catch (cause) {
    return fail(400, { values, message: cause instanceof Error ? cause.message : apiMessage(null) });
  }
}
