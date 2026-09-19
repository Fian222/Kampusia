<script lang="ts">
  import { enhance } from '$app/forms';
  import type { loadAttendance } from '$lib/server/attendance';
  import { formatAcademicDate } from '$lib/date-format';
  import PageHeader from './ui/PageHeader.svelte';
  import StatCard from './ui/StatCard.svelte';
  import Badge from './ui/Badge.svelte';
  type Data = Awaited<ReturnType<typeof loadAttendance>>['roster'];
  let { roster, area, form }: { roster: Data; area: 'akademik' | 'dosen'; form?: { message?: string; saved?: boolean } | null } = $props();
  let saving = $state(false);
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  const button = 'min-h-10 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50';
  function tone(status: string) { return status === 'HADIR' ? 'success' as const : status === 'ALPHA' ? 'danger' as const : status === 'IZIN' || status === 'SAKIT' ? 'info' as const : 'warning' as const; }
  function meetingLabel(status: string) { return status === 'TERJADWAL' ? 'Terbuka' : status === 'SELESAI' ? 'Absensi selesai' : 'Dibatalkan'; }
  const readOnly = $derived(roster.pertemuan.status === 'DIBATALKAN' || (roster.pertemuan.status === 'SELESAI' && area === 'dosen'));
</script>

<svelte:head><title>Absensi Pertemuan {roster.pertemuan.nomorPertemuan} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`${roster.pertemuan.kelas.mataKuliah.kode} / Kelas ${roster.pertemuan.kelas.namaKelas}`} title={`Absensi Pertemuan ${roster.pertemuan.nomorPertemuan}`} description={`${roster.pertemuan.kelas.mataKuliah.nama} · ${formatAcademicDate(roster.pertemuan.tanggal)} · ${roster.pertemuan.jamMulai.slice(0, 5)}–${roster.pertemuan.jamSelesai.slice(0, 5)}`} />
<div class="mt-4 flex flex-wrap items-center gap-3">
  <Badge tone={roster.pertemuan.status === 'SELESAI' ? 'success' : roster.pertemuan.status === 'DIBATALKAN' ? 'danger' : 'info'}>{meetingLabel(roster.pertemuan.status)}</Badge>
  {#if roster.pertemuan.status === 'SELESAI' && area === 'dosen'}<span class="text-sm text-slate-500">Mode baca saja; koreksi pasca-selesai dilakukan oleh Akademik.</span>{/if}
</div>
{#if form?.message}<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4" role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<section class="mt-6 grid gap-3 sm:grid-cols-3">
  <StatCard label="Peserta efektif" value={roster.summary.total} icon="users" />
  <StatCard label="Sudah dicatat" value={roster.summary.recorded} icon="check" accent />
  <StatCard label="Belum dicatat" value={roster.summary.missing} icon="clock" />
</section>
<section class="surface-panel mt-6 overflow-hidden">
  <div class="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
    <div><h2 class="font-bold">Daftar kehadiran</h2><p class="mt-1 text-sm leading-6 text-slate-500"><strong class="font-semibold text-amber-800">Belum dicatat bukan ALPHA.</strong> Pilih ALPHA hanya bila memang menjadi hasil kehadiran.</p></div>
    {#if roster.pertemuan.status === 'TERJADWAL'}
      <form method="POST" class="flex flex-col gap-2 sm:items-end" use:enhance={submit}><input type="hidden" name="mode" value="complete" /><label class="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" value="yes" required /> Semua kehadiran sudah benar</label><button class={button} disabled={saving}>Selesaikan Absensi</button></form>
    {/if}
  </div>
  <div class="overflow-x-auto"><table class="min-w-[900px] w-full text-left text-sm"><thead><tr><th class="px-4 py-3.5">NIM</th><th class="px-4 py-3.5">Nama</th><th class="px-4 py-3.5">Status</th><th class="px-4 py-3.5">{readOnly ? 'Catatan' : 'Pencatatan kehadiran'}</th></tr></thead>
    <tbody class="divide-y divide-slate-100">{#each roster.data as row}<tr class={readOnly ? 'bg-slate-50/50' : ''}><td class="px-4 py-4 font-mono text-xs font-semibold text-slate-700">{row.mahasiswa.nim}</td><td class="px-4 py-4 font-semibold text-slate-900">{row.mahasiswa.nama}</td><td class="px-4 py-4">{#if !row.absensi}<Badge tone="warning">Belum dicatat</Badge>{:else}<Badge tone={tone(row.absensi.status)}>{row.absensi.status}</Badge>{/if}</td>
      <td class="px-4 py-4">
        {#if readOnly}
          <p class="text-sm text-slate-500">{row.absensi?.keterangan ?? (row.absensi ? 'Tanpa keterangan' : 'Tidak ada catatan kehadiran')}</p>
        {:else}
          <form method="POST" class="flex min-w-96 flex-wrap gap-2" use:enhance={submit}>
            <input type="hidden" name="mode" value={row.absensi ? 'correct' : 'record'} /><input type="hidden" name="mahasiswa_id" value={row.mahasiswa.id} />
            {#if !row.absensi && roster.pertemuan.status === 'SELESAI' && area === 'akademik'}<input type="hidden" name="koreksi_terlambat" value="yes" />{/if}
            <select class="min-w-32 rounded-lg border border-slate-300 px-3 py-2" name="status" aria-label={`Status kehadiran ${row.mahasiswa.nama}`} required><option value="" selected={!row.absensi}>Pilih status</option>{#each ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as value}<option {value} selected={row.absensi?.status === value}>{value}</option>{/each}</select>
            <input class="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2" name="keterangan" aria-label={`Keterangan kehadiran ${row.mahasiswa.nama}`} placeholder={roster.pertemuan.status === 'SELESAI' ? 'Alasan koreksi (wajib)' : 'Keterangan (opsional)'} value={row.absensi?.keterangan ?? ''} required={roster.pertemuan.status === 'SELESAI'} />
            <button class={button} disabled={saving}>{row.absensi ? (roster.pertemuan.status === 'SELESAI' ? 'Simpan Koreksi' : 'Perbarui') : 'Catat'}</button>
          </form>
        {/if}
      </td></tr>{:else}<tr><td colspan="4" class="p-8 text-center text-slate-500">Tidak ada mahasiswa dengan KRS efektif.</td></tr>{/each}</tbody>
  </table></div>
</section>
{#if roster.historical.length}<section class="surface-panel mt-6 p-5 sm:p-6"><h2 class="font-bold">Riwayat peserta nonaktif</h2><p class="mt-2 text-sm text-slate-500">Catatan ini dipertahankan meskipun KRS tidak lagi efektif dan hanya diperbarui melalui koreksi pada baris yang sama.</p>
  <div class="mt-4 space-y-3">{#each roster.historical as row}
    {#if readOnly}<div class="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3"><span class="min-w-52 font-medium">{row.mahasiswa.nim} — {row.mahasiswa.nama}</span><Badge tone={tone(row.status)}>{row.status}</Badge><span class="text-sm text-slate-500">{row.keterangan ?? 'Tanpa keterangan'}</span></div>
    {:else}<form method="POST" class="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3" use:enhance={submit}>
      <input type="hidden" name="mode" value="correct" /><input type="hidden" name="mahasiswa_id" value={row.mahasiswa.id} />
      <span class="min-w-52 font-medium">{row.mahasiswa.nim} — {row.mahasiswa.nama}</span>
      <select class="rounded border p-2" name="status" required>{#each ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as value}<option {value} selected={row.status === value}>{value}</option>{/each}</select>
      <input class="min-w-52 flex-1 rounded border p-2" name="keterangan" value={row.keterangan ?? ''} placeholder={roster.pertemuan.status === 'SELESAI' ? 'Alasan koreksi (wajib)' : 'Keterangan'} required={roster.pertemuan.status === 'SELESAI'} />
      <button class={button} disabled={saving}>Simpan Koreksi</button>
    </form>{/if}
  {/each}</div>
</section>{/if}
