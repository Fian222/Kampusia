<script lang="ts">
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import Pagination from '$lib/components/Pagination.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  let { data } = $props();
  const listPending = $derived(isListNavigationPending(navigating, page.url.pathname));
  const filterKeys = ['search', 'status', 'semester_id', 'program_studi_id', 'term_search', 'program_search'];
  const resetKeys = [...filterKeys, 'term_page', 'program_page'];
  const filtersActive = $derived(hasActiveQuery(page.url, filterKeys));
  function href(key: string, value: number) { const p = new URLSearchParams(page.url.searchParams); p.set(key, String(value)); return '?' + p; }
</script>
<svelte:head><title>Manajemen KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Persetujuan" title="Manajemen KRS" description="Tinjau rencana studi mahasiswa dan pantau status persetujuannya." />
<form method="GET" class="surface-panel my-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3" use:seamlessFilter>
  <label class="text-sm font-semibold">NIM / nama<input name="search" value={data.query.search} class="control-base mt-1.5" /></label>
  <label class="text-sm font-semibold">Status<select name="status" value={data.query.status ?? ''} class="control-base mt-1.5"><option value="">Semua</option>{#each data.statuses as status}<option value={status}>{status}</option>{/each}</select></label>
  <label class="text-sm font-semibold">Semester<select name="semester_id" value={data.query.semester_id ?? ''} class="control-base mt-1.5"><option value="">Semua semester</option>{#if data.query.semester_id && !data.terms.data.some(row => row.id === data.query.semester_id)}<option value={data.query.semester_id}>Semester terpilih</option>{/if}{#each data.terms.data as term}<option value={term.id}>{term.nama}</option>{/each}</select></label>
  <label class="text-sm font-semibold">Program studi<select name="program_studi_id" value={data.query.program_studi_id ?? ''} class="control-base mt-1.5"><option value="">Semua program</option>{#if data.query.program_studi_id && !data.programs.data.some(row => row.id === data.query.program_studi_id)}<option value={data.query.program_studi_id}>Program terpilih</option>{/if}{#each data.programs.data as program}<option value={program.id}>{program.nama}</option>{/each}</select></label>
  <label class="text-sm font-semibold">Cari pilihan semester<input name="term_search" value={page.url.searchParams.get('term_search') ?? ''} class="control-base mt-1.5" /></label>
  <label class="text-sm font-semibold">Cari pilihan program<input name="program_search" value={page.url.searchParams.get('program_search') ?? ''} class="control-base mt-1.5" /></label>
  <noscript><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a href={resetQueryHref(page.url, resetKeys)} data-sveltekit-noscroll class="py-2 text-sm text-slate-600">Reset filter</a></div>{/if}
</form>
<details class="mb-4 text-sm"><summary>Paginasi pilihan filter</summary><p>Semester</p><Pagination {...data.terms.meta} href={value => href('term_page', value)} /><p>Program studi</p><Pagination {...data.programs.meta} href={value => href('program_page', value)} /></details>
<div class="table-shell relative overflow-x-auto transition-opacity" class:opacity-80={listPending} aria-busy={listPending}><ListPending /><table class="min-w-[760px] w-full text-left text-sm"><thead><tr><th class="p-4">Mahasiswa</th><th class="p-4">Program studi</th><th class="p-4">Semester</th><th class="p-4">Status</th><th class="p-4">Tindakan</th></tr></thead><tbody class="divide-y divide-slate-100">{#each data.records.data as item}<tr><td class="p-4"><span class="font-mono text-xs font-semibold text-slate-500">{item.mahasiswa.nim}</span><p class="mt-1 font-semibold text-slate-900">{item.mahasiswa.nama}</p></td><td class="p-4">{item.programStudi.nama}</td><td class="p-4">{item.semester.nama}</td><td class="p-4"><Badge tone={item.status === 'DISETUJUI' ? 'success' : item.status === 'DIAJUKAN' ? 'warning' : item.status === 'DITOLAK' || item.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{item.status}</Badge></td><td class="p-4"><a class="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800" href={'/akademik/krs/' + item.id}>Tinjau <Icon name="arrow-right" size={15} /></a></td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada KRS sesuai filter.</td></tr>{/each}</tbody></table></div>
<Pagination {...data.records.meta} href={value => href('page', value)} />
