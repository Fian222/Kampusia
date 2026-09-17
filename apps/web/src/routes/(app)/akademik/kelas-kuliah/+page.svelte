<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import { clearEditQueryHref, editQueryHref, modalNavigationOptions, resolveEditModalState } from '$lib/navigation/edit-modal';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import AcademicOptions from '$lib/components/AcademicOptions.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let requestedEditId = $state<string | null>(null);
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = ['search', 'semester_id', 'program_studi_id', 'mata_kuliah_id', 'status'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const queryEditId = $derived(page.url.searchParams.get('edit'));
  const saveFailed = $derived(form?.values?.mode === 'save' && !form.saved);
  const editModal = $derived(resolveEditModalState({ queryEditId, requestedEditId, loadedEditId: data.edit?.id ?? null, createRequested: page.url.searchParams.get('modal') === 'create', saveFailed, failedEditId: saveFailed ? form?.values?.id || null : null }));
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const input = 'control-base mt-1.5';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
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
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  $effect(() => { const state = editModal; if (queryEditId && requestedEditId === queryEditId) requestedEditId = null; if (state.open) formOpen = true; else if (requestedEditId === null) formOpen = false; });
</script>
<svelte:head><title>Kelas Kuliah · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Perkuliahan" title="Kelas Kuliah" description="Kelola penawaran mata kuliah, dosen pengajar, jadwal, pertemuan, dan penilaian.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={href({ edit: '', modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah Kelas</a>{/snippet}</PageHeader>
<p class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Kelas baru dapat disimpan sebagai DRAFT. DIBUKA memerlukan kurikulum yang sesuai, dosen aktif, serta jadwal yang valid tanpa konflik. Tambahkan dosen dan jadwal melalui detail kelas sebelum membuka kelas.</p>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<form method="GET" class={box + ' grid gap-4 sm:grid-cols-3'} use:seamlessFilter>
  <label class="text-sm">Cari mata kuliah atau kelas<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  {#each filters as filter}<label class="text-sm">{filter.label}<select class={input} name={filter.name} value={filter.value ?? ''}><option value="">Semua</option>{#if filter.value && !filter.rows.some(row => row.id === filter.value)}<option value={filter.value}>Pilihan tersimpan</option>{/if}{#each filter.rows as row}<option value={row.id}>{row.kode} — {row.nama}</option>{/each}</select></label>{/each}
  <label class="text-sm">Status<select class={input} name="status" value={data.filters.status ?? ''}><option value="">Semua</option>{#each data.statuses as status}<option>{status}</option>{/each}</select></label>
  {#each [...page.url.searchParams].filter(([key]) => /^(semester|program|course)_(search|page)$/.test(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
  <noscript><button class={button}>Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, filterKeys)} data-sveltekit-noscroll>Reset filter</a></div>{/if}
</form>
<section class={`${box} relative`} aria-busy={listPending}>
  <ListPending />
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Kelas Kuliah</h2></div>
  <div class="mt-4 overflow-x-auto transition-opacity" class:opacity-80={listPending}><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr>{#each ['Mata Kuliah', 'Kelas', 'Semester', 'Program Studi', 'Kapasitas', 'Status', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100"><td class="p-3"><span class="font-mono text-xs text-slate-500">{row.mataKuliah.kode}</span><p class="font-semibold text-slate-900">{row.mataKuliah.nama}</p></td><td class="p-3">{row.namaKelas}</td><td class="p-3">{row.semester.nama}</td><td class="p-3">{row.programStudi.nama}</td><td class="p-3">{row.kapasitas}</td><td class="p-3"><Badge tone={row.status === 'DIBUKA' ? 'success' : row.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{row.status}</Badge></td><td class="p-3"><div class="flex gap-3"><a class="font-semibold text-brand-700" href={`/akademik/kelas-kuliah/${row.id}`}>Detail</a><a class="font-semibold text-brand-700" aria-label={`Edit kelas ${row.mataKuliah.nama} ${row.namaKelas}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a></div></td></tr>{:else}<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada kelas yang cocok.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} Kelas Kuliah`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : undefined} closeDisabled={saving} width="lg" onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600" role="status">Memuat data kelas kuliah…</div>
  {:else}
  <p class="mt-2 text-sm text-slate-500">Pilihan KRS atau jadwal mengunci identitas akademik. Kapasitas tidak boleh di bawah jumlah mahasiswa pada KRS disetujui atau melebihi ruangan terjadwal. Pembatalan dengan pilihan aktif memerlukan alur KRS.</p>
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <div class="mt-4 grid gap-3">
    <AcademicOptions prefix="semester_" label="Semester" meta={data.semesters.meta} />
    <AcademicOptions prefix="program_" label="Program Studi" meta={data.programs.meta} />
    <AcademicOptions prefix="course_" label="Mata Kuliah" meta={data.courses.meta} />
  </div>
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values} fields={[
      { name: 'semester_id', label: 'Semester', value: data.edit?.semesterId, options: options(data.semesters.data, data.edit?.semester, false) },
      { name: 'program_studi_id', label: 'Program Studi', value: data.edit?.programStudiId, options: options(data.programs.data, data.edit?.programStudi) },
      { name: 'mata_kuliah_id', label: 'Mata Kuliah', value: data.edit?.mataKuliahId, options: options(data.courses.data, data.edit?.mataKuliah) },
      { name: 'nama_kelas', label: 'Nama Kelas', value: data.edit?.namaKelas, maxlength: 20 },
      { name: 'kapasitas', label: 'Kapasitas', type: 'number', min: 1, max: 2147483647, value: data.edit?.kapasitas },
      { name: 'status', label: 'Status', value: data.edit?.status ?? 'DRAFT', options: data.statuses.map(value => ({ value, label: value, disabled: value === 'DIBUKA' && data.edit?.status !== 'DIBUKA' })) },
    ]} />
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>{/key}
  {/if}
</Modal>
