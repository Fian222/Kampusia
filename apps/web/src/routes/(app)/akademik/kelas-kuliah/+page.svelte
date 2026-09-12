<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import AcademicOptions from '$lib/components/AcademicOptions.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  const box = 'mt-6 rounded-xl border border-slate-200 bg-white p-5';
  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
  const button = 'rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50';
  function href(changes: Record<string, string | number>) { const p = new URLSearchParams(page.url.searchParams); for (const [key, value] of Object.entries(changes)) { if (value === '') p.delete(key); else p.set(key, String(value)); } return '?' + p; }
  function options(rows: { id: string; kode: string; nama: string; isActive?: boolean }[], current: { id: string; kode: string; nama: string; isActive?: boolean } | undefined, restrict = true) {
    const all = current && !rows.some(row => row.id === current.id) ? [current, ...rows] : rows;
    return all.map(row => ({ value: row.id, label: `${row.kode} — ${row.nama}${restrict && !row.isActive ? ' (Nonaktif)' : ''}`, disabled: restrict && !row.isActive && row.id !== current?.id }));
  }
  const filters = $derived([
    { name: 'semester_id', label: 'Semester', value: data.filters.semester_id, rows: data.semesters.data },
    { name: 'program_studi_id', label: 'Program Studi', value: data.filters.program_studi_id, rows: data.programs.data },
    { name: 'mata_kuliah_id', label: 'Mata Kuliah', value: data.filters.mata_kuliah_id, rows: data.courses.data },
  ]);
</script>
<svelte:head><title>Kelas Kuliah · Kampusia</title></svelte:head>
<h1 class="text-3xl font-semibold">Kelas Kuliah</h1>
<p class="mt-2 text-sm text-slate-600">Kelola penawaran mata kuliah per semester dan dosen pengajar.</p>
<p class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Kelas baru dapat disimpan sebagai DRAFT. DIBUKA memerlukan kurikulum yang sesuai, dosen aktif, serta jadwal yang valid tanpa konflik. Pembukaan tersedia setelah validasi modul Jadwal siap.</p>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
{#if saving}<p role="status" class="mt-3">Menyimpan…</p>{/if}
<form method="GET" class={box + ' grid gap-4 sm:grid-cols-3'}>
  <label class="text-sm">Cari mata kuliah atau kelas<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  {#each filters as filter}<label class="text-sm">{filter.label}<select class={input} name={filter.name} value={filter.value ?? ''}><option value="">Semua</option>{#if filter.value && !filter.rows.some(row => row.id === filter.value)}<option value={filter.value}>Pilihan tersimpan</option>{/if}{#each filter.rows as row}<option value={row.id}>{row.kode} — {row.nama}</option>{/each}</select></label>{/each}
  <label class="text-sm">Status<select class={input} name="status" value={data.filters.status ?? ''}><option value="">Semua</option>{#each data.statuses as status}<option>{status}</option>{/each}</select></label>
  {#each [...page.url.searchParams].filter(([key]) => /^(semester|program|course)_(search|page)$/.test(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
  <div class="flex items-end gap-3"><button class={button}>Terapkan</button><a href={page.url.pathname}>Reset</a></div>
</form>
<section class={box}>
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Kelas Kuliah</h2><a class="text-teal-800" href={href({ edit: '' }) + '#kelas-form'}>Tambah Kelas</a></div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr>{#each ['Mata Kuliah', 'Kelas', 'Semester', 'Program Studi', 'Kapasitas', 'Status', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100"><td class="p-3">{row.mataKuliah.kode} — {row.mataKuliah.nama}</td><td class="p-3">{row.namaKelas}</td><td class="p-3">{row.semester.nama}</td><td class="p-3">{row.programStudi.nama}</td><td class="p-3">{row.kapasitas}</td><td class="p-3 font-medium">{row.status}</td><td class="p-3"><div class="flex gap-3"><a class="text-teal-800" href={`/akademik/kelas-kuliah/${row.id}`}>Detail / Dosen</a><a class="text-teal-800" href={href({ edit: row.id }) + '#kelas-form'}>Edit</a></div></td></tr>{:else}<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada kelas yang cocok.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<AcademicOptions prefix="semester_" label="Semester" meta={data.semesters.meta} />
<AcademicOptions prefix="program_" label="Program Studi" meta={data.programs.meta} />
<AcademicOptions prefix="course_" label="Mata Kuliah" meta={data.courses.meta} />
<section id="kelas-form" class={box}>
  <h2 class="font-semibold">{data.edit ? 'Edit' : 'Tambah'} Kelas Kuliah</h2>
  <p class="mt-2 text-sm text-slate-500">Pilihan KRS atau jadwal mengunci identitas akademik. Kapasitas tidak boleh di bawah jumlah mahasiswa pada KRS disetujui atau melebihi ruangan terjadwal. Pembatalan dengan pilihan aktif memerlukan alur KRS.</p>
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update }) => { try { await update({ reset: false }); } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values} fields={[
      { name: 'semester_id', label: 'Semester', value: data.edit?.semesterId, options: options(data.semesters.data, data.edit?.semester, false) },
      { name: 'program_studi_id', label: 'Program Studi', value: data.edit?.programStudiId, options: options(data.programs.data, data.edit?.programStudi) },
      { name: 'mata_kuliah_id', label: 'Mata Kuliah', value: data.edit?.mataKuliahId, options: options(data.courses.data, data.edit?.mataKuliah) },
      { name: 'nama_kelas', label: 'Nama Kelas', value: data.edit?.namaKelas, maxlength: 20 },
      { name: 'kapasitas', label: 'Kapasitas', type: 'number', min: 1, max: 2147483647, value: data.edit?.kapasitas },
      { name: 'status', label: 'Status', value: data.edit?.status ?? 'DRAFT', options: data.statuses.map(value => ({ value, label: value, disabled: value === 'DIBUKA' && data.edit?.status !== 'DIBUKA' })) },
    ]} />
    <div><button class={button} disabled={saving}>Simpan</button> {#if data.edit}<a href={href({ edit: '' })}>Batal edit</a>{/if}</div>
  </form>{/key}
</section>
