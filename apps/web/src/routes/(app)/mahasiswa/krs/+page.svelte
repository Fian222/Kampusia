<script lang="ts">
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsClasses from '$lib/components/KrsClasses.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  let { data, form } = $props();
  const plan = $derived(data.selected?.krs);
  function href(key: string, value: string | number) { const params = new URLSearchParams(page.url.searchParams); params.set(key, String(value)); return '?' + params; }
</script>
<svelte:head><title>KRS · Kampusia</title></svelte:head>
<h1 class="text-2xl font-bold">Kartu Rencana Studi</h1>
<p class="mt-2 text-slate-500">Semester aktif: {data.history.activeSemester?.nama ?? 'Belum ditetapkan'}</p>
{#if form?.message}<p role="status" class="my-4 rounded-lg border bg-white p-4">{form.message}</p>{/if}
{#if data.history.activeSemester}<a class="my-3 inline-block text-teal-700 underline" href={'?semester_id=' + data.history.activeSemester.id}>Buka semester aktif</a>{/if}
{#if data.selected}
  {#if plan}
    <KrsSummary krs={plan} />
    {#if plan.status === 'DRAFT' && data.selected.semester.isActive}
      <div class="my-4 flex flex-wrap gap-3">{#each plan.details.filter(item => item.status === 'AKTIF') as item}<form method="POST"><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="mode" value="remove" /><input type="hidden" name="detail_id" value={item.id} /><button class="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">Hapus {item.kelas.mataKuliah.kode} / {item.kelas.namaKelas}</button></form>{/each}</div>
      <KrsAction id={plan.id} mode="submit" label="Ajukan KRS" explanation="Pilihan akan dikunci sampai ditinjau. Pengajuan belum memesan kursi; kapasitas diperiksa saat persetujuan." />
    {:else if plan.status === 'DITOLAK' && data.selected.semester.isActive}
      <p class="my-4">KRS ditolak. Buka kembali untuk memperbaiki pilihan dan mengajukan ulang.</p><KrsAction id={plan.id} mode="reopen" label="Perbaiki KRS" explanation="Kembalikan KRS ke DRAFT untuk koreksi dan pengajuan baru?" />
    {:else if plan.status === 'DIAJUKAN'}<p class="my-4">KRS menunggu peninjauan akademik. Pilihan tidak dapat diubah.</p>
    {:else if plan.status === 'DISETUJUI'}<p class="my-4">KRS telah disetujui. Hubungi akademik jika diperlukan koreksi.</p>
    {:else if plan.status === 'DIBATALKAN'}<p class="my-4">KRS dibatalkan. Riwayat dipertahankan dan tidak dapat dibuat ulang.</p>{/if}
  {:else if data.selected.semester.isActive}
    <form method="POST" class="my-4"><input type="hidden" name="mode" value="create" /><input type="hidden" name="id" value={data.selected.semester.id} /><button class="rounded-lg bg-teal-700 px-4 py-2 text-white">Buat DRAFT KRS</button></form>
  {:else}<p class="my-4">Tidak ada KRS pada semester ini.</p>{/if}
{/if}
{#if data.availabilityMessage}<p role="alert" class="my-4 text-red-700">{data.availabilityMessage}</p>{/if}
{#if data.available}
  <h2 class="mt-8 text-lg font-semibold">Kelas tersedia</h2>
  <p class="my-2 text-sm text-slate-500">Kursi dihitung dari KRS disetujui. Kelas penuh tetap dapat dipilih, tetapi persetujuan memerlukan kursi tersedia.</p>
  <form method="GET" class="my-4 flex gap-3"><input type="hidden" name="semester_id" value={data.selected?.semester.id} /><input aria-label="Cari kelas" name="search" value={data.query.search} placeholder="Kode / nama mata kuliah / kelas" class="min-w-0 flex-1 rounded-lg border p-2" /><button class="rounded-lg border px-4">Cari</button></form>
  <KrsClasses classes={data.available.data} />
  {#if plan?.status === 'DRAFT'}<div class="my-4 flex flex-wrap gap-3">{#each data.available.data as kelas}<form method="POST"><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="mode" value="add" /><input type="hidden" name="kelas_id" value={kelas.id} /><button class="rounded-lg bg-teal-700 px-3 py-2 text-sm text-white">Tambah {kelas.mataKuliah.kode} / {kelas.namaKelas}</button></form>{/each}</div>{/if}
  <Pagination {...data.available.meta} href={value => href('page', value)} />
{/if}
<details class="mt-8"><summary class="cursor-pointer font-semibold">Riwayat KRS</summary><ul class="my-3 space-y-2">{#each data.history.data as item}<li><a class="text-teal-700 underline" href={'?semester_id=' + item.semesterId}>{item.semester.nama} · {item.status}</a></li>{/each}</ul><Pagination {...data.history.meta} href={value => href('history_page', value)} /></details>
