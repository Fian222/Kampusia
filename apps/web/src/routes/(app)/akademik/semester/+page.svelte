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
  let requestedEditId = $state<string | null>(null);
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = ['search', 'jenis', 'tahun_mulai', 'is_active'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const queryEditId = $derived(page.url.searchParams.get('edit'));
  const saveFailed = $derived(form?.values?.mode === 'save' && !form.saved);
  const editModal = $derived(resolveEditModalState({ queryEditId, requestedEditId, loadedEditId: data.edit?.id ?? null, createRequested: page.url.searchParams.get('modal') === 'create', saveFailed, failedEditId: saveFailed ? form?.values?.id || null : null }));
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const input = 'control-base mt-1.5';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  function href(changes: Record<string, string | number>) { const p = new URLSearchParams(page.url.searchParams); for (const [key, value] of Object.entries(changes)) { if (value === '') p.delete(key); else p.set(key, String(value)); } return '?' + p; }
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function openEdit(id: string) { requestedEditId = id; formOpen = true; }
  function jakartaDateTimeLocal(value: Date | string | null | undefined) { if (!value) return ''; const instant = new Date(value); const local = new Date(instant.getTime() + 7 * 60 * 60 * 1000); const pad = (number: number) => String(number).padStart(2, '0'); return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`; }
  function periodState(row: { krsMulaiAt: Date | string | null; krsSelesaiAt: Date | string | null }) { if (!row.krsMulaiAt || !row.krsSelesaiAt) return 'Belum dijadwalkan'; const now = new Date(); if (now < new Date(row.krsMulaiAt)) return 'Belum dibuka'; if (now >= new Date(row.krsSelesaiAt)) return 'Sudah ditutup'; return 'Sedang dibuka'; }
  $effect(() => { const state = editModal; if (queryEditId && requestedEditId === queryEditId) requestedEditId = null; if (state.open) formOpen = true; else if (requestedEditId === null) formOpen = false; });
</script>
<svelte:head><title>Semester · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Perkuliahan" title="Semester" description="Pilih periode akademik aktif secara eksplisit dan pertahankan seluruh riwayat semester.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={href({ edit: '', modal: 'create' })} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => { requestedEditId = null; formOpen = true; }}><Icon name="plus" size={16} /> Tambah Semester</a>{/snippet}</PageHeader>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<form method="GET" class={box + ' grid gap-4 sm:grid-cols-4'} use:seamlessFilter>
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
    <thead class="border-b text-slate-500"><tr>{#each ['Kode', 'Nama', 'Tahun Akademik', 'Jenis', 'Tanggal Mulai', 'Tanggal Selesai', 'Periode KRS', 'Status Aktif', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100">
      <td class="p-3">{row.kode}</td><td class="p-3">{row.nama}</td><td class="p-3">{row.tahunMulai}/{row.tahunMulai + 1}</td><td class="p-3">{row.jenis}</td><td class="p-3 whitespace-nowrap">{row.tanggalMulai}</td><td class="p-3 whitespace-nowrap">{row.tanggalSelesai}</td>
      <td class="p-3"><Badge tone={periodState(row) === 'Sedang dibuka' ? 'success' : periodState(row) === 'Sudah ditutup' ? 'danger' : 'neutral'}>{periodState(row)}</Badge><span class="mt-1 block whitespace-nowrap text-xs text-slate-500">{row.krsMulaiAt ? new Date(row.krsMulaiAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}{row.krsSelesaiAt ? ` – ${new Date(row.krsSelesaiAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}` : ''}</span></td>
      <td class="p-3"><Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Semester aktif' : 'Tidak dipilih'}</Badge></td>
      <td class="p-3"><a class="text-teal-800" aria-label={`Edit ${row.nama}`} href={editQueryHref(page.url, row.id)} data-sveltekit-noscroll data-sveltekit-keepfocus onclick={() => openEdit(row.id)}>Edit</a>
        {#if !row.isActive}<details class="mt-2"><summary class="cursor-pointer text-teal-800">Aktifkan</summary><p class="my-2">Ganti semester aktif menjadi {row.nama}?</p><form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="activate" /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, aktifkan semester</button></form></details>{/if}
      </td></tr>{:else}<tr><td colspan="9" class="p-8 text-center text-slate-500">Tidak ada semester yang cocok.</td></tr>{/each}</tbody>
  </table></div>
  <Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<Modal bind:open={formOpen} title={`${editModal.editing ? 'Edit' : 'Tambah'} Semester`} description={editModal.loading ? 'Menyiapkan data untuk disunting.' : undefined} closeDisabled={saving} width="lg" onClose={() => { const shouldClear = requestedEditId !== null || queryEditId || page.url.searchParams.has('modal') || form?.values?.mode === 'save'; requestedEditId = null; if (shouldClear) void goto(clearEditQueryHref(page.url), { replaceState: true, ...modalNavigationOptions }); }}>
  {#if editModal.loading}
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600" role="status">Memuat data semester…</div>
  {:else}
  <p class="mt-2 text-sm text-slate-500">Kode: tahun mulai diikuti 1 untuk Ganjil atau 2 untuk Genap. Identitas dan tanggal dengan riwayat KRS disetujui atau jadwal dipertahankan.</p>
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values?.mode === 'save' ? form.values : {}} fields={[
      { name: 'kode', label: 'Kode', value: data.edit?.kode, maxlength: 5 }, { name: 'nama', label: 'Nama', value: data.edit?.nama, maxlength: 100 },
      { name: 'tahun_mulai', label: 'Tahun mulai', type: 'number', min: 1900, max: 9998, value: data.edit?.tahunMulai },
      { name: 'jenis', label: 'Jenis', value: data.edit?.jenis ?? 'GANJIL', options: ['GANJIL', 'GENAP'].map(value => ({ value, label: value })) },
      { name: 'tanggal_mulai', label: 'Tanggal Mulai', type: 'date', value: data.edit?.tanggalMulai }, { name: 'tanggal_selesai', label: 'Tanggal Selesai', type: 'date', value: data.edit?.tanggalSelesai },
      { name: 'krs_mulai_at', label: 'KRS mulai (WIB)', type: 'datetime-local', required: false, value: jakartaDateTimeLocal(data.edit?.krsMulaiAt) }, { name: 'krs_selesai_at', label: 'KRS selesai (WIB)', type: 'datetime-local', required: false, value: jakartaDateTimeLocal(data.edit?.krsSelesaiAt) },
    ]} />
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>{/key}
  {/if}
</Modal>
