<script lang="ts">
  import Pagination from '$lib/components/Pagination.svelte';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data } = $props();
  const filterKeys = ['search', 'status'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('page', String(number)); return '?' + params; }
</script>
<svelte:head><title>Kelas yang Diajar · Kampusia</title></svelte:head>
<PageHeader eyebrow="Perkuliahan" title="Kelas yang Diajar" description="Kelola pertemuan, absensi, dan penilaian untuk kelas tempat Anda ditugaskan." />
<form method="GET" class="surface-panel mt-6 flex flex-col gap-3 p-4 sm:flex-row" use:seamlessFilter>
  <input class="control-base min-w-60 flex-1" name="search" value={data.query.search} placeholder="Cari kode, mata kuliah, atau kelas" aria-label="Cari kelas" />
  <select class="control-base sm:w-48" name="status" aria-label="Filter status"><option value="">Semua status</option>{#each data.statuses as status}<option value={status} selected={data.query.status === status}>{status}</option>{/each}</select>
  <noscript><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Terapkan filter</button></noscript>
  {#if filtersActive}<a class="self-center text-sm text-slate-600" href={resetQueryHref(page.url, filterKeys)} data-sveltekit-noscroll>Reset filter</a>{/if}
</form>
<section class="table-shell relative mt-6 overflow-x-auto" aria-busy={listPending}><ListPending /><table class="min-w-[700px] w-full text-left text-sm transition-opacity" class:opacity-80={listPending}><thead><tr><th class="p-4">Mata Kuliah</th><th class="p-4">Kelas</th><th class="p-4">Semester</th><th class="p-4">Status</th><th class="p-4">Tindakan</th></tr></thead>
  <tbody class="divide-y divide-slate-100">{#each data.records.data as row}<tr><td class="p-4"><span class="font-mono text-xs font-semibold text-slate-500">{row.mataKuliah.kode}</span><p class="mt-1 font-semibold text-slate-900">{row.mataKuliah.nama}</p></td><td class="p-4"><span class="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 font-bold">{row.namaKelas}</span></td><td class="p-4">{row.semester.nama}</td><td class="p-4"><Badge tone={row.status === 'DIBUKA' ? 'success' : row.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{row.status}</Badge></td><td class="p-4"><a class="inline-flex items-center gap-1.5 font-semibold text-brand-700" href={`/dosen/kelas-kuliah/${row.id}`}>Buka kelas <Icon name="arrow-right" size={15} /></a></td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Belum ada kelas yang ditugaskan.</td></tr>{/each}</tbody>
</table></section><Pagination {...data.records.meta} {href} />
