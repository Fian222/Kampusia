<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Pagination from './Pagination.svelte';
  import type { loadLecturerClass } from '$lib/server/attendance';
  import Badge from './ui/Badge.svelte';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';
  import { academicDateIso, formatAcademicDate } from '$lib/date-format';
  type Data = Awaited<ReturnType<typeof loadLecturerClass>>;
  let { meetings, area, form }: { meetings: Data['meetings']; area: 'akademik' | 'dosen'; form?: { message?: string; saved?: boolean; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let meetingOpen = $state(false);
  let editingId = $state<string>();
  const action = '?/meeting';
  const button = 'min-h-9 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('meeting_page', String(number)); return '?' + params; }
  const editing = $derived(meetings.data.find(row => row.id === editingId));
  const failed = $derived(form?.values?.mode === 'meeting-save' && (form.values.pertemuan_id ?? '') === (editingId ?? '') ? form.values : undefined);
  function field(name: string, fallback: string | number | null | undefined) { return failed?.[name] ?? String(fallback ?? ''); }
  $effect(() => {
    if (form?.values?.mode === 'meeting-save' && !form.saved) {
      editingId = form.values.pertemuan_id || undefined;
      meetingOpen = true;
    }
  });
</script>

<section class="surface-panel mt-6 overflow-hidden">
  <div class="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6"><div><p class="eyebrow">Aktivitas kelas</p><h2 class="mt-2 text-xl font-bold">Pertemuan Kuliah</h2>
  <p class="mt-2 text-sm text-slate-500">Pertemuan mencatat kejadian aktual dan tidak harus sama dengan jadwal mingguan. Pertemuan selesai atau dibatalkan tetap disimpan.</p>
  {#if form?.message}<p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm" role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
  {#if saving}<p class="mt-3 text-sm" role="status">Menyimpan…</p>{/if}
  </div><button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" onclick={() => { editingId = undefined; meetingOpen = true; }}><Icon name="plus" size={16} /> Buat Pertemuan</button></div><div class="overflow-x-auto border-t border-slate-100"><table class="min-w-[760px] w-full text-left text-sm">
    <thead><tr><th class="p-3">Ke</th><th class="p-3">Tanggal</th><th class="p-3">Waktu</th><th class="p-3">Materi</th><th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody class="divide-y divide-slate-100">{#each meetings.data as row}<tr class="align-top">
      <td class="p-3">{row.nomorPertemuan}</td><td class="p-3">{formatAcademicDate(row.tanggal)}</td><td class="p-3">{row.jamMulai.slice(0, 5)}–{row.jamSelesai.slice(0, 5)}</td><td class="p-3">{row.materi ?? '—'}</td>
      <td class="p-3"><Badge tone={row.status === 'SELESAI' ? 'success' : row.status === 'TERJADWAL' ? 'info' : 'danger'}>{row.status}</Badge></td>
      <td class="min-w-64 p-3"><a class="inline-flex items-center gap-1 font-semibold text-brand-700" href={`/${area}/pertemuan/${row.id}`}>Buka absensi <Icon name="arrow-right" size={14} /></a>
        {#if row.status !== 'DIBATALKAN'}<button type="button" class="mt-2 block font-medium text-brand-700" aria-label={`${row.status === 'SELESAI' ? 'Koreksi fakta' : 'Edit'} pertemuan ${row.nomorPertemuan}`} onclick={() => { editingId = row.id; meetingOpen = true; }}>{row.status === 'SELESAI' ? 'Koreksi fakta' : 'Edit'}</button>{/if}
        {#if row.status === 'TERJADWAL'}
          <details class="mt-2"><summary class="cursor-pointer text-red-700">Batalkan</summary><form method="POST" {action} class="mt-2" use:enhance={submit}><input type="hidden" name="mode" value="meeting-cancel" /><input type="hidden" name="pertemuan_id" value={row.id} /><label class="mr-2"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi</label><button class={button} disabled={saving}>Batalkan</button></form></details>
        {/if}
      </td>
    </tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada pertemuan.</td></tr>{/each}</tbody>
  </table></div>
  <div class="px-5 pb-4 sm:px-6"><Pagination {...meetings.meta} {href} /></div>
</section>

<Modal bind:open={meetingOpen} title={`${editing ? (editing.status === 'SELESAI' ? 'Koreksi' : 'Edit') : 'Buat'} Pertemuan`} description="Pertemuan mencatat waktu dan materi aktual kelas." closeDisabled={saving} width="lg" onClose={() => { if (form?.values?.mode === 'meeting-save') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && failed}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key editingId + JSON.stringify(failed)}
  <form method="POST" {action} class="grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') meetingOpen = false; } finally { saving = false; } }; }}>
    <input type="hidden" name="mode" value="meeting-save" /><input type="hidden" name="pertemuan_id" value={editing?.id ?? ''} />
    {#if editing?.status === 'SELESAI'}<input type="hidden" name="koreksi" value="yes" />{/if}
    <label class="text-sm">Nomor pertemuan<input class="control-base mt-1.5 disabled:bg-slate-100" name="nomor_pertemuan" type="number" min="1" max="32767" value={field('nomor_pertemuan', editing?.nomorPertemuan)} disabled={editing?.status === 'SELESAI'} required /></label>
    <label class="text-sm">Tanggal<input class="control-base mt-1.5" name="tanggal" type="date" value={field('tanggal', editing?.tanggal ? academicDateIso(editing.tanggal) : '')} required /></label>
    <label class="text-sm">Jam mulai<input class="control-base mt-1.5" name="jam_mulai" type="time" value={field('jam_mulai', editing?.jamMulai.slice(0, 5))} required /></label>
    <label class="text-sm">Jam selesai<input class="control-base mt-1.5" name="jam_selesai" type="time" value={field('jam_selesai', editing?.jamSelesai.slice(0, 5))} required /></label>
    <label class="text-sm sm:col-span-2">Materi (opsional)<textarea class="control-base mt-1.5" name="materi">{field('materi', editing?.materi)}</textarea></label>
    {#if editing?.status === 'SELESAI'}<input type="hidden" name="nomor_pertemuan" value={editing.nomorPertemuan} />{/if}
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => meetingOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan pertemuan'}</button></div>
  </form>
  {/key}
</Modal>
