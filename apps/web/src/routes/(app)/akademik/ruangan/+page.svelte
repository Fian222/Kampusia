<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let formOpen = $state(false);
  let openedEditId = $state<string>();
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const input = 'control-base mt-1.5';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  function href(changes: Record<string, string | number>) { const p = new URLSearchParams(page.url.searchParams); for (const [key, value] of Object.entries(changes)) { if (value === '') p.delete(key); else p.set(key, String(value)); } return '?' + p; }
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  $effect(() => { if (page.url.searchParams.get('modal') === 'create') { openedEditId = undefined; formOpen = true; } if (form?.values?.mode === 'save') formOpen = true; if (data.edit?.id && data.edit.id !== openedEditId) { openedEditId = data.edit.id; formOpen = true; } });
</script>
<svelte:head><title>Ruangan · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Fasilitas" title="Ruangan" description="Kelola ruang kuliah dan kapasitasnya tanpa menghilangkan riwayat jadwal.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={href({ edit: '', modal: 'create' })} onclick={() => { if (!data.edit) formOpen = true; }}><Icon name="plus" size={16} /> Tambah Ruangan</a>{/snippet}</PageHeader>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<form method="GET" class={box + ' grid gap-4 sm:grid-cols-3'}>
  <label class="text-sm">Cari kode atau nama<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  <label class="text-sm">Status<select class={input} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
  <div class="self-end"><button class={button}>Terapkan</button> <a href={page.url.pathname}>Reset</a></div>
</form>
<section class={box}>
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Ruangan</h2></div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="border-b text-slate-500"><tr>{#each ['Kode', 'Nama', 'Gedung', 'Kapasitas', 'Status', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100">
      <td class="p-3">{row.kode}</td><td class="p-3">{row.nama}</td><td class="p-3">{row.gedung ?? '—'}</td><td class="p-3">{row.kapasitas}</td><td class="p-3"><StatusBadge active={row.isActive} /></td>
      <td class="p-3"><a class="text-teal-800" aria-label={`Edit ${row.nama}`} href={href({ edit: row.id, modal: '' })} onclick={() => { if (data.edit?.id === row.id) formOpen = true; }}>Edit</a>
        <details class="mt-2"><summary class="cursor-pointer text-teal-800">{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</summary><p class="my-2">Ubah status ruangan {row.nama}?</p><form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="is_active" value={String(!row.isActive)} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, ubah status</button></form></details>
      </td></tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada ruangan yang cocok.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<Modal bind:open={formOpen} title={`${data.edit ? 'Edit' : 'Tambah'} Ruangan`} description="Kapasitas harus mendukung seluruh kelas yang menggunakan ruangan." closeDisabled={saving} width="lg" onClose={() => { if (data.edit || page.url.searchParams.has('modal') || form?.values?.mode === 'save') void goto(href({ edit: '', modal: '' }), { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'save'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" class="grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') formOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values?.mode === 'save' ? form.values : {}} fields={[
      { name: 'kode', label: 'Kode', value: data.edit?.kode, maxlength: 30 }, { name: 'nama', label: 'Nama', value: data.edit?.nama, maxlength: 100 },
      { name: 'kapasitas', label: 'Kapasitas', type: 'number', min: 1, max: 2147483647, value: data.edit?.kapasitas },
    ]} />
    <label class="text-sm font-medium">Gedung (opsional)<input class={input} name="gedung" maxlength="100" value={form?.values?.mode === 'save' ? form.values.gedung : data.edit?.gedung ?? ''} /></label>
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => formOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>{/key}
</Modal>
