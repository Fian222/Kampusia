<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import Pagination from './Pagination.svelte';
  import type { loadLecturerClass } from '$lib/server/attendance';
  import Badge from './ui/Badge.svelte';
  import Icon from './ui/Icon.svelte';
  type Data = Awaited<ReturnType<typeof loadLecturerClass>>;
  let { meetings, area, form }: { meetings: Data['meetings']; area: 'akademik' | 'dosen'; form?: { message?: string; saved?: boolean; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  const action = $derived(area === 'akademik' ? '?/meeting' : '?');
  const button = 'min-h-9 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('meeting_page', String(number)); return '?' + params; }
</script>

<section class="surface-panel mt-6 overflow-hidden">
  <div class="p-5 sm:p-6"><p class="eyebrow">Aktivitas kelas</p><h2 class="mt-2 text-xl font-bold">Pertemuan Kuliah</h2>
  <p class="mt-2 text-sm text-slate-500">Pertemuan mencatat kejadian aktual dan tidak harus sama dengan jadwal mingguan. Pertemuan selesai atau dibatalkan tetap disimpan.</p>
  {#if form?.message}<p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm" role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
  {#if saving}<p class="mt-3 text-sm" role="status">Menyimpan…</p>{/if}
  </div><div class="overflow-x-auto border-t border-slate-100"><table class="min-w-[760px] w-full text-left text-sm">
    <thead><tr><th class="p-3">Ke</th><th class="p-3">Tanggal</th><th class="p-3">Waktu</th><th class="p-3">Materi</th><th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody class="divide-y divide-slate-100">{#each meetings.data as row}<tr class="align-top">
      <td class="p-3">{row.nomorPertemuan}</td><td class="p-3">{row.tanggal}</td><td class="p-3">{row.jamMulai.slice(0, 5)}–{row.jamSelesai.slice(0, 5)}</td><td class="p-3">{row.materi ?? '—'}</td>
      <td class="p-3"><Badge tone={row.status === 'SELESAI' ? 'success' : row.status === 'TERJADWAL' ? 'info' : 'danger'}>{row.status}</Badge></td>
      <td class="min-w-64 p-3"><a class="inline-flex items-center gap-1 font-semibold text-brand-700" href={`/${area}/pertemuan/${row.id}`}>Buka absensi <Icon name="arrow-right" size={14} /></a>
        {#if row.status !== 'DIBATALKAN'}<details class="mt-2"><summary class="cursor-pointer font-medium text-brand-700">{row.status === 'SELESAI' ? 'Koreksi fakta' : 'Edit'}</summary>
          <form method="POST" {action} class="mt-3 grid gap-2" use:enhance={submit}>
            <input type="hidden" name="mode" value="meeting-save" /><input type="hidden" name="pertemuan_id" value={row.id} />
            {#if row.status === 'SELESAI'}<input type="hidden" name="koreksi" value="yes" />{/if}
            <label>Nomor <input class="w-full rounded border p-2 disabled:bg-slate-100" name="nomor_pertemuan" type="number" min="1" max="32767" value={row.nomorPertemuan} disabled={row.status === 'SELESAI'} /></label>
            <label>Tanggal <input class="w-full rounded border p-2" name="tanggal" type="date" value={row.tanggal} required /></label>
            <div class="grid grid-cols-2 gap-2"><label>Mulai <input class="w-full rounded border p-2" name="jam_mulai" type="time" value={row.jamMulai.slice(0, 5)} required /></label><label>Selesai <input class="w-full rounded border p-2" name="jam_selesai" type="time" value={row.jamSelesai.slice(0, 5)} required /></label></div>
            <label>Materi <textarea class="w-full rounded border p-2" name="materi">{row.materi ?? ''}</textarea></label>
            {#if row.status === 'SELESAI'}<input type="hidden" name="nomor_pertemuan" value={row.nomorPertemuan} />{/if}
            <button class={button} disabled={saving}>Simpan</button>
          </form></details>{/if}
        {#if row.status === 'TERJADWAL'}
          <details class="mt-2"><summary class="cursor-pointer text-red-700">Batalkan</summary><form method="POST" {action} class="mt-2" use:enhance={submit}><input type="hidden" name="mode" value="meeting-cancel" /><input type="hidden" name="pertemuan_id" value={row.id} /><label class="mr-2"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi</label><button class={button} disabled={saving}>Batalkan</button></form></details>
        {/if}
      </td>
    </tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada pertemuan.</td></tr>{/each}</tbody>
  </table></div>
  <div class="px-5 pb-4 sm:px-6"><Pagination {...meetings.meta} {href} /></div>
</section>

<section class="surface-panel mt-6 p-5 sm:p-6">
  <h2 class="font-bold">Buat Pertemuan</h2>
  <form method="POST" {action} class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
    <input type="hidden" name="mode" value="meeting-save" />
    <label class="text-sm">Nomor pertemuan<input class="mt-1 w-full rounded-lg border border-slate-300 p-2" name="nomor_pertemuan" type="number" min="1" max="32767" required /></label>
    <label class="text-sm">Tanggal<input class="mt-1 w-full rounded-lg border border-slate-300 p-2" name="tanggal" type="date" required /></label>
    <label class="text-sm">Jam mulai<input class="mt-1 w-full rounded-lg border border-slate-300 p-2" name="jam_mulai" type="time" required /></label>
    <label class="text-sm">Jam selesai<input class="mt-1 w-full rounded-lg border border-slate-300 p-2" name="jam_selesai" type="time" required /></label>
    <label class="text-sm sm:col-span-2">Materi (opsional)<textarea class="mt-1 w-full rounded-lg border border-slate-300 p-2" name="materi"></textarea></label>
    <div><button class={button} disabled={saving}>Buat pertemuan</button></div>
  </form>
</section>
