<script lang="ts">
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsClasses from '$lib/components/KrsClasses.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data, form } = $props();
  const plan = $derived(data.selected?.krs);
  function href(key: string, value: string | number) { const params = new URLSearchParams(page.url.searchParams); params.set(key, String(value)); return '?' + params; }
</script>
<svelte:head><title>KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Rencana Studi" title="Kartu Rencana Studi" description="Pilih kelas, pantau jumlah SKS, lalu ajukan rencana studi untuk ditinjau." />
<div class="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><span class="inline-flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon name="calendar" size={18} /></span><div><p class="text-xs font-medium text-slate-500">Semester aktif</p><p class="text-sm font-semibold text-slate-900">{data.history.activeSemester?.nama ?? 'Belum ditetapkan'}</p></div>{#if data.history.activeSemester}<a class="ml-auto text-sm font-semibold text-brand-700 hover:text-brand-800" href={'?semester_id=' + data.history.activeSemester.id}>Buka semester aktif →</a>{/if}</div>
{#if form?.message}<p role="status" class="my-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">{form.message}</p>{/if}
{#if data.selected}
  {#if plan}
    <KrsSummary krs={plan} />
    {#if plan.status === 'DRAFT' && data.selected.semester.isActive}
      <div class="my-4 flex flex-wrap gap-2">{#each plan.details.filter(item => item.status === 'AKTIF') as item}<form method="POST"><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="mode" value="remove" /><input type="hidden" name="detail_id" value={item.id} /><button class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50">Hapus {item.kelas.mataKuliah.kode} / {item.kelas.namaKelas}</button></form>{/each}</div>
      <KrsAction id={plan.id} mode="submit" label="Ajukan KRS" explanation="Pilihan akan dikunci sampai ditinjau. Pengajuan belum memesan kursi; kapasitas diperiksa saat persetujuan." />
    {:else if plan.status === 'DITOLAK' && data.selected.semester.isActive}
      <p class="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">KRS ditolak. Buka kembali untuk memperbaiki pilihan dan mengajukan ulang.</p><KrsAction id={plan.id} mode="reopen" label="Perbaiki KRS" explanation="Kembalikan KRS ke DRAFT untuk koreksi dan pengajuan baru?" />
    {:else if plan.status === 'DIAJUKAN'}<p class="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">KRS menunggu peninjauan akademik. Pilihan tidak dapat diubah.</p>
    {:else if plan.status === 'DISETUJUI'}<p class="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">KRS telah disetujui. Hubungi akademik jika diperlukan koreksi.</p>
    {:else if plan.status === 'DIBATALKAN'}<p class="my-4 rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700">KRS dibatalkan. Riwayat dipertahankan dan tidak dapat dibuat ulang.</p>{/if}
  {:else if data.selected.semester.isActive}
    <form method="POST" class="surface-panel my-6 p-6 text-center"><p class="mb-4 text-sm text-slate-600">Belum ada rencana studi untuk semester ini.</p><input type="hidden" name="mode" value="create" /><input type="hidden" name="id" value={data.selected.semester.id} /><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Buat DRAFT KRS</button></form>
  {:else}<p class="my-4">Tidak ada KRS pada semester ini.</p>{/if}
{/if}
{#if data.availabilityMessage}<p role="alert" class="my-4 text-red-700">{data.availabilityMessage}</p>{/if}
{#if data.available}
  <h2 class="mt-9 text-lg font-bold">Kelas tersedia</h2>
  <p class="my-2 text-sm text-slate-500">Kursi dihitung dari KRS disetujui. Kelas penuh tetap dapat dipilih, tetapi persetujuan memerlukan kursi tersedia.</p>
  <form method="GET" class="surface-panel my-4 flex flex-col gap-3 p-4 sm:flex-row"><input type="hidden" name="semester_id" value={data.selected?.semester.id} /><input aria-label="Cari kelas" name="search" value={data.query.search} placeholder="Kode / nama mata kuliah / kelas" class="control-base min-w-0 flex-1" /><button class="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Cari kelas</button></form>
  <KrsClasses classes={data.available.data} />
  {#if plan?.status === 'DRAFT'}<div class="my-4 flex flex-wrap gap-2">{#each data.available.data as kelas}<form method="POST"><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="mode" value="add" /><input type="hidden" name="kelas_id" value={kelas.id} /><button class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-800"><Icon name="plus" size={15} /> {kelas.mataKuliah.kode} / {kelas.namaKelas}</button></form>{/each}</div>{/if}
  <Pagination {...data.available.meta} href={value => href('page', value)} />
{/if}
<details class="surface-panel group mt-8 p-5"><summary class="flex list-none items-center justify-between font-bold [&::-webkit-details-marker]:hidden">Riwayat KRS <Icon name="chevron-down" size={18} class="transition-transform group-open:rotate-180" /></summary><ul class="my-4 divide-y divide-slate-100">{#each data.history.data as item}<li><a class="flex items-center justify-between py-3 text-sm font-medium text-slate-700 hover:text-brand-700" href={'?semester_id=' + item.semesterId}><span>{item.semester.nama}</span><span>{item.status}</span></a></li>{/each}</ul><Pagination {...data.history.meta} href={value => href('history_page', value)} /></details>
