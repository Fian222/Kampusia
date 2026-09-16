<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import type { CatalogData } from '$lib/server/course-catalog';
  import Pagination from './Pagination.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  import ListPending from './ui/ListPending.svelte';
  import AcademicOptions from './AcademicOptions.svelte';

  let { data, form }: { data: CatalogData; form: { message: string; saved?: true; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let openedEditId = $state<string>();
  let confirmation = $state<{ id: string; nama: string; isActive: boolean } | null>(null);
  let confirmationDialog: HTMLDialogElement;
  $effect(() => {
    if (confirmation && !confirmationDialog.open) confirmationDialog.showModal();
    else if (!confirmation && confirmationDialog.open) confirmationDialog.close();
  });
  const isCurriculum = $derived(data.kind === 'kurikulum');
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = $derived(isCurriculum ? ['search', 'is_active', 'tahun_berlaku', 'program_studi_id'] : ['search', 'is_active']);
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const filterResetHref = $derived(resetQueryHref(page.url, filterKeys));
  const title = $derived(isCurriculum ? 'Kurikulum' : 'Mata Kuliah');
  const inputClass = 'control-base mt-1.5';
  const buttonClass = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
  const editProgram = $derived(data.edit?.programStudi ?? null);
  function href(changes: Record<string, string | number | null>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key); else params.set(key, String(value));
    }
    return '?' + params.toString();
  }
  function value(key: string, fallback: string) { return form?.values?.[key] ?? fallback; }
  $effect(() => { if (page.url.searchParams.get('modal') === 'create') { openedEditId = undefined; formOpen = true; } if (form?.values?.mode === 'save') formOpen = true; if (data.edit?.id && data.edit.id !== openedEditId) { openedEditId = data.edit.id; formOpen = true; } });
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`Master Data / ${title}`} {title} description="Kelola data akademik. Data nonaktif tetap tersimpan untuk menjaga riwayat.">
  {#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" href={href({ edit: null, modal: 'create' })} onclick={() => { if (!data.edit) formOpen = true; }}><Icon name="plus" size={16} /> Tambah {title}</a>{/snippet}
</PageHeader>
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">{form.message}</p>{/if}

<section class="surface-panel mt-6 p-5 sm:p-6" aria-label="Filter data">
  <form method="GET" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" use:seamlessFilter>
    <label class="text-sm font-medium">Cari kode atau nama<input class={inputClass} name="search" value={data.filters.search} maxlength="150" placeholder="Kode atau nama" /></label>
    <label class="text-sm font-medium">Status<select class={inputClass} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
    {#if isCurriculum}
      <label class="text-sm font-medium">Tahun berlaku<input class={inputClass} name="tahun_berlaku" type="number" min="1900" max="9999" value={data.filters.tahun_berlaku ?? ''} /></label>
      <label class="text-sm font-medium">Program Studi<select class={inputClass} name="program_studi_id" value={data.filters.program_studi_id ?? ''}><option value="">Semua program studi</option>
        {#if data.filters.program_studi_id && !data.programs?.data.some(item => item.id === data.filters.program_studi_id)}<option value={data.filters.program_studi_id}>Program Studi terpilih</option>{/if}
        {#each data.programs?.data ?? [] as item}<option value={item.id}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/each}
      </select></label>
      <input type="hidden" name="program_search" value={data.programQuery.search} /><input type="hidden" name="program_page" value={data.programQuery.page} />
    {/if}
    <noscript><button class={buttonClass}>Terapkan filter</button></noscript>
    {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={filterResetHref} data-sveltekit-noscroll>Reset filter</a></div>{/if}
  </form>
</section>

<section class="surface-panel relative mt-6 overflow-hidden" aria-label={`Daftar ${title}`} aria-busy={listPending}>
  <ListPending />
  <div class="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 class="font-bold">Daftar {title}</h2></div>
  <div class="overflow-x-auto px-1 transition-opacity" class:opacity-80={listPending}>
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 text-slate-500"><tr><th class="p-3">Kode</th><th class="p-3">Nama</th>{#if isCurriculum}<th class="p-3">Program Studi</th><th class="p-3">Tahun Berlaku</th>{:else}<th class="p-3">SKS</th>{/if}<th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead>
      <tbody>
        {#each data.records as row (row.id)}
          <tr class="border-b border-slate-100"><td class="p-3 font-medium">{row.kode}</td><td class="p-3">{row.nama}</td>
            {#if isCurriculum && row.programStudi}<td class="p-3">{row.programStudi.nama}{#if !row.programStudi.isActive}<span class="block text-xs text-slate-500">Program Studi nonaktif</span>{/if}</td><td class="p-3">{row.tahunBerlaku}</td>{:else}<td class="p-3">{row.sks}</td>{/if}
            <td class="p-3"><StatusBadge active={row.isActive} /></td>
            <td class="p-3"><div class="flex gap-4">{#if isCurriculum}<a class="font-semibold text-brand-700" href={`/akademik/kurikulum/${row.id}`}>Mata Kuliah</a>{/if}<a class="font-semibold text-brand-700" aria-label={`Edit ${row.nama}`} href={href({ edit: row.id, modal: null })} onclick={() => { if (data.edit?.id === row.id) formOpen = true; }}>Edit</a><button class="text-slate-600 disabled:opacity-50" disabled={saving} onclick={() => confirmation = row}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
          </tr>
        {:else}<tr><td colspan={isCurriculum ? 6 : 5} class="p-8 text-center text-slate-500">Tidak ada data yang cocok. Ubah filter atau tambahkan {title.toLowerCase()}.</td></tr>{/each}
      </tbody>
    </table>
  </div>
  <div class="px-5 pb-4 sm:px-6"><Pagination {...data.meta} href={number => href({ page: number })} /></div>
</section>

<dialog bind:this={confirmationDialog} class="m-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-6 text-slate-900 backdrop:bg-slate-900/40" aria-labelledby="confirmation-title" oncancel={event => { if (saving) event.preventDefault(); else confirmation = null; }}>
  {#if confirmation}
    <h2 id="confirmation-title" class="font-semibold">{confirmation.isActive ? 'Nonaktifkan' : 'Aktifkan'} {confirmation.nama}?</h2>
    <p class="mt-2 text-sm">{confirmation.isActive ? 'Penonaktifan tidak menghapus data atau riwayat akademik. Data tidak tersedia untuk penugasan baru.' : 'Data akan tersedia kembali untuk penugasan baru.'}</p>
    <form method="POST" class="mt-4 flex gap-4" use:enhance={() => {
      saving = true;
      return async ({ update }) => { try { await update({ reset: false }); confirmation = null; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={confirmation.id} /><input type="hidden" name="is_active" value={String(!confirmation.isActive)} />
      <button class={buttonClass} disabled={saving}>Ya, {confirmation.isActive ? 'nonaktifkan' : 'aktifkan'}</button><button type="button" class="text-sm" disabled={saving} onclick={() => confirmation = null}>Batal</button>
    </form>
  {/if}
</dialog>

<Modal bind:open={formOpen} title={`${data.edit ? 'Edit' : 'Tambah'} ${title}`} closeDisabled={saving} width="lg" onClose={() => { if (data.edit || page.url.searchParams.has('modal') || form?.values?.mode === 'save') void goto(href({ edit: null, modal: null }), { replaceState: true, noScroll: true, keepFocus: true }); }}>
  <p class="mt-2 text-sm text-slate-500">{isCurriculum ? 'Kurikulum yang sudah digunakan mahasiswa mempertahankan identitas, mata kuliah, dan persyaratannya. Buat versi baru untuk perubahan akademik.' : 'Kode, nama, dan SKS yang sudah digunakan kurikulum atau kelas tidak dapat diubah. Buat mata kuliah dengan kode baru untuk versi berikutnya.'}</p>
  {#if data.edit}<p class="mt-2 text-sm text-slate-500">Status: {data.edit.isActive ? 'Aktif' : 'Nonaktif'}. Gunakan tindakan pada tabel untuk mengubah status.</p>{/if}
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#if isCurriculum && data.programs}
    <div class="mt-4"><AcademicOptions prefix="program_" label="Program Studi" meta={data.programs.meta} /></div>
  {/if}
  {#key data.edit?.id + JSON.stringify(form)}
    <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => {
      saving = true;
      return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
      <label class="text-sm font-medium">Kode<input class={inputClass} name="kode" value={value('kode', data.edit?.kode ?? '')} required maxlength="30" pattern=".*\S.*" /><span class="mt-1 block text-xs font-normal text-slate-500">Unik; disimpan dalam huruf kapital.</span></label>
      <label class="text-sm font-medium">Nama<input class={inputClass} name="nama" value={value('nama', data.edit?.nama ?? '')} required maxlength="150" pattern=".*\S.*" /></label>
      {#if isCurriculum}
        <label class="text-sm font-medium">Program Studi<select class={inputClass} name="program_studi_id" required value={value('program_studi_id', editProgram?.id ?? '')}><option value="" disabled>Pilih program studi aktif</option>
          {#if editProgram && !data.programs?.data.some(item => item.id === editProgram.id)}<option value={editProgram.id}>{editProgram.kode} — {editProgram.nama}{editProgram.isActive ? '' : ' (Nonaktif, penugasan lama)'}</option>{/if}
          {#each data.programs?.data ?? [] as item}<option value={item.id} disabled={!item.isActive && item.id !== editProgram?.id}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/each}
        </select></label>
        <label class="text-sm font-medium">Tahun berlaku<input class={inputClass} name="tahun_berlaku" type="number" min="1900" max="9999" required value={value('tahun_berlaku', String(data.edit?.tahunBerlaku ?? ''))} /></label>
      {:else}
        <label class="text-sm font-medium">SKS<input class={inputClass} name="sks" type="number" min="1" max="32767" required value={value('sks', String(data.edit?.sks ?? ''))} /></label>
      {/if}
      <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={buttonClass} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
  {/key}
</Modal>
