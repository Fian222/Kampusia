<script lang="ts">
  import SelectField from '$lib/components/ui/SelectField.svelte';
  import { enhance } from '$app/forms';
  import { finishConfirmation } from '$lib/form-feedback';
  import ReferenceLookup from './ReferenceLookup.svelte';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import { clearEditQueryHref, editQueryHref, modalNavigationOptions, resolveEditModalState } from '$lib/navigation/edit-modal';
  import type { MasterData } from '$lib/server/master-data';
  import Pagination from './Pagination.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  import ListPending from './ui/ListPending.svelte';
  import ReferenceCombobox from './ReferenceCombobox.svelte';

  let { data, form }: { data: MasterData; form: { message: string; saved?: true; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let requestedEditId = $state<string | null>(null);
  let confirmation = $state<{ id: string; nama: string; isActive: boolean } | null>(null);
  let confirmationOpen = $state(false);
  let confirmationError = $state<string | null>(null);
  const isProgram = $derived(data.kind === 'program-studi');
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = $derived(isProgram ? ['search', 'is_active', 'jenjang', 'fakultas_id'] : ['search', 'is_active']);
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const filterResetHref = $derived(resetQueryHref(page.url, filterKeys));
  const title = $derived(isProgram ? 'Program Studi' : 'Fakultas');
  const inputClass = 'control-base mt-1.5';
  const buttonClass = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
  const editFaculty = $derived(data.edit?.fakultas ?? null);
  const facultyOptions = $derived((data.faculties?.data ?? []).map(item => ({ value: item.id, label: item.nama, description: item.kode, disabled: !item.isActive && item.id !== editFaculty?.id })));
  const selectedFacultyOption = $derived(editFaculty ? { value: editFaculty.id, label: editFaculty.nama, description: editFaculty.kode, disabled: !editFaculty.isActive } : null);
  const queryEditId = $derived(page.url.searchParams.get('edit'));
  const saveFailed = $derived(form?.values?.mode === 'save' && !form.saved);
  const editModal = $derived(resolveEditModalState({
    queryEditId,
    requestedEditId,
    loadedEditId: data.edit?.id ?? null,
    createRequested: page.url.searchParams.get('modal') === 'create',
    saveFailed,
    failedEditId: saveFailed ? form?.values?.id || null : null,
  }));
  function href(changes: Record<string, string | number | null>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key); else params.set(key, String(value));
    }
    return '?' + params.toString();
  }
  function value(key: string, fallback: string) { return form?.values?.[key] ?? fallback; }
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  $effect(() => {
    const state = editModal;
    if (queryEditId && requestedEditId === queryEditId) requestedEditId = null;
    if (state.open) formOpen = true;
    else if (requestedEditId === null) formOpen = false;
  });
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`Master Data / ${title}`} {title} description="Kelola data akademik. Data nonaktif tetap tersimpan untuk menjaga riwayat.">
  {#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" href={href({ edit: null, modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah {title}</a>{/snippet}
</PageHeader>
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">{form.message}</p>{/if}

<section class="filter-panel mt-6" aria-label="Filter data">
  <form method="GET" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" use:seamlessFilter>
    <label class="text-sm font-medium">Cari kode atau nama<input class={inputClass} name="search" value={data.filters.search} maxlength="150" placeholder="Kode atau nama" /></label>
    <SelectField name="is_active" label="Status" value={data.filters.is_active ?? ''} options={[{ value: '', label: 'Semua status' }, { value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }]} />
    {#if isProgram}
      <SelectField name="jenjang" label="Jenjang" value={data.filters.jenjang ?? ''} options={[{ value: '', label: 'Semua jenjang' }, ...data.jenjangValues.map(item => ({ value: item, label: item }))]} />
      <ReferenceCombobox name="fakultas_id" label="Fakultas" value={data.filters.fakultas_id ?? ''} options={(data.faculties?.data ?? []).map(item => ({ value: item.id, label: item.nama, description: `${item.kode}${item.isActive ? '' : ' · Nonaktif'}` }))} selectedOption={data.filters.fakultas_id ? { value: data.filters.fakultas_id, label: 'Fakultas terpilih' } : null} meta={data.faculties!.meta} searchParam="faculty_search" pageParam="faculty_page" placeholder="Semua fakultas" nullable optionalIndicator={false} />
      <input type="hidden" name="faculty_search" value={data.facultyQuery.search} /><input type="hidden" name="faculty_page" value={data.facultyQuery.page} />
    {/if}
    <noscript><button class={buttonClass}>Terapkan filter</button></noscript>
    {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={filterResetHref} data-sveltekit-noscroll>Reset filter</a></div>{/if}
  </form>
</section>
{#if isProgram && data.faculties}<ReferenceLookup references={[{ label: 'Fakultas', prefix: 'faculty', meta: data.faculties.meta }]} />{/if}

<section class="surface-panel relative mt-6 overflow-hidden" aria-label={`Daftar ${title}`} aria-busy={listPending}>
  <ListPending />
  <div class="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 class="font-bold">Daftar {title}</h2></div>
  <div class="overflow-x-auto px-1 transition-opacity" class:opacity-80={listPending}>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 text-slate-500"><tr><th class="p-3">Kode</th><th class="p-3">Nama</th>{#if isProgram}<th class="p-3">Fakultas</th><th class="p-3">Jenjang</th>{/if}<th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead>
      <tbody>
        {#each data.records as row (row.id)}
          <tr class="border-b border-slate-100"><td class="p-3 font-medium">{row.kode}</td><td class="p-3">{row.nama}</td>
            {#if isProgram && row.fakultas}<td class="p-3">{row.fakultas.nama}{#if !row.fakultas.isActive}<span class="block text-xs text-slate-500">Fakultas nonaktif</span>{/if}</td><td class="p-3">{row.jenjang}</td>{/if}
            <td class="p-3"><StatusBadge active={row.isActive} /></td>
            <td class="p-3"><div class="flex gap-2"><a class="action-secondary" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a><button class="action-ghost" disabled={saving} onclick={() => { confirmation = row; confirmationError = null; confirmationOpen = true; }}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
          </tr>
        {:else}<tr><td colspan={isProgram ? 6 : 4} class="p-8 text-center text-slate-500">Tidak ada data yang cocok. Ubah filter atau tambahkan {title.toLowerCase()}.</td></tr>{/each}
      </tbody>
    </table>
  </div>
  <div class="px-5 pb-4 sm:px-6"><Pagination {...data.meta} href={number => href({ page: number })} /></div>
</section>

<Modal bind:open={confirmationOpen} title={`${confirmation?.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${confirmation?.nama ?? title}`} closeDisabled={saving} width="sm" onClose={() => { confirmation = null; confirmationError = null; }}>
  {#if confirmation}
    <p class="mt-2 text-sm">{confirmation.isActive ? 'Penonaktifan tidak menghapus data atau riwayat akademik. Data tidak tersedia untuk penugasan baru.' : 'Data akan tersedia kembali untuk penugasan baru.'}</p>
    {#if confirmationError}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{confirmationError}</p>{/if}
    <form method="POST" class="mt-4 flex flex-wrap gap-4" use:enhance={() => {
      saving = true;
      return async ({ update, result }) => { try { await finishConfirmation(result, update, () => confirmationOpen = false, message => confirmationError = message); } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={confirmation.id} /><input type="hidden" name="is_active" value={String(!confirmation.isActive)} />
      <button class={buttonClass} disabled={saving}>Ya, {confirmation.isActive ? 'nonaktifkan' : 'aktifkan'}</button><button type="button" class="text-sm" disabled={saving} onclick={() => confirmationOpen = false}>Batal</button>
    </form>
  {/if}
</Modal>

<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} ${title}`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : data.edit ? `Perbarui data ${data.edit.nama}.` : `Tambahkan ${title.toLowerCase()} baru.`} closeDisabled={saving} width={isProgram ? 'lg' : 'md'} onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="space-y-3" role="status" aria-label={`Menyiapkan formulir ${title.toLowerCase()}`}><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div></div>
  {:else}
  {#if data.edit}<p class="mt-2 text-sm text-slate-500">Status: {data.edit.isActive ? 'Aktif' : 'Nonaktif'}. Gunakan tindakan pada tabel untuk mengubah status.</p>{/if}
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
    <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => {
      saving = true;
      return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
      <label class="text-sm font-medium">Kode<input class={inputClass} name="kode" value={value('kode', data.edit?.kode ?? '')} required maxlength="20" pattern=".*\S.*" /><span class="mt-1 block text-xs font-normal text-slate-500">Unik; disimpan dalam huruf kapital.</span></label>
      <label class="text-sm font-medium">Nama<input class={inputClass} name="nama" value={value('nama', data.edit?.nama ?? '')} required maxlength="150" pattern=".*\S.*" /></label>
      {#if isProgram}
        <ReferenceCombobox name="fakultas_id" label="Fakultas" value={value('fakultas_id', editFaculty?.id ?? '')} options={facultyOptions} selectedOption={selectedFacultyOption} meta={data.faculties!.meta} searchParam="faculty_search" pageParam="faculty_page" placeholder="Pilih fakultas aktif" searchPlaceholder="Cari fakultas…" required error={saveFailed && !form?.values?.fakultas_id ? 'Fakultas wajib dipilih.' : undefined} />
        <SelectField name="jenjang" label="Jenjang" value={value('jenjang', data.edit?.jenjang ?? '')} required placeholder="Pilih jenjang" options={[...data.jenjangValues.map(item => ({ value: item, label: item }))]} />
        {#if data.edit}<p class="text-sm text-slate-500 sm:col-span-2">Perubahan fakultas merupakan koreksi administratif. Pastikan perubahan sesuai dengan riwayat akademik program studi.</p>{/if}
      {/if}
      <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={buttonClass} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
  {/key}
  {/if}
</Modal>
