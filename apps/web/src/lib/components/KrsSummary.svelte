<script lang="ts">
  import type { KrsDetailData } from '$lib/server/krs';
  import KrsClasses from './KrsClasses.svelte';
  let { krs }: { krs: KrsDetailData } = $props();
</script>
<div class="my-5 rounded-lg border border-slate-200 bg-white p-5">
  <h2 class="font-semibold">{krs.mahasiswa.nama} · {krs.mahasiswa.nim}</h2>
  <p>{krs.programStudi.nama} · {krs.semester.nama}</p>
  <p class="mt-3 font-semibold">Status: {krs.status}</p>
  <dl class="mt-3 grid gap-3 sm:grid-cols-3">
    <div class="rounded-lg bg-slate-50 p-3"><dt class="text-sm text-slate-500">Batas SKS maksimum</dt><dd class="text-xl font-semibold">{krs.batasSks} SKS</dd></div>
    <div class="rounded-lg bg-slate-50 p-3"><dt class="text-sm text-slate-500">SKS dipilih</dt><dd class="text-xl font-semibold">{krs.totalSks} SKS</dd></div>
    <div class="rounded-lg bg-slate-50 p-3"><dt class="text-sm text-slate-500">Sisa SKS</dt><dd class="text-xl font-semibold">{krs.remainingSks} SKS</dd></div>
  </dl>
  <p class="mt-3 text-sm text-slate-500">Batas SKS adalah snapshot saat KRS dibuat dan tidak dihitung ulang ketika KRS dibuka kembali.</p>
  {#if krs.diajukanAt}<p class="mt-2 text-sm">Diajukan: {new Date(krs.diajukanAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>{/if}
  {#if krs.disetujuiAt}<p class="text-sm">Disetujui: {new Date(krs.disetujuiAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>{/if}
</div>
<KrsClasses classes={krs.details.filter(item => item.status === 'AKTIF').map(item => item.kelas)} />
{#if krs.details.some(item => item.status === 'DIBATALKAN')}
  <details class="my-4"><summary class="cursor-pointer text-sm">Riwayat pilihan dibatalkan</summary><KrsClasses classes={krs.details.filter(item => item.status === 'DIBATALKAN').map(item => item.kelas)} /></details>
{/if}
