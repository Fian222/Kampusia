<script lang="ts">
  import { enhance } from '$app/forms';
  import type { loadAttendance } from '$lib/server/attendance';
  type Data = Awaited<ReturnType<typeof loadAttendance>>['roster'];
  let { roster, area, form }: { roster: Data; area: 'akademik' | 'dosen'; form?: { message?: string; saved?: boolean } | null } = $props();
  let saving = $state(false);
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  const button = 'rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50';
</script>
<svelte:head><title>Absensi Pertemuan {roster.pertemuan.nomorPertemuan} · Kampusia</title></svelte:head>
<h1 class="text-3xl font-semibold">Absensi Pertemuan {roster.pertemuan.nomorPertemuan}</h1>
<p class="mt-2 text-slate-600">{roster.pertemuan.kelas.mataKuliah.kode} — {roster.pertemuan.kelas.mataKuliah.nama} / {roster.pertemuan.kelas.namaKelas}</p>
<p class="mt-1 text-sm text-slate-500">{roster.pertemuan.tanggal} · {roster.pertemuan.jamMulai.slice(0, 5)}–{roster.pertemuan.jamSelesai.slice(0, 5)} · {roster.pertemuan.status}</p>
{#if form?.message}<p class="mt-5 rounded-xl border border-slate-200 bg-white p-4" role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
<section class="mt-6 grid gap-3 sm:grid-cols-3">
  <div class="rounded-xl border bg-white p-4"><span class="text-sm text-slate-500">Peserta efektif</span><p class="text-2xl font-semibold">{roster.summary.total}</p></div>
  <div class="rounded-xl border bg-white p-4"><span class="text-sm text-slate-500">Sudah dicatat</span><p class="text-2xl font-semibold text-teal-700">{roster.summary.recorded}</p></div>
  <div class="rounded-xl border border-amber-200 bg-amber-50 p-4"><span class="text-sm text-amber-800">Belum dicatat</span><p class="text-2xl font-semibold text-amber-900">{roster.summary.missing}</p></div>
</section>
<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">Daftar Kehadiran</h2><p class="mt-1 text-sm text-slate-500">Belum dicatat bukan ALPHA. Pilih ALPHA hanya bila memang menjadi hasil kehadiran.</p></div>
  {#if roster.pertemuan.status === 'TERJADWAL'}<form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="complete" /><label class="mr-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi lengkap</label><button class={button} disabled={saving}>Selesaikan pertemuan</button></form>{/if}</div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-3">NIM</th><th class="p-3">Nama</th><th class="p-3">Status</th><th class="p-3">Keterangan</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody>{#each roster.data as row}<tr class="border-b border-slate-100"><td class="p-3">{row.mahasiswa.nim}</td><td class="p-3">{row.mahasiswa.nama}</td><td class="p-3">{#if !row.absensi}<span class="rounded-full bg-amber-100 px-2 py-1 text-amber-900">Belum dicatat</span>{:else}<span class="rounded-full bg-teal-50 px-2 py-1 text-teal-800">{row.absensi.status}</span>{/if}</td>
      <td colspan="2" class="p-3"><form method="POST" class="flex min-w-96 flex-wrap gap-2" use:enhance={submit}>
        <input type="hidden" name="mode" value={row.absensi ? 'correct' : 'record'} /><input type="hidden" name="mahasiswa_id" value={row.mahasiswa.id} />
        {#if !row.absensi && roster.pertemuan.status === 'SELESAI' && area === 'akademik'}<input type="hidden" name="koreksi_terlambat" value="yes" />{/if}
        <select class="rounded border p-2" name="status" required><option value="" selected={!row.absensi}>Pilih status</option>{#each ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as value}<option {value} selected={row.absensi?.status === value}>{value}</option>{/each}</select>
        <input class="min-w-48 flex-1 rounded border p-2" name="keterangan" placeholder={roster.pertemuan.status === 'SELESAI' ? 'Alasan koreksi (wajib)' : 'Keterangan (opsional)'} value={row.absensi?.keterangan ?? ''} required={roster.pertemuan.status === 'SELESAI'} />
        <button class={button} disabled={saving || roster.pertemuan.status === 'DIBATALKAN' || (!row.absensi && roster.pertemuan.status === 'SELESAI' && area === 'dosen')}>{row.absensi ? 'Koreksi' : 'Catat'}</button>
      </form></td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada mahasiswa dengan KRS efektif.</td></tr>{/each}</tbody>
  </table></div>
</section>
{#if roster.historical.length}<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 class="font-semibold">Riwayat peserta nonaktif</h2><p class="mt-2 text-sm text-slate-500">Catatan ini dipertahankan meskipun KRS tidak lagi efektif dan hanya diperbarui melalui koreksi pada baris yang sama.</p>
  <div class="mt-4 space-y-3">{#each roster.historical as row}<form method="POST" class="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3" use:enhance={submit}>
    <input type="hidden" name="mode" value="correct" /><input type="hidden" name="mahasiswa_id" value={row.mahasiswa.id} />
    <span class="min-w-52 font-medium">{row.mahasiswa.nim} — {row.mahasiswa.nama}</span>
    <select class="rounded border p-2" name="status" required>{#each ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as value}<option {value} selected={row.status === value}>{value}</option>{/each}</select>
    <input class="min-w-52 flex-1 rounded border p-2" name="keterangan" value={row.keterangan ?? ''} placeholder={roster.pertemuan.status === 'SELESAI' ? 'Alasan koreksi (wajib)' : 'Keterangan'} required={roster.pertemuan.status === 'SELESAI'} />
    <button class={button} disabled={saving || roster.pertemuan.status === 'DIBATALKAN'}>Koreksi</button>
  </form>{/each}</div>
</section>{/if}
