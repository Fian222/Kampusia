<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import { clearEditQueryHref, editQueryHref, modalNavigationOptions, resolveEditModalState } from '$lib/navigation/edit-modal';
  import type { ProfileData } from '$lib/server/academic-profiles';
  import Pagination from './Pagination.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  import ListPending from './ui/ListPending.svelte';
  import Badge from './ui/Badge.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import ReferenceCombobox from './ReferenceCombobox.svelte';

  let { data, form }: { data: ProfileData; form: { message: string; saved?: true; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let requestedEditId = $state<string | null>(null);
  let confirmation = $state<{ id: string; nama: string; isActive: boolean } | null>(null);
  let confirmationOpen = $state(false);
  let selectedProgramId = $state('');
  let selectedCurriculumId = $state('');
  let selectedAdviserId = $state('');
  let selectionKey = $state('');
  const title = $derived(data.kind === 'mahasiswa' ? 'Mahasiswa' : 'Dosen');
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = $derived(data.kind === 'mahasiswa' ? ['search', 'program_studi_id', 'kurikulum_id', 'angkatan', 'status'] : ['search', 'program_studi_id', 'is_active']);
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const filterResetHref = $derived(resetQueryHref(page.url, filterKeys));
  const student = $derived(data.kind === 'mahasiswa' ? data.edit : null);
  const lecturer = $derived(data.kind === 'dosen' ? data.edit : null);
  const queryEditId = $derived(page.url.searchParams.get('edit'));
  const saveFailed = $derived(form?.values?.mode === 'save' && !form.saved);
  const editModal = $derived(resolveEditModalState({ queryEditId, requestedEditId, loadedEditId: data.edit?.id ?? null, createRequested: page.url.searchParams.get('modal') === 'create', saveFailed, failedEditId: saveFailed ? form?.values?.id || null : null }));
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
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  const programs = $derived.by(() => {
    const rows: { id: string; kode: string; nama: string; isActive: boolean }[] = data.programs.data.map(({ id, kode, nama, isActive }) => ({ id, kode, nama, isActive }));
    for (const item of [data.edit?.programStudi, data.selectedProgram]) {
      if (item && !rows.some(row => row.id === item.id)) rows.push({ id: item.id, kode: item.kode, nama: item.nama, isActive: item.isActive });
    }
    return rows;
  });
  const programOptions = $derived(programs.map(item => ({ value: item.id, label: item.nama, description: item.kode, disabled: !item.isActive && item.id !== data.edit?.programStudiId })));
  const curriculumOptions = $derived((data.curricula?.data ?? []).map(item => ({ value: item.id, label: item.nama, description: item.kode, disabled: !item.isActive && item.id !== student?.kurikulumId })));
  const adviserOptions = $derived((data.advisers?.data ?? []).map(item => ({ value: item.id, label: item.nama, description: [item.kodeDosen, item.nidn ? `NIDN ${item.nidn}` : ''].filter(Boolean).join(' · ') })));
  const selectedProgramOption = $derived(data.edit?.programStudi ? { value: data.edit.programStudi.id, label: data.edit.programStudi.nama, description: data.edit.programStudi.kode, disabled: !data.edit.programStudi.isActive } : data.selectedProgram ? { value: data.selectedProgram.id, label: data.selectedProgram.nama, description: data.selectedProgram.kode, disabled: !data.selectedProgram.isActive } : null);
  const selectedCurriculumOption = $derived(student?.kurikulum ? { value: student.kurikulum.id, label: student.kurikulum.nama, description: student.kurikulum.kode, disabled: !student.kurikulum.isActive } : null);
  const selectedAdviserOption = $derived(student?.dosenPa ? { value: student.dosenPa.id, label: student.dosenPa.nama, description: student.dosenPa.kodeDosen, disabled: !student.dosenPa.isActive } : null);
  function updateProgram(programId: string, previousProgramId: string) {
    if (programId === previousProgramId) return;
    selectedProgramId = programId;
    selectedCurriculumId = '';
    void goto(href({ choice_program: programId || null, curriculum_search: null, curriculum_page: null }), { replaceState: true, noScroll: true, keepFocus: true });
  }
  $effect(() => {
    const key = `${data.kind}:${data.edit?.id ?? 'new'}:${saveFailed ? `${form?.values?.program_studi_id}:${form?.values?.kurikulum_id}:${form?.values?.dosen_pa_id}` : ''}`;
    if (key !== selectionKey) {
      selectionKey = key;
      selectedProgramId = value('program_studi_id', data.edit?.programStudiId ?? '');
      selectedCurriculumId = value('kurikulum_id', student?.kurikulumId ?? '');
      selectedAdviserId = value('dosen_pa_id', student?.dosenPaId ?? '');
    }
  });
  $effect(() => { const state = editModal; if (queryEditId && requestedEditId === queryEditId) requestedEditId = null; if (state.open) formOpen = true; else if (requestedEditId === null) formOpen = false; });
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`Master Data / ${title}`} {title} description="Kelola profil akademik dan pertahankan riwayatnya. Akun login bersifat opsional.">
  {#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" href={href({ edit: null, modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah {title}</a>{/snippet}
</PageHeader>
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class={panelClass}>{form.message}</p>{/if}

<section class={panelClass} aria-label="Filter data">
  <form method="GET" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" use:seamlessFilter>
    {#each ['program_search', 'program_page', 'curriculum_search', 'curriculum_page', 'choice_program'] as key}
      {#if page.url.searchParams.has(key)}<input type="hidden" name={key} value={page.url.searchParams.get(key)} />{/if}
    {/each}
    <label class="text-sm font-medium">{data.kind === 'mahasiswa' ? 'Cari NIM atau nama' : 'Cari NIK, kode dosen, NIDN, atau nama'}<input class={inputClass} name="search" value={data.filters.search} maxlength="150" /></label>
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

<section class="surface-panel relative mt-6 overflow-hidden" aria-label="Daftar profil" aria-busy={listPending}>
  <ListPending />
  <div class="hidden overflow-x-auto transition-opacity md:block" class:opacity-80={listPending}><table class="w-full text-left text-sm">
    <thead><tr>{#each data.kind === 'mahasiswa' ? ['Mahasiswa', 'Program Studi', 'Informasi Akademik', 'Dosen PA', 'Status', 'Tindakan'] : ['Dosen', 'Homebase', 'Status', 'Tindakan'] as column}<th class="px-5 py-3.5">{column}</th>{/each}</tr></thead>
    <tbody class="divide-y divide-slate-100">
      {#if data.kind === 'mahasiswa'}
        {#each data.records as row}<tr>
          <td class="px-5 py-4"><p class="font-semibold text-slate-950">{row.nama}</p><p class="mt-1 font-mono text-xs font-semibold text-slate-500">{row.nim}</p><p class="mt-1 text-xs text-slate-500">{row.account?.loginId ? `Akun ${row.account.loginId} · ${row.account.isActive ? 'Aktif' : 'Nonaktif'}` : 'Belum memiliki akun login'}</p></td>
          <td class="px-5 py-4"><p class="font-medium text-slate-800">{row.programStudi.nama}</p><p class="mt-1 text-xs text-slate-500">{row.programStudi.kode} · {row.fakultas.nama}</p></td>
          <td class="px-5 py-4"><p class="font-medium text-slate-800">Angkatan {row.angkatan}</p><p class="mt-1 text-xs text-slate-500">{row.kurikulum.nama}</p></td>
          <td class="px-5 py-4"><p class="font-medium text-slate-800">{row.dosenPa?.nama ?? 'Belum ditetapkan'}</p>{#if row.dosenPa}<p class="mt-1 text-xs text-slate-500">{row.dosenPa.kodeDosen}</p>{/if}</td>
          <td class="px-5 py-4"><Badge tone={row.status === 'AKTIF' ? 'success' : row.status === 'LULUS' ? 'info' : 'neutral'}>{row.status}</Badge></td>
          <td class="px-5 py-4"><div class="flex flex-wrap gap-2"><a class="inline-flex min-h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50" href={`/akademik/mahasiswa/${row.id}/hasil-studi`}>Hasil Studi</a><a class="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a></div></td>
        </tr>{/each}
      {:else}
        {#each data.records as row}<tr>
          <td class="px-5 py-4"><p class="font-semibold text-slate-950">{row.nama}</p><p class="mt-1 text-xs text-slate-500"><span class="font-mono font-semibold">{row.kodeDosen}</span>{row.nik ? ` · NIK ${row.nik}` : ''}{row.nidn ? ` · NIDN ${row.nidn}` : ''}</p><p class="mt-1 text-xs text-slate-500">{row.account?.loginId ? `Akun ${row.account.loginId} · ${row.account.isActive ? 'Aktif' : 'Nonaktif'}` : 'Belum memiliki akun login'}</p></td>
          <td class="px-5 py-4"><p class="font-medium text-slate-800">{row.programStudi?.nama ?? 'Tanpa homebase'}</p>{#if row.programStudi}<p class="mt-1 text-xs text-slate-500">{row.programStudi.kode}</p>{/if}</td><td class="px-5 py-4"><StatusBadge active={row.isActive} /></td>
          <td class="px-5 py-4"><div class="flex flex-wrap gap-2"><a class="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a><button class="inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100" onclick={() => { confirmation = row; confirmationOpen = true; }}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td>
        </tr>{/each}
      {/if}
    </tbody>
  </table></div>
  <ul class="divide-y divide-slate-100 md:hidden">
    {#if data.kind === 'mahasiswa'}
    {#each data.records as row}
      <li class="p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-950">{row.nama}</p><p class="mt-1 font-mono text-xs font-semibold text-slate-500">{row.nim}</p><p class="mt-1 text-xs text-slate-500">{row.account?.loginId ? `Akun ${row.account.loginId} · ${row.account.isActive ? 'Aktif' : 'Nonaktif'}` : 'Belum memiliki akun login'}</p></div><Badge tone={row.status === 'AKTIF' ? 'success' : 'neutral'}>{row.status}</Badge></div>
        <div class="mt-3 text-sm text-slate-600"><p>{row.programStudi.nama}</p><p class="mt-1 text-xs text-slate-500">Angkatan {row.angkatan} · PA: {row.dosenPa?.nama ?? 'Belum ditetapkan'}</p></div>
        <div class="mt-4 flex gap-2"><a class="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700" href={`/akademik/mahasiswa/${row.id}/hasil-studi`}>Hasil Studi</a><a class="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-brand-700" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a></div>
      </li>
    {:else}
      <li><EmptyState title={`Belum ada data ${title.toLowerCase()}`} description="Ubah filter atau tambahkan profil baru." icon={data.kind === 'mahasiswa' ? 'users' : 'user'} compact /></li>
    {/each}
    {:else}
    {#each data.records as row}
      <li class="p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-slate-950">{row.nama}</p><p class="mt-1 font-mono text-xs font-semibold text-slate-500">{row.kodeDosen}</p><p class="mt-1 text-xs text-slate-500">{row.nik ? `NIK ${row.nik}` : 'NIK belum diisi'} · {row.account?.loginId ? `Akun ${row.account.loginId} · ${row.account.isActive ? 'Aktif' : 'Nonaktif'}` : 'Belum memiliki akun login'}</p></div><StatusBadge active={row.isActive} /></div>
        <div class="mt-3 text-sm text-slate-600"><p>{row.programStudi?.nama ?? 'Tanpa homebase'}</p>{#if row.nidn}<p class="mt-1 text-xs text-slate-500">NIDN {row.nidn}</p>{/if}</div>
        <div class="mt-4 flex gap-2"><a class="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-brand-700" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a><button class="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-600" onclick={() => { confirmation = row; confirmationOpen = true; }}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></div>
      </li>
    {:else}
      <li><EmptyState title={`Belum ada data ${title.toLowerCase()}`} description="Ubah filter atau tambahkan profil baru." icon="user" compact /></li>
    {/each}
    {/if}
  </ul>
  {#if !data.records.length}<div class="hidden md:block"><EmptyState title={`Belum ada data ${title.toLowerCase()}`} description="Ubah filter atau tambahkan profil baru." icon={data.kind === 'mahasiswa' ? 'users' : 'user'} compact /></div>{/if}
  <div class="px-5 pb-4"><Pagination {...data.meta} href={number => href({ page: number })} /></div>
</section>

<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} ${title}`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : 'Data profil akademik dapat disimpan tanpa akun login.'} closeDisabled={saving} width="lg" onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="space-y-3" role="status" aria-label={`Menyiapkan formulir ${title.toLowerCase()}`}><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div></div>
  {:else}
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
    <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => {
      saving = true;
      return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
      {#if data.kind === 'mahasiswa'}
        <label class="text-sm font-medium">NIM<input class={inputClass} name="nim" type="text" inputmode="numeric" value={value('nim', student?.nim)} required maxlength="30" pattern="[0-9]+" /><span class="text-xs font-normal text-slate-500">1–30 digit; nol di depan tetap dipertahankan.</span></label>
      {:else}
        <label class="text-sm font-medium">NIK pegawai (opsional)<input class={inputClass} name="nik" type="text" inputmode="numeric" value={value('nik', lecturer?.nik ?? '')} maxlength="30" pattern="[0-9]*" /><span class="text-xs font-normal text-slate-500">Nomor pegawai internal kampus, bukan NIK KTP. Akun login yang cocok akan dihubungkan otomatis.</span></label>
        <label class="text-sm font-medium">Kode Dosen<input class={inputClass} name="kode_dosen" value={value('kode_dosen', lecturer?.kodeDosen)} required maxlength="30" pattern=".*\S.*" /></label>
        <label class="text-sm font-medium">NIDN (opsional)<input class={inputClass} name="nidn" value={value('nidn', lecturer?.nidn ?? '')} maxlength="30" /></label>
      {/if}
      <label class="text-sm font-medium">Nama<input class={inputClass} name="nama" value={value('nama', data.edit?.nama)} required maxlength="150" pattern=".*\S.*" /></label>
      <ReferenceCombobox name="program_studi_id" label={data.kind === 'mahasiswa' ? 'Program Studi' : 'Homebase Program Studi'} bind:value={selectedProgramId} options={programOptions} selectedOption={selectedProgramOption} meta={data.programs.meta} searchParam="program_search" pageParam="program_page" placeholder={data.kind === 'mahasiswa' ? 'Pilih program studi' : 'Tanpa homebase'} searchPlaceholder="Cari program studi…" required={data.kind === 'mahasiswa'} nullable={data.kind === 'dosen'} error={saveFailed && data.kind === 'mahasiswa' && !selectedProgramId ? 'Program studi wajib dipilih.' : undefined} onValueChange={data.kind === 'mahasiswa' ? updateProgram : undefined} />
      {#if data.kind === 'mahasiswa'}
        <ReferenceCombobox name="kurikulum_id" label="Kurikulum" bind:value={selectedCurriculumId} options={curriculumOptions} selectedOption={selectedCurriculumOption} meta={data.curricula.meta} searchParam="curriculum_search" pageParam="curriculum_page" watchParams={['choice_program']} placeholder={selectedProgramId ? 'Pilih kurikulum' : 'Pilih program studi terlebih dahulu'} searchPlaceholder="Cari kurikulum…" required disabled={!selectedProgramId} error={saveFailed && !selectedCurriculumId ? 'Kurikulum wajib dipilih.' : undefined} help={selectedProgramId && !selectedCurriculumId ? 'Pilih kurikulum yang sesuai dengan program studi.' : undefined} />
        <label class="text-sm font-medium">Angkatan<input class={inputClass} name="angkatan" type="number" min="1900" max="9999" step="1" required value={value('angkatan', student ? String(student.angkatan) : '')} /></label>
        <label class="text-sm font-medium">Status<select class={inputClass} name="status" required value={value('status', student?.status ?? 'AKTIF')}>{#each data.statuses as item}<option value={item}>{item}</option>{/each}</select></label>
        <ReferenceCombobox name="dosen_pa_id" label="Dosen PA" bind:value={selectedAdviserId} options={adviserOptions} selectedOption={selectedAdviserOption} meta={data.advisers.meta} searchParam="adviser_search" pageParam="adviser_page" placeholder="Belum ditetapkan" searchPlaceholder="Cari nama, kode dosen, atau NIDN…" nullable help="Wajib sebelum mahasiswa mengajukan KRS." />
        <p class="text-sm text-slate-500 sm:col-span-2">Status akademik tidak menonaktifkan login. Perubahan program studi atau kurikulum memerlukan peninjauan akademik dan ditolak bila ada riwayat KRS disetujui.</p>
      {:else}<p class="text-sm text-slate-500">Homebase tidak membatasi program studi tempat dosen mengajar. Ubah status melalui tindakan pada tabel.</p>{/if}
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2" aria-label="Akun Login">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Akun Login</p>
        {#if data.edit?.account?.loginId}
          <div class="mt-2 flex flex-wrap items-center gap-2"><span class="font-mono text-sm font-semibold text-slate-900">{data.edit.account.loginId}</span><StatusBadge active={data.edit.account.isActive} /></div>
          {#if data.edit.account.email}<p class="mt-1 text-xs text-slate-500">{data.edit.account.email}</p>{/if}
        {:else}
          <p class="mt-2 text-sm font-semibold text-slate-700">Belum memiliki akun login</p>
        {/if}
        <p class="mt-1 text-xs text-slate-500">Akun yang sudah tersedia dicocokkan otomatis melalui {data.kind === 'mahasiswa' ? 'NIM' : 'NIK'} yang sama persis. Formulir ini tidak membuat akun atau kata sandi.</p>
      </section>
      <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={buttonClass} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
  {/key}
  {/if}
</Modal>

<Modal bind:open={confirmationOpen} title={`${confirmation?.isActive ? 'Nonaktifkan' : 'Aktifkan'} dosen`} description={confirmation ? `${confirmation.nama}. Riwayat penugasan tetap tersimpan.` : undefined} width="sm" closeDisabled={saving} onClose={() => confirmation = null}>
  {#if confirmation}
    <form method="POST" class="flex justify-end gap-3" use:enhance={() => {
      saving = true;
      return async ({ update }) => { try { await update(); confirmationOpen = false; } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={confirmation.id} /><input type="hidden" name="is_active" value={String(!confirmation.isActive)} />
      <button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => confirmationOpen = false}>Batal</button><button class={buttonClass} disabled={saving}>Ya, simpan</button>
    </form>
  {/if}
</Modal>
