<script lang="ts">
  import SelectField from '$lib/components/ui/SelectField.svelte';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import { clearEditQueryHref, editQueryHref, modalNavigationOptions, resolveEditModalState } from '$lib/navigation/edit-modal';
  import ReferenceLookup from '$lib/components/ReferenceLookup.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import ReferenceCombobox from '$lib/components/ReferenceCombobox.svelte';
  import KelasForm from '$lib/components/KelasForm.svelte';
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
  const filters = $derived([
    { name: 'semester_id', label: 'Semester', value: data.filters.semester_id, rows: data.semesters.data, meta: data.semesters.meta, prefix: 'semester' },
    { name: 'program_studi_id', label: 'Program Studi', value: data.filters.program_studi_id, rows: data.programs.data, meta: data.programs.meta, prefix: 'program' },
    { name: 'mata_kuliah_id', label: 'Mata Kuliah', value: data.filters.mata_kuliah_id, rows: data.courses.data, meta: data.courses.meta, prefix: 'course' },
  ]);
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  $effect(() => { const state = editModal; if (queryEditId && requestedEditId === queryEditId) requestedEditId = null; if (state.open) formOpen = true; else if (requestedEditId === null) formOpen = false; });
</script>
<svelte:head><title>Kelas Kuliah · Kampusia</title></svelte:head>
<PageHeader eyebrow="Perkuliahan" title="Kelas Kuliah" description="Kelola penawaran mata kuliah, dosen pengajar, jadwal, pertemuan, dan penilaian.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={href({ edit: '', modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah Kelas</a>{/snippet}</PageHeader>
<p class="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600"><Icon name="info" size={17} class="mt-0.5 shrink-0 text-amber-600" /> Kelas dibuka setelah dosen, kurikulum, dan jadwalnya siap. Lengkapi semuanya dari ruang kerja kelas.</p>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<form method="GET" class="filter-panel mt-6 grid gap-4 sm:grid-cols-3" use:seamlessFilter>
  <label class="text-sm">Cari mata kuliah atau kelas<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  {#each filters as filter}<ReferenceCombobox name={filter.name} label={filter.label} value={filter.value ?? ''} options={filter.rows.map(row => ({ value: row.id, label: row.nama, description: row.kode }))} selectedOption={filter.value ? { value: filter.value, label: `${filter.label} terpilih` } : null} meta={filter.meta} searchParam={`${filter.prefix}_search`} pageParam={`${filter.prefix}_page`} placeholder={`Semua ${filter.label.toLowerCase()}`} nullable optionalIndicator={false} />{/each}
  <SelectField name="status" label="Status" value={data.filters.status ?? ''} options={[{ value: '', label: 'Semua' }, ...data.statuses.map(status => ({ value: status, label: status }))]} />
  {#each [...page.url.searchParams].filter(([key]) => /^(semester|program|course)_(search|page)$/.test(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
  <noscript><button class={button}>Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, filterKeys)} data-sveltekit-noscroll>Reset filter</a></div>{/if}
</form>
<ReferenceLookup references={[{ label: 'Semester', prefix: 'semester', meta: data.semesters.meta }, { label: 'Program Studi', prefix: 'program', meta: data.programs.meta }, { label: 'Mata Kuliah', prefix: 'course', meta: data.courses.meta }]} />
<section class={`${box} relative`} aria-busy={listPending}>
  <ListPending />
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Kelas Kuliah</h2></div>
  <div class="mt-4 overflow-x-auto transition-opacity" class:opacity-80={listPending}><table class="w-full min-w-[960px] text-left text-sm"><thead class="border-b text-slate-500"><tr>{#each ['Mata kuliah', 'Kelas', 'Semester & program', 'Pengajar', 'Kapasitas', 'Status', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100"><td class="p-3"><span class="font-mono text-xs text-slate-500">{row.mataKuliah.kode}</span><p class="font-semibold text-slate-900">{row.mataKuliah.nama}</p></td><td class="p-3"><p class="whitespace-nowrap font-semibold">Kelas {row.namaKelas}</p><p class="mt-1 text-xs text-slate-500">{row.mataKuliah.sks} SKS</p></td><td class="p-3"><p>{row.semester.nama}</p><p class="mt-1 text-xs text-slate-500">{row.programStudi.nama}</p></td><td class="p-3"><p>{row.dosen?.map(item => item.dosen.nama).join(', ') || 'Belum ditugaskan'}</p></td><td class="whitespace-nowrap p-3">{row.kapasitas} kursi</td><td class="p-3"><Badge tone={row.status === 'DIBUKA' ? 'success' : row.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{row.status}</Badge></td><td class="p-3"><div class="flex gap-2 whitespace-nowrap"><a class="action-primary" href={`/akademik/kelas-kuliah/${row.id}`}>Buka kelas</a><a class="action-secondary" aria-label={`Edit kelas ${row.mataKuliah.nama} ${row.namaKelas}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a></div></td></tr>{:else}<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada kelas yang cocok.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} Kelas Kuliah`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : undefined} closeDisabled={saving} width="lg" onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="space-y-3" role="status" aria-label="Menyiapkan formulir kelas"><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div></div>
  {:else}
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
  <KelasForm edit={data.edit} values={form?.values} semesters={data.semesters} programs={data.programs} courses={data.courses} statuses={data.statuses} {saving} onCancel={() => formOpen = false} submit={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } }; }} />
  {/key}
  {/if}
</Modal>
