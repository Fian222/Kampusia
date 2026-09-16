<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let membershipOpen = $state(false);
  let editingMembershipId = $state<string>();
  let removing = $state<{ id: string; nama: string } | null>(null);
  let dialog: HTMLDialogElement;
  $effect(() => { if (removing && !dialog.open) dialog.showModal(); else if (!removing && dialog.open) dialog.close(); });
  const inputClass = 'control-base mt-1.5';
  const buttonClass = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const sectionClass = 'surface-panel mt-6 p-5 sm:p-6';
  function href(changes: Record<string, string | number>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(changes)) params.set(key, String(value));
    return '?' + params.toString();
  }
  function value(mode: string, id: string, key: string, fallback: string) {
    return form?.values?.mode === mode && (mode === 'add' || form.values.membership_id === id) ? form.values[key] ?? fallback : fallback;
  }
  const submit = () => {
    saving = true;
    return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => {
      try { await update({ reset: false }); removing = null; } finally { saving = false; }
    };
  };
  const editingMembership = $derived(data.memberships.data.find(row => row.id === editingMembershipId));
  $effect(() => {
    if (form?.values?.mode === 'add' && !form.saved) { editingMembershipId = undefined; membershipOpen = true; }
    if (form?.values?.mode === 'update' && !form.saved) { editingMembershipId = form.values.membership_id; membershipOpen = true; }
  });
</script>
<svelte:head><title>{data.curriculum.nama} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`Kurikulum / ${data.curriculum.kode}`} title={data.curriculum.nama} description={`${data.curriculum.programStudi.nama} · Tahun ${data.curriculum.tahunBerlaku}`}>{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" href="/akademik/kurikulum"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}</PageHeader>
<div class="mt-3"><StatusBadge active={data.curriculum.isActive} /></div>
<p class="mt-3 text-sm text-slate-600">Kurikulum yang sudah digunakan mahasiswa mempertahankan mata kuliah dan persyaratannya. Buat versi baru untuk perubahan akademik. Keanggotaan dengan riwayat kelas pada program studi ini tidak dapat dihapus.</p>
{#if saving}<p role="status" class="mt-4 text-sm">Menyimpan perubahan…</p>{/if}
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class={sectionClass}>{form.message}</p>{/if}
<section class={sectionClass} aria-label="Mata kuliah kurikulum">
  <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">Mata Kuliah Kurikulum</h2><button type="button" class={buttonClass} disabled={!data.curriculum.isActive} onclick={() => { editingMembershipId = undefined; membershipOpen = true; }}><span class="inline-flex items-center gap-1.5"><Icon name="plus" size={15} /> Tambah Mata Kuliah</span></button></div>
  <form method="GET" class="mt-4 flex items-end gap-3">
    <label class="grow text-sm">Cari kode atau nama<input class={inputClass} name="search" value={data.query.search} maxlength="150" /></label>
    <button class={buttonClass}>Cari</button>
  </form>
  <div class="mt-4 overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b text-slate-500"><tr><th class="p-3">Kode Mata Kuliah</th><th class="p-3">Nama Mata Kuliah</th><th class="p-3">SKS</th><th class="p-3">Semester Rekomendasi</th><th class="p-3">Wajib/Pilihan</th><th class="p-3">Tindakan</th></tr></thead>
      <tbody>
        {#each data.memberships.data as row (row.id)}
          <tr class="border-b border-slate-100">
            <td class="p-3">{row.mataKuliah.kode}</td><td class="p-3">{row.mataKuliah.nama}{#if !row.mataKuliah.isActive}<span class="block text-xs text-slate-500">Nonaktif</span>{/if}</td><td class="p-3">{row.mataKuliah.sks}</td>
            <td class="p-3">{row.semesterRekomendasi ?? 'Belum ditentukan'}</td>
            <td class="p-3">{row.isWajib ? 'Wajib' : 'Pilihan'}</td>
            <td class="p-3"><div class="flex items-center gap-3"><button type="button" class="font-semibold text-brand-700" aria-label={`Edit ${row.mataKuliah.nama} dalam kurikulum`} onclick={() => { editingMembershipId = row.id; membershipOpen = true; }}>Edit</button><button class="text-red-700" disabled={saving} onclick={() => removing = { id: row.id, nama: row.mataKuliah.nama }}>Hapus</button></div></td>
          </tr>
        {:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada mata kuliah yang cocok.</td></tr>{/each}
      </tbody>
    </table>
  </div>
  <Pagination {...data.memberships.meta} href={number => href({ page: number })} />
</section>
<section class={sectionClass} aria-label="Cari pilihan mata kuliah">
  <h2 class="font-semibold">Pilihan Mata Kuliah Aktif</h2>
  <p class="mt-1 text-sm text-slate-500">Cari atau pindah halaman untuk memilih mata kuliah pada formulir tambah.</p>
  <form method="GET" class="mt-4 flex items-end gap-3">
    {#each [...page.url.searchParams].filter(([key]) => !['course_search', 'course_page'].includes(key)) as [key, entry]}<input type="hidden" name={key} value={entry} />{/each}
    <label class="grow text-sm">Kode atau nama mata kuliah<input class={inputClass} name="course_search" value={data.courseQuery.search} maxlength="150" /></label><button class={buttonClass}>Cari pilihan</button>
  </form>
  <Pagination {...data.courses.meta} href={number => href({ course_page: number })} />
</section>
<Modal bind:open={membershipOpen} title={`${editingMembership ? 'Edit' : 'Tambah'} Mata Kuliah Kurikulum`} description="Atur semester rekomendasi dan sifat wajib atau pilihan." closeDisabled={saving} width="lg" onClose={() => { if (['add', 'update'].includes(form?.values?.mode ?? '')) void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && ['add', 'update'].includes(form.values?.mode ?? '')}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#if !editingMembership && !data.curriculum.isActive}<p class="mb-4 text-sm text-amber-800">Aktifkan kurikulum sebelum menambahkan mata kuliah.</p>{/if}
  {#key editingMembershipId + JSON.stringify(form)}
  <form method="POST" class="grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') membershipOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value={editingMembership ? 'update' : 'add'} /><input type="hidden" name="membership_id" value={editingMembership?.id ?? ''} />
    {#if editingMembership}<p class="rounded-lg bg-slate-50 p-3 text-sm font-semibold sm:col-span-2">{editingMembership.mataKuliah.kode} — {editingMembership.mataKuliah.nama}</p>{:else}<label class="text-sm sm:col-span-2">Mata kuliah<select class={inputClass} name="mata_kuliah_id" required value={value('add', '', 'mata_kuliah_id', '')}><option value="" disabled>Pilih mata kuliah aktif</option>{#each data.courses.data as row}<option value={row.id}>{row.kode} — {row.nama} ({row.sks} SKS)</option>{/each}</select></label>{/if}
    <label class="text-sm">Semester rekomendasi<input class={inputClass} name="semester_rekomendasi" type="number" min="1" max="32767" placeholder="Belum ditentukan" value={value(editingMembership ? 'update' : 'add', editingMembership?.id ?? '', 'semester_rekomendasi', String(editingMembership?.semesterRekomendasi ?? ''))} /></label>
    <label class="text-sm">Wajib/Pilihan<select class={inputClass} name="is_wajib" value={value(editingMembership ? 'update' : 'add', editingMembership?.id ?? '', 'is_wajib', String(editingMembership?.isWajib ?? true))}><option value="true">Wajib</option><option value="false">Pilihan</option></select></label>
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => membershipOpen = false}>Batal</button><button class={buttonClass} disabled={saving || (!editingMembership && !data.curriculum.isActive)}>{saving ? 'Menyimpan…' : 'Simpan'}</button></div>
  </form>
  {/key}
</Modal>
<dialog bind:this={dialog} class="m-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-6 backdrop:bg-slate-900/40" aria-labelledby="remove-title" oncancel={event => { if (saving) event.preventDefault(); else removing = null; }}>
  {#if removing}
    <h2 id="remove-title" class="font-semibold">Hapus {removing.nama} dari kurikulum?</h2>
    <p class="mt-2 text-sm">Penghapusan hanya diperbolehkan bila kurikulum belum digunakan mahasiswa dan keanggotaan tidak memiliki riwayat kelas.</p>
    <form method="POST" class="mt-4 flex gap-4" use:enhance={submit}><input type="hidden" name="mode" value="remove" /><input type="hidden" name="membership_id" value={removing.id} /><button class={buttonClass} disabled={saving}>Ya, hapus keanggotaan</button><button type="button" disabled={saving} onclick={() => removing = null}>Batal</button></form>
  {/if}
</dialog>
