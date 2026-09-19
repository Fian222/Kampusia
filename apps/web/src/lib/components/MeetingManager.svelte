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
  const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('meeting_page', String(number)); return '?' + params; }
  const editing = $derived(meetings.data.find(row => row.id === editingId));
  const failed = $derived(form?.values?.mode === 'meeting-save' && (form.values.pertemuan_id ?? '') === (editingId ?? '') ? form.values : undefined);
  function field(name: string, fallback: string | number | null | undefined) { return failed?.[name] ?? String(fallback ?? ''); }
  function statusLabel(status: string) { return status === 'TERJADWAL' ? 'Terbuka' : status === 'SELESAI' ? 'Absensi selesai' : 'Dibatalkan'; }
  function formatTime(value: string) { return value.slice(0, 5).replace(':', '.'); }
  function attendanceAction(status: string, recorded: number, total: number) {
    if (status === 'SELESAI') return 'Lihat Absensi';
    if (status === 'DIBATALKAN') return 'Lihat Detail';
    if (recorded === 0) return 'Isi Absensi';
    if (recorded < total) return 'Lanjutkan Absensi';
    return 'Periksa Absensi';
  }
  $effect(() => {
    if (area === 'akademik' && form?.values?.mode === 'meeting-save' && !form.saved) {
      editingId = form.values.pertemuan_id || undefined;
      meetingOpen = true;
    }
  });
</script>

<section class="surface-panel mt-6 overflow-hidden">
  <div class="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
    <div>
      <p class="eyebrow">{area === 'akademik' ? 'Pengelolaan akademik' : 'Ruang kerja absensi'}</p>
      <h2 class="mt-2 text-xl font-bold">{area === 'akademik' ? 'Pertemuan Kuliah' : 'Absensi Pertemuan'}</h2>
      <p class="mt-2 max-w-3xl text-sm text-slate-500">
        {area === 'akademik'
          ? 'Buka pertemuan dan pantau pencatatan absensi kelas.'
          : 'Catat kehadiran pada pertemuan yang telah dibuka Akademik. Data pertemuan dikelola oleh Akademik.'}
      </p>
      {#if area === 'akademik' && form?.message && form.values?.mode?.startsWith('meeting-')}<p class="mt-4 rounded-lg bg-slate-50 p-3 text-sm" role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
      {#if saving}<p class="mt-3 text-sm" role="status">Menyimpan…</p>{/if}
    </div>
    {#if area === 'akademik'}
      <button type="button" class="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" onclick={() => { editingId = undefined; meetingOpen = true; }}><Icon name="plus" size={16} /> Buka Pertemuan</button>
    {/if}
  </div>

  <div class="grid gap-3 border-t border-slate-100 p-4 sm:p-5 lg:grid-cols-2">
    {#each meetings.data as row}
      <article class={`rounded-xl border p-4 ${row.status === 'SELESAI' ? 'border-slate-200 bg-slate-50/70' : row.status === 'DIBATALKAN' ? 'border-red-100 bg-red-50/30' : 'border-brand-100 bg-white'}`}>
        <div class="flex items-start justify-between gap-3">
          <div><p class="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Pertemuan {row.nomorPertemuan}</p><h3 class="mt-1 font-bold text-slate-950">{formatAcademicDate(row.tanggal)} · {formatTime(row.jamMulai)}–{formatTime(row.jamSelesai)}</h3>{#if row.materi}<p class="mt-1 text-sm text-slate-500">{row.materi}</p>{/if}</div>
          <Badge tone={row.status === 'SELESAI' ? 'success' : row.status === 'TERJADWAL' ? 'info' : 'danger'}>{statusLabel(row.status)}</Badge>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div><p class="text-sm font-semibold text-slate-800">{row.attendanceProgress.recorded} / {row.attendanceProgress.total} tercatat</p><p class="mt-0.5 text-xs text-slate-500">{row.status === 'SELESAI' ? 'Absensi sudah selesai dan hanya dapat dikoreksi oleh Akademik.' : `${row.attendanceProgress.total} mahasiswa efektif`}</p></div>
          <div class="flex flex-wrap items-center gap-3">
            <a class={button} href={`/${area}/pertemuan/${row.id}`}>{area === 'dosen' ? attendanceAction(row.status, row.attendanceProgress.recorded, row.attendanceProgress.total) : 'Awasi Absensi'} <Icon name="arrow-right" size={14} /></a>
            {#if area === 'akademik' && row.status !== 'DIBATALKAN'}
              <button type="button" class="text-sm font-semibold text-brand-700" aria-label={`${row.status === 'SELESAI' ? 'Koreksi fakta' : 'Edit'} pertemuan ${row.nomorPertemuan}`} onclick={() => { editingId = row.id; meetingOpen = true; }}>{row.status === 'SELESAI' ? 'Koreksi fakta' : 'Edit'}</button>
            {/if}
            {#if area === 'akademik' && row.status === 'TERJADWAL'}
              <details class="relative"><summary class="inline-flex size-9 list-none items-center justify-center rounded-lg text-lg font-bold tracking-widest text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label={`Tindakan lain pertemuan ${row.nomorPertemuan}`}><span aria-hidden="true">•••</span></summary><form method="POST" {action} class="mt-2 min-w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:absolute sm:right-0 sm:z-10" use:enhance={submit}><input type="hidden" name="mode" value="meeting-cancel" /><input type="hidden" name="pertemuan_id" value={row.id} /><p class="text-xs leading-5 text-slate-600">Pertemuan yang dibatalkan tetap tersimpan dalam riwayat kelas.</p><label class="mt-2 flex items-start gap-2 text-xs text-slate-700"><input class="mt-0.5" type="checkbox" name="confirm" value="yes" required /> Konfirmasi pembatalan</label><button class="action-danger mt-2" disabled={saving}>Batalkan Pertemuan</button></form></details>
            {/if}
          </div>
        </div>
      </article>
    {:else}
      <p class="p-6 text-center text-sm text-slate-500 lg:col-span-2">{area === 'akademik' ? 'Belum ada pertemuan. Buka pertemuan pertama agar dosen dapat mulai mencatat absensi.' : 'Belum ada pertemuan yang dibuka oleh Akademik.'}</p>
    {/each}
  </div>
  <div class="px-5 pb-4 sm:px-6"><Pagination {...meetings.meta} {href} /></div>
</section>

{#if area === 'akademik'}
  <Modal bind:open={meetingOpen} title={`${editing ? (editing.status === 'SELESAI' ? 'Koreksi' : 'Edit') : 'Buka'} Pertemuan`} description="Membuka pertemuan membuatnya langsung tersedia bagi dosen pengajar untuk absensi." closeDisabled={saving} width="lg" onClose={() => { if (form?.values?.mode === 'meeting-save') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
    {#if form?.message && failed}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
    {#key editingId + JSON.stringify(failed)}
      <form method="POST" {action} class="grid gap-4 sm:grid-cols-2" use:enhance={() => { saving = true; return async ({ update, result }) => { try { await update({ reset: false }); if (result.type === 'success') meetingOpen = false; } finally { saving = false; } }; }}>
        <input type="hidden" name="mode" value="meeting-save" /><input type="hidden" name="pertemuan_id" value={editing?.id ?? ''} />
        {#if editing?.status === 'SELESAI'}<input type="hidden" name="koreksi" value="yes" />{/if}
        <label class="text-sm">Nomor pertemuan<input class="control-base mt-1.5 disabled:bg-slate-100" name="nomor_pertemuan" type="number" min="1" max="32767" value={field('nomor_pertemuan', editing?.nomorPertemuan ?? meetings.nextMeetingNumber)} disabled={editing?.status === 'SELESAI'} required /></label>
        <label class="text-sm">Tanggal<input class="control-base mt-1.5" name="tanggal" type="date" value={field('tanggal', editing?.tanggal ? academicDateIso(editing.tanggal) : '')} required /></label>
        <label class="text-sm">Jam mulai<input class="control-base mt-1.5" name="jam_mulai" type="time" value={field('jam_mulai', editing?.jamMulai.slice(0, 5))} required /></label>
        <label class="text-sm">Jam selesai<input class="control-base mt-1.5" name="jam_selesai" type="time" value={field('jam_selesai', editing?.jamSelesai.slice(0, 5))} required /></label>
        <label class="text-sm sm:col-span-2">Materi (opsional)<textarea class="control-base mt-1.5" name="materi">{field('materi', editing?.materi)}</textarea></label>
        {#if editing?.status === 'SELESAI'}<input type="hidden" name="nomor_pertemuan" value={editing.nomorPertemuan} />{/if}
        <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => meetingOpen = false}>Batal</button><button class={button} disabled={saving}>{saving ? 'Menyimpan…' : editing ? 'Simpan Pertemuan' : 'Buka Pertemuan'}</button></div>
      </form>
    {/key}
  </Modal>
{/if}
