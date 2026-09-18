<script lang="ts">
  import type { KrsDetailData } from '$lib/server/krs';
  import KrsClasses from './KrsClasses.svelte';
  import Badge from './ui/Badge.svelte';
  import Icon from './ui/Icon.svelte';
  let { krs }: { krs: KrsDetailData } = $props();
  const percentage = $derived(Math.min(100, krs.batasSks > 0 ? (krs.totalSks / krs.batasSks) * 100 : 0));
  const tone = $derived(krs.status === 'DISETUJUI' ? 'success' as const : krs.status === 'DITOLAK' || krs.status === 'DIBATALKAN' ? 'danger' as const : krs.status === 'DIAJUKAN' ? 'warning' as const : 'neutral' as const);
</script>

<section class="surface-panel my-6 overflow-hidden">
  <div class="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:p-6">
    <div><p class="eyebrow">Rencana studi</p><h2 class="mt-2 text-xl font-bold">{krs.mahasiswa.nama}</h2><p class="mt-1 text-sm text-slate-500">{krs.mahasiswa.nim} · {krs.programStudi.nama} · {krs.semester.nama}</p><p class="mt-1 text-sm text-slate-500">Dosen PA: <strong class="font-semibold text-slate-700">{krs.dosenPa?.nama ?? 'Belum ditetapkan'}</strong></p></div>
    <Badge {tone}><span class="size-1.5 rounded-full bg-current opacity-70"></span>{krs.status}</Badge>
  </div>
  <div class="p-5 sm:p-6">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Batas maksimum</dt><dd class="mt-2 text-2xl font-bold text-slate-950">{krs.batasSks} <span class="text-sm font-semibold text-slate-500">SKS</span></dd></div>
      <div class="rounded-xl border border-brand-200 bg-brand-50/70 p-4"><dt class="text-xs font-semibold uppercase tracking-wide text-brand-700">Sudah dipilih</dt><dd class="mt-2 text-2xl font-bold text-brand-800">{krs.totalSks} <span class="text-sm font-semibold text-brand-600">SKS</span></dd></div>
      <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Sisa tersedia</dt><dd class="mt-2 text-2xl font-bold text-slate-950">{krs.remainingSks} <span class="text-sm font-semibold text-slate-500">SKS</span></dd></div>
    </div>
    <div class="mt-4"><div class="mb-2 flex justify-between text-xs font-medium text-slate-500"><span>Pemakaian batas SKS</span><span>{Math.round(percentage)}%</span></div><div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-brand-600 transition-[width]" style={`width: ${percentage}%`}></div></div></div>
    <div class="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><Icon name="info" size={15} class="mt-0.5 shrink-0" /><p>Batas SKS adalah snapshot saat KRS dibuat dan tidak dihitung ulang ketika KRS dibuka kembali.</p></div>
    {#if krs.previousIps}<p class="mt-2 text-xs text-slate-500">IPS semester sebelumnya: <strong class="text-slate-700">{krs.previousIps}</strong></p>{/if}
    {#if krs.alasanPenolakan}<p class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Alasan penolakan:</strong> {krs.alasanPenolakan}</p>{/if}
    {#if krs.diajukanAt || krs.disetujuiAt}<div class="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">{#if krs.diajukanAt}<p>Diajukan <strong class="font-medium text-slate-700">{new Date(krs.diajukanAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</strong></p>{/if}{#if krs.disetujuiAt}<p>Disetujui <strong class="font-medium text-slate-700">{new Date(krs.disetujuiAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</strong></p>{/if}</div>{/if}
  </div>
</section>

<div><div class="mb-3"><h2 class="text-lg font-bold">Kelas terpilih</h2><p class="mt-1 text-sm text-slate-500">Daftar kelas aktif pada rencana studi ini.</p></div><KrsClasses classes={krs.details.filter(item => item.status === 'AKTIF').map(item => item.kelas)} /></div>
{#if krs.details.some(item => item.status === 'DIBATALKAN')}
  <details class="surface-panel group my-5 p-4"><summary class="flex list-none items-center justify-between text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">Riwayat pilihan dibatalkan <Icon name="chevron-down" size={17} class="transition-transform group-open:rotate-180" /></summary><div class="mt-4"><KrsClasses classes={krs.details.filter(item => item.status === 'DIBATALKAN').map(item => item.kelas)} /></div></details>
{/if}
