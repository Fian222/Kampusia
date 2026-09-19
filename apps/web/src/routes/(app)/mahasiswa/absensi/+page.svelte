<script lang="ts">
  import { formatAcademicDate } from '$lib/date-format';
  import Pagination from '$lib/components/Pagination.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  let { data } = $props();
  const href = (page: number) => `?page=${page}`;
</script>
<svelte:head><title>Riwayat Absensi · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Kehadiran" title="Riwayat Absensi" description="Catatan kehadiran yang telah direkam untuk akun mahasiswa Anda." />
<h2 class="mt-7 text-sm font-bold uppercase tracking-wide text-slate-500">Ringkasan halaman ini</h2><section class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{#each Object.entries(data.summary) as [status, total]}<StatCard label={status} value={total} icon={status === 'HADIR' ? 'check' : status === 'ALPHA' ? 'alert' : 'clock'} accent={status === 'HADIR'} />{/each}</section>
<section class="table-shell mt-6 overflow-x-auto"><table class="min-w-[800px] w-full text-left text-sm"><thead><tr><th class="p-4">Mata Kuliah</th><th class="p-4">Kelas</th><th class="p-4">Pertemuan</th><th class="p-4">Tanggal</th><th class="p-4">Materi</th><th class="p-4">Status</th></tr></thead>
  <tbody class="divide-y divide-slate-100">{#each data.records.data as row}<tr><td class="p-4"><span class="font-mono text-xs font-semibold text-slate-500">{row.mataKuliah.kode}</span><p class="mt-1 font-semibold text-slate-900">{row.mataKuliah.nama}</p></td><td class="p-4">{row.kelas.namaKelas}</td><td class="p-4">Ke-{row.pertemuan.nomorPertemuan}</td><td class="p-4">{formatAcademicDate(row.pertemuan.tanggal)}</td><td class="max-w-xs p-4">{row.pertemuan.materi ?? '—'}</td><td class="p-4"><Badge tone={row.status === 'HADIR' ? 'success' : row.status === 'ALPHA' ? 'danger' : 'info'}>{row.status}</Badge></td></tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada absensi yang dicatat.</td></tr>{/each}</tbody>
</table></section><Pagination {...data.records.meta} {href} />
