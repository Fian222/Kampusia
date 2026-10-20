<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { loadKelas } from '$lib/server/academic-offerings';
  import AcademicFields from './AcademicFields.svelte';
  import ReferenceCombobox from './ReferenceCombobox.svelte';
  type Options = Awaited<ReturnType<typeof loadKelas>>;
  let { action, edit, values, semesters, programs, courses, statuses, saving, submit, onCancel }: {
    action?: string; edit: Options['edit']; values?: Record<string, string>;
    semesters: Options['semesters']; programs: Options['programs']; courses: Options['courses']; statuses: Options['statuses'];
    saving: boolean; submit: SubmitFunction; onCancel: () => void;
  } = $props();
  const semesterOptions = $derived(semesters.data.map(row => ({ value: row.id, label: row.nama, description: row.kode })));
  const programOptions = $derived(programs.data.map(row => ({ value: row.id, label: row.nama, description: row.kode, disabled: !row.isActive && row.id !== edit?.programStudiId })));
  const courseOptions = $derived(courses.data.map(row => ({ value: row.id, label: row.nama, description: `${row.kode} · ${row.sks} SKS`, disabled: !row.isActive && row.id !== edit?.mataKuliahId })));
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
</script>

<p class="mt-2 text-sm text-slate-500">Pilihan KRS atau jadwal mengunci identitas akademik. Kapasitas tidak boleh di bawah jumlah mahasiswa pada KRS disetujui atau melebihi ruangan terjadwal. Pembatalan dengan pilihan aktif memerlukan alur KRS.</p>
<form method="POST" {action} class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
  <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={edit?.id ?? ''} />
  <ReferenceCombobox name="semester_id" label="Semester" value={values?.semester_id ?? edit?.semesterId ?? ''} options={semesterOptions} selectedOption={edit?.semester ? { value: edit.semester.id, label: edit.semester.nama, description: edit.semester.kode } : null} meta={semesters.meta} searchParam="semester_search" pageParam="semester_page" placeholder="Pilih semester" searchPlaceholder="Cari semester…" required />
  <ReferenceCombobox name="program_studi_id" label="Program Studi" value={values?.program_studi_id ?? edit?.programStudiId ?? ''} options={programOptions} selectedOption={edit?.programStudi ? { value: edit.programStudi.id, label: edit.programStudi.nama, description: edit.programStudi.kode, disabled: !edit.programStudi.isActive } : null} meta={programs.meta} searchParam="program_search" pageParam="program_page" placeholder="Pilih program studi" searchPlaceholder="Cari program studi…" required />
  <ReferenceCombobox name="mata_kuliah_id" label="Mata Kuliah" value={values?.mata_kuliah_id ?? edit?.mataKuliahId ?? ''} options={courseOptions} selectedOption={edit?.mataKuliah ? { value: edit.mataKuliah.id, label: edit.mataKuliah.nama, description: `${edit.mataKuliah.kode} · ${edit.mataKuliah.sks} SKS`, disabled: !edit.mataKuliah.isActive } : null} meta={courses.meta} searchParam="course_search" pageParam="course_page" placeholder="Pilih mata kuliah" searchPlaceholder="Cari mata kuliah…" required />
  <AcademicFields {values} fields={[
    { name: 'nama_kelas', label: 'Nama Kelas', value: edit?.namaKelas, maxlength: 20 },
    { name: 'kapasitas', label: 'Kapasitas', type: 'number', min: 1, max: 2147483647, value: edit?.kapasitas },
    { name: 'status', label: 'Status', value: edit?.status ?? 'DRAFT', options: statuses.map(value => ({ value, label: value, disabled: value === 'DIBUKA' && edit?.status !== 'DIBUKA' })) },
  ]} />
  <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={onCancel}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
</form>
