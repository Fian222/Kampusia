<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import type { ProfileData } from '$lib/server/academic-profiles';
  import Pagination from './Pagination.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  import ListPending from './ui/ListPending.svelte';
  import AcademicOptions from './AcademicOptions.svelte';

  let { data, form }: { data: ProfileData; form: { message: string; saved?: true; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let openedEditId = $state<string>();
  let confirmation = $state<{ id: string; nama: string; isActive: boolean } | null>(null);
  let dialog: HTMLDialogElement;
  $effect(() => {
    if (confirmation && !dialog.open) dialog.showModal();
    else if (!confirmation && dialog.open) dialog.close();
  });
  const title = $derived(data.kind === 'mahasiswa' ? 'Mahasiswa' : 'Dosen');
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = $derived(data.kind === 'mahasiswa' ? ['search', 'program_studi_id', 'kurikulum_id', 'angkatan', 'status'] : ['search', 'program_studi_id', 'is_active']);
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const filterResetHref = $derived(resetQueryHref(page.url, filterKeys));
  const student = $derived(data.kind === 'mahasiswa' ? data.edit : null);
  const lecturer = $derived(data.kind === 'dosen' ? data.edit : null);
  const inputClass = 'control-base mt-1.5';
  const buttonClass = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
  const panelClass = 'surface-panel mt-6 p-5 sm:p-6';
  function href(changes: Record<string, string | number | null>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key); else params.set(key, String(value));
    }
    return '?' + params.toString();
  }
  function value(key: string, fallback = '') { return form?.values?.[key] ?? fallback; }
  const programs = $derived([...data.programs.data, ...[data.edit?.programStudi, data.selectedProgram].filter(item => item && !data.programs.data.some(row => row.id === item.id))]);
  $effect(() => { if (page.url.searchParams.get('modal') === 'create') { openedEditId = undefined; formOpen = true; } if (form?.values?.mode === 'save') formOpen = true; if (data.edit?.id && data.edit.id !== openedEditId) { openedEditId = data.edit.id; formOpen = true; } });
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`Master Data / ${title}`} {title} description="Kelola profil akademik dan pertahankan riwayatnya. Akun login bersifat opsional.">
  {#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" href={href({ edit: null, modal: 'create' })} onclick={() => { if (!data.edit) formOpen = true; }}><Icon name="plus" size={16} /> Tambah {title}</a>{/snippet}
</PageHeader>
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class={panelClass}>{form.message}</p>{/if}

<section class={panelClass} aria-label="Filter data">
  <form method="GET" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" use:seamlessFilter>
    {#each ['program_search', 'program_page', 'curriculum_search', 'curriculum_page', 'choice_program'] as key}
      {#if page.url.searchParams.has(key)}<input type="hidden" name={key} value={page.url.searchParams.get(key)} />{/if}
    {/each}
    <label class="text-sm font-medium">{data.kind === 'mahasiswa' ? 'Cari NIM atau nama' : 'Cari kode dosen, NIDN, atau nama'}<input class={inputClass} name="search" value={data.filters.search} maxlength="150" /></label>
    <label class="text-sm font-medium">Program Studi<select class={inputClass} name="program_studi_id" value={data.filters.program_studi_id ?? ''}><option value="">Semua program studi</option>{#each programs as item}{#if item}<option value={item.id}>{item.kode} — {item.nama}</option>{/if}{/each}</select></label>
    {#if data.kind === 'mahasiswa'}
      <label class="text-sm font-medium">Kurikulum<select class={inputClass} name="kurikulum_id" value={data.filters.kurikulum_id ?? ''}><option value="">Semua kurikulum</option>
        {#if data.filters.kurikulum_id && !data.curricula.data.some(item => item.id === data.filters.kurikulum_id)}<option value={data.filters.kurikulum_id}>Kurikulum terpilih ({data.filters.kurikulum_id})</option>{/if}
        {#each data.curricula.data as item}<option value={item.id}>{item.kode} — {item.nama}</option>{/each}
      </select></label>
      <label class="text-sm font-medium">Angkatan<input class={inputClass} name="angkatan" type="number" min="1900" max="9999" step="1" value={data.filters.angkatan ?? ''} /></label>
      <label class="text-sm font-medium">Status<select class={inputClass} name="status" value={data.filters.status ?? ''}><option value="">Semua status</option>{#each data.statuses as item}<option value={item}>{item}</option>{/each}</select></label>
    {:else}
      <label class="text-sm font-medium">Status<select class={inputClass} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
    {/if}
    <noscript><button class={buttonClass}>Terapkan filter</button></noscript>
    {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={filterResetHref} data-sveltekit-noscroll>Reset filter</a></div>{/if}
  </form>
</section>

<section class={`${panelClass} relative`} aria-label="Daftar profil" aria-busy={listPending}>
  <ListPending />
  <div class="overflow-x-auto transition-opacity" class:opacity-80={listPending}><table class="w-full whitespace-nowrap text-left text-sm">
    <thead class="border-b border-slate-200 text-slate-500"><tr>
      {#each data.kind === 'mahasiswa' ? ['NIM', 'Nama', 'Program Studi', 'Kurikulum', 'Angkatan', 'Status', 'Tindakan'] : ['Kode Dosen', 'NIDN', 'Nama', 'Homebase Program Studi', 'Status', 'Tindakan'] as column}<th class="px-3 py-3 font-medium">{column}</th>{/each}
    </tr></thead>
    <tbody class="divide-y divide-slate-100">
      {#if data.kind === 'mahasiswa'}
        {#each data.records as row}<tr>
          <td class="px-3 py-4 font-medium">{row.nim}</td><td class="px-3 py-4">{row.nama}</td><td class="px-3 py-4">{row.programStudi.nama}<span class="block text-xs text-slate-500">{row.fakultas.nama}</span></td><td class="px-3 py-4">{row.kurikulum.nama}</td><td class="px-3 py-4">{row.angkatan}</td><td class="px-3 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{row.status}</span></td><td class="px-3 py-4"><a class="mr-4 font-semibold text-brand-700" href={`/akademik/mahasiswa/${row.id}/hasil-studi`}>Hasil studi</a><a class="font-semibold text-brand-700" aria-label={`Edit ${row.nama}`} href={href({ edit: row.id, modal: null })} onclick={() => { if (data.edit?.id === row.id) formOpen = true; }}>Edit</a></td>
        </tr>{/each}
      {:else}
        {#each data.records as row}<tr>
          <td class="px-3 py-4 font-medium">{row.kodeDosen}</td><td class="px-3 py-4">{row.nidn ?? '—'}</td><td class="px-3 py-4">{row.nama}</td><td class="px-3 py-4">{row.programStudi?.nama ?? 'Tanpa homebase'}</td><td class="px-3 py-4"><StatusBadge active={row.isActive} /></td>
          <td class="px-3 py-4"><a class="mr-4 font-semibold text-brand-700" aria-label={`Edit ${row.nama}`} href={href({ edit: row.id, modal: null })} onclick={() => { if (data.edit?.id === row.id) formOpen = true; }}>Edit</a><button class="text-slate-600" onclick={() => confirmation = row}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
        </tr>{/each}
      {/if}
    </tbody>
  </table></div>
  {#if !data.records.length}<p class="py-6 text-center text-sm text-slate-500">Data tidak ditemukan. Ubah filter atau tambahkan profil.</p>{/if}
  <Pagination {...data.meta} href={number => href({ page: number })} />
</section>

<Modal bind:open={formOpen} title={`${data.edit ? 'Edit' : 'Tambah'} ${title}`} description="Data profil akademik dapat disimpan tanpa akun login." closeDisabled={saving} width="lg" onClose={() => { if (data.edit || page.url.searchParams.has('modal') || form?.values?.mode === 'save') void goto(href({ edit: null, modal: null }), { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <div class="mt-4"><AcademicOptions prefix="program_" label="Program Studi" meta={data.programs.meta} /></div>
  {#if data.kind === 'mahasiswa' && data.curricula}
    <section class="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4" aria-label="Cari kurikulum">
      <h2 class="text-sm font-bold">Cari Kurikulum</h2>
      <form method="GET" class="mt-3 grid items-end gap-3 sm:grid-cols-3" use:seamlessFilter={{ pageKey: 'curriculum_page' }}>
        {#each [...page.url.searchParams].filter(([key]) => !['curriculum_search', 'curriculum_page', 'choice_program'].includes(key)) as [key, entry]}<input type="hidden" name={key} value={entry} />{/each}
        <label class="text-sm">Program Studi<select class={inputClass} name="choice_program" value={data.curriculumQuery.program_studi_id ?? ''}><option value="">Semua program studi</option>{#each programs as item}{#if item}<option value={item.id}>{item.kode} — {item.nama}</option>{/if}{/each}</select></label>
        <label class="text-sm">Kode atau nama<input class={inputClass} name="curriculum_search" value={data.curriculumQuery.search} maxlength="150" /></label><noscript><button class={buttonClass}>Cari</button></noscript>
        {#if hasActiveQuery(page.url, ['curriculum_search', 'choice_program'])}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, ['curriculum_search', 'choice_program'], 'curriculum_page')} data-sveltekit-noscroll>Reset filter</a></div>{/if}
      </form>
      <Pagination {...data.curricula.meta} href={number => href({ curriculum_page: number })} />
    </section>
  {/if}
  {#key data.edit?.id + JSON.stringify(form)}
    <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => {
      saving = true;
      return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
      {#if data.kind === 'mahasiswa'}
        <label class="text-sm font-medium">NIM<input class={inputClass} name="nim" value={value('nim', student?.nim)} required maxlength="30" pattern=".*\S.*" /><span class="text-xs font-normal text-slate-500">Unik; disimpan dalam huruf kapital.</span></label>
      {:else}
        <label class="text-sm font-medium">Kode Dosen<input class={inputClass} name="kode_dosen" value={value('kode_dosen', lecturer?.kodeDosen)} required maxlength="30" pattern=".*\S.*" /></label>
        <label class="text-sm font-medium">NIDN (opsional)<input class={inputClass} name="nidn" value={value('nidn', lecturer?.nidn ?? '')} maxlength="30" /></label>
      {/if}
      <label class="text-sm font-medium">Nama<input class={inputClass} name="nama" value={value('nama', data.edit?.nama)} required maxlength="150" pattern=".*\S.*" /></label>
      <label class="text-sm font-medium">{data.kind === 'mahasiswa' ? 'Program Studi' : 'Homebase Program Studi (opsional)'}<select class={inputClass} name="program_studi_id" required={data.kind === 'mahasiswa'} value={value('program_studi_id', data.edit?.programStudiId ?? '')}>
        <option value="">{data.kind === 'mahasiswa' ? 'Pilih program studi' : 'Tanpa homebase'}</option>
        {#each programs as item}{#if item}<option value={item.id} disabled={!item.isActive && item.id !== data.edit?.programStudiId}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/if}{/each}
      </select></label>
      {#if data.kind === 'mahasiswa'}
        <label class="text-sm font-medium">Kurikulum<select class={inputClass} name="kurikulum_id" required value={value('kurikulum_id', student?.kurikulumId)}><option value="" disabled>Pilih kurikulum</option>
          {#if student && !data.curricula.data.some(item => item.id === student.kurikulumId)}<option value={student.kurikulumId}>{student.kurikulum.kode} — {student.kurikulum.nama}</option>{/if}
          {#each data.curricula.data as item}<option value={item.id} disabled={!item.isActive && item.id !== student?.kurikulumId}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/each}
        </select></label>
        <label class="text-sm font-medium">Angkatan<input class={inputClass} name="angkatan" type="number" min="1900" max="9999" step="1" required value={value('angkatan', student ? String(student.angkatan) : '')} /></label>
        <label class="text-sm font-medium">Status<select class={inputClass} name="status" required value={value('status', student?.status ?? 'AKTIF')}>{#each data.statuses as item}<option value={item}>{item}</option>{/each}</select></label>
        <p class="text-sm text-slate-500 sm:col-span-2">Status akademik tidak menonaktifkan login. Perubahan program studi atau kurikulum memerlukan peninjauan akademik dan ditolak bila ada riwayat KRS disetujui.</p>
      {:else}<p class="text-sm text-slate-500">Homebase tidak membatasi program studi tempat dosen mengajar. Ubah status melalui tindakan pada tabel.</p>{/if}
      <label class="text-sm font-medium sm:col-span-2">ID akun pengguna (opsional)<input class={inputClass} name="user_id" value={value('user_id', data.edit?.userId ?? '')} placeholder="UUID akun pengguna" /><span class="text-xs font-normal text-slate-500">Gunakan akun berperan {data.kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN'}. Kosongkan untuk profil tanpa akun login.</span></label>
      <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={buttonClass} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
  {/key}
</Modal>

<dialog bind:this={dialog} onclose={() => confirmation = null} class="m-auto w-full max-w-md rounded-xl p-6 backdrop:bg-slate-900/40">
  {#if confirmation}
    <h2 class="text-lg font-semibold">{confirmation.isActive ? 'Nonaktifkan' : 'Aktifkan'} dosen?</h2><p class="mt-3 text-sm text-slate-600">{confirmation.nama}. Riwayat penugasan tetap tersimpan.</p>
    <form method="POST" class="mt-5 flex gap-3" use:enhance={() => {
      saving = true;
      return async ({ update }) => { try { await update(); } finally { saving = false; confirmation = null; } };
    }}>
      <input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={confirmation.id} /><input type="hidden" name="is_active" value={String(!confirmation.isActive)} />
      <button class={buttonClass} disabled={saving}>Ya, simpan</button><button type="button" class="px-4 py-2 text-sm" onclick={() => confirmation = null}>Batal</button>
    </form>
  {/if}
</dialog>
