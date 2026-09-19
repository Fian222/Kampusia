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
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let periodOpen = $state(false);
  let requestedEditId = $state<string | null>(null);
  let requestedPeriodId = $state<string | null>(null);
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = ['search', 'jenis', 'tahun_mulai', 'is_active'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const queryEditId = $derived(page.url.searchParams.get('edit'));
  const queryPeriodId = $derived(page.url.searchParams.get('krs_period'));
  const actionValue = (name: string) => (form?.values as Record<string, string> | undefined)?.[name];
  const saveFailed = $derived(form?.values?.mode === 'save' && !form.saved);
  const periodSaveFailed = $derived(form?.values?.mode === 'krs-period' && !form.saved);
  const editModal = $derived(resolveEditModalState({ queryEditId, requestedEditId, loadedEditId: data.edit?.id ?? null, createRequested: page.url.searchParams.get('modal') === 'create', saveFailed, failedEditId: saveFailed ? actionValue('id') || null : null }));
  const periodModal = $derived(resolveEditModalState({ queryEditId: queryPeriodId, requestedEditId: requestedPeriodId, loadedEditId: data.krsPeriod?.id ?? null, createRequested: false, saveFailed: periodSaveFailed, failedEditId: periodSaveFailed ? actionValue('id') || null : null }));
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const input = 'control-base mt-1.5';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  function href(changes: Record<string, string | number>) { const p = new URLSearchParams(page.url.searchParams); for (const [key, value] of Object.entries(changes)) { if (value === '') p.delete(key); else p.set(key, String(value)); } return '?' + p; }
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  function openKrsPeriod(id: string) { requestedPeriodId = id; periodOpen = true; }
  function jakartaDateTimeLocal(value: Date | string | null | undefined) { if (!value) return ''; const instant = new Date(value); const local = new Date(instant.getTime() + 7 * 60 * 60 * 1000); const pad = (number: number) => String(number).padStart(2, '0'); return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`; }
  function jakartaLabel(value: Date | string) { return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)); }
  function periodState(row: { krsMulaiAt: Date | string | null; krsSelesaiAt: Date | string | null }) { if (!row.krsMulaiAt || !row.krsSelesaiAt) return 'Belum dijadwalkan'; const now = new Date(); if (now < new Date(row.krsMulaiAt)) return 'Belum dibuka'; if (now >= new Date(row.krsSelesaiAt)) return 'Sudah ditutup'; return 'Sedang dibuka'; }
  $effect(() => { const state = editModal; if (queryEditId && requestedEditId === queryEditId) requestedEditId = null; if (state.open) formOpen = true; else if (requestedEditId === null) formOpen = false; });
  $effect(() => { const state = periodModal; if (queryPeriodId && requestedPeriodId === queryPeriodId) requestedPeriodId = null; if (state.open) periodOpen = true; else if (requestedPeriodId === null) periodOpen = false; });
</script>
<svelte:head><title>Semester · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Perkuliahan" title="Semester" description="Pilih periode akademik aktif secara eksplisit dan pertahankan seluruh riwayat semester.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={href({ edit: '', modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah Semester</a>{/snippet}</PageHeader>
{#if data.activeSemester}
  <section class="mt-6 overflow-hidden rounded-2xl bg-brand-950 px-5 py-5 text-white shadow-sm sm:px-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div><p class="eyebrow text-brand-200">Semester aktif</p><h2 class="mt-2 text-xl font-semibold">{data.activeSemester.nama}</h2><p class="mt-1 text-sm text-brand-100">{data.activeSemester.kode} · {data.activeSemester.tahunMulai}/{data.activeSemester.tahunMulai + 1} · {data.activeSemester.jenis}</p></div>
      <Badge tone={periodState(data.activeSemester) === 'Sedang dibuka' ? 'success' : periodState(data.activeSemester) === 'Sudah ditutup' ? 'danger' : 'neutral'}>{periodState(data.activeSemester)}</Badge>
    </div>
    <p class="mt-4 text-sm text-brand-100">Periode KRS: {data.activeSemester.krsMulaiAt && data.activeSemester.krsSelesaiAt ? `${jakartaLabel(data.activeSemester.krsMulaiAt)} – ${jakartaLabel(data.activeSemester.krsSelesaiAt)} WIB` : 'belum dijadwalkan'}</p>
  </section>
{/if}
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<form method="GET" class="filter-panel mt-6 grid gap-4 sm:grid-cols-4" use:seamlessFilter>
  <label class="text-sm">Cari kode atau nama<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  <label class="text-sm">Jenis<select class={input} name="jenis" value={data.filters.jenis ?? ''}><option value="">Semua</option><option>GANJIL</option><option>GENAP</option></select></label>
  <label class="text-sm">Tahun mulai<input class={input} type="number" min="1900" max="9998" name="tahun_mulai" value={data.filters.tahun_mulai ?? ''} /></label>
  <label class="text-sm">Semester akademik aktif<select class={input} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua</option><option value="true">Sedang aktif</option><option value="false">Tidak dipilih</option></select></label>
  <noscript><button class={button}>Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, filterKeys)} data-sveltekit-noscroll>Reset filter</a></div>{/if}
</form>
<section class={`${box} relative`} aria-busy={listPending}>
  <ListPending />
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Semester</h2></div>
  <div class="mt-4 overflow-x-auto transition-opacity" class:opacity-80={listPending}><table class="w-full text-left text-sm">
    <thead class="border-b text-slate-500"><tr>{#each ['Semester', 'Rentang akademik', 'Periode KRS', 'Status', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100">
      <td class="p-3"><p class="font-semibold text-slate-900">{row.nama}</p><p class="mt-1 text-xs text-slate-500">{row.kode} · {row.jenis} · {row.tahunMulai}/{row.tahunMulai + 1}</p></td>
      <td class="p-3 whitespace-nowrap"><p>{row.tanggalMulai} – {row.tanggalSelesai}</p></td>
      <td class="p-3"><Badge tone={periodState(row) === 'Sedang dibuka' ? 'success' : periodState(row) === 'Sudah ditutup' ? 'danger' : 'neutral'}>{periodState(row)}</Badge><span class="mt-1 block whitespace-nowrap text-xs text-slate-500">{row.krsMulaiAt && row.krsSelesaiAt ? `${jakartaLabel(row.krsMulaiAt)} – ${jakartaLabel(row.krsSelesaiAt)} WIB` : 'Belum diatur'}</span></td>
      <td class="p-3"><Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Semester aktif' : 'Tidak dipilih'}</Badge></td>
      <td class="p-3"><div class="flex flex-wrap items-center gap-2"><a class="action-secondary" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a><a class="action-secondary" aria-label={`Atur periode KRS ${row.nama}`} href={href({ edit: '', modal: '', krs_period: row.id })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openKrsPeriod(row.id)}>Atur Periode KRS</a></div>
        {#if !row.isActive}<details class="mt-2"><summary class="cursor-pointer text-teal-800">Aktifkan</summary><p class="my-2">Ganti semester aktif menjadi {row.nama}?</p><form method="POST" action="?/semester" use:enhance={submit}><input type="hidden" name="mode" value="activate" /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, aktifkan semester</button></form></details>{/if}
      </td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada semester yang cocok.</td></tr>{/each}</tbody>
  </table></div>
  <Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} Semester`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : undefined} closeDisabled={saving} width="lg" onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="space-y-3" role="status" aria-label="Menyiapkan formulir semester"><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div></div>
  {:else}
  <p class="mt-2 text-sm text-slate-500">Kode: tahun mulai diikuti 1 untuk Ganjil atau 2 untuk Genap. Identitas dan tanggal dengan riwayat KRS disetujui atau jadwal dipertahankan.</p>
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" action="?/semester" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values?.mode === 'save' ? form.values : {}} fields={[
      { name: 'kode', label: 'Kode', value: data.edit?.kode, maxlength: 5 }, { name: 'nama', label: 'Nama', value: data.edit?.nama, maxlength: 100 },
      { name: 'tahun_mulai', label: 'Tahun mulai', type: 'number', min: 1900, max: 9998, value: data.edit?.tahunMulai },
      { name: 'jenis', label: 'Jenis', value: data.edit?.jenis ?? 'GANJIL', options: ['GANJIL', 'GENAP'].map(value => ({ value, label: value })) },
      { name: 'tanggal_mulai', label: 'Tanggal Mulai', type: 'date', value: data.edit?.tanggalMulai }, { name: 'tanggal_selesai', label: 'Tanggal Selesai', type: 'date', value: data.edit?.tanggalSelesai },
    ]} />
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>{/key}
  {/if}
</Modal>
<Modal bind:open={periodOpen} title="Atur Periode KRS" description={periodModal.loading ? 'Menyiapkan periode KRS.' : 'Waktu ditampilkan dan disimpan berdasarkan zona Asia/Jakarta (WIB).'} closeDisabled={saving} width="md" onClose={() => { const shouldClear = requestedPeriodId !== null || queryPeriodId || form?.values?.mode === 'krs-period'; requestedPeriodId = null; if (shouldClear) void goto(href({ krs_period: '' }), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if periodModal.loading}
    <div class="space-y-3" role="status" aria-label="Menyiapkan periode KRS"><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div><div class="h-11 animate-pulse rounded-lg bg-slate-100"></div></div>
  {:else}
    <p class="mt-2 text-sm text-slate-500">Isi kedua waktu, atau kosongkan keduanya jika periode KRS belum dijadwalkan.</p>
    {#if form?.message && form.values?.mode === 'krs-period'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
    {#key data.krsPeriod?.id + JSON.stringify(form)}
      <form method="POST" action="?/krsPeriod" class="mt-4 grid gap-4" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') periodOpen = false; } finally { saving = false; } }; }}>
        <input type="hidden" name="mode" value="krs-period" /><input type="hidden" name="id" value={data.krsPeriod?.id ?? actionValue('id') ?? ''} />
        <AcademicFields values={form?.values?.mode === 'krs-period' ? form.values : {}} fields={[
          { name: 'krs_mulai_at', label: 'KRS mulai (WIB)', type: 'datetime-local', required: false, value: jakartaDateTimeLocal(data.krsPeriod?.krsMulaiAt) },
          { name: 'krs_selesai_at', label: 'KRS selesai (WIB)', type: 'datetime-local', required: false, value: jakartaDateTimeLocal(data.krsPeriod?.krsSelesaiAt) },
        ]} />
        <div class="flex justify-end gap-3"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => periodOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Periode KRS'}</button></div>
      </form>
    {/key}
  {/if}
</Modal>
