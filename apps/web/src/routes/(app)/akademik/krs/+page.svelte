<script lang="ts">
  import ReferenceCombobox from '$lib/components/ReferenceCombobox.svelte';
  import SelectField from '$lib/components/ui/SelectField.svelte';
  import { page, navigating } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { isListNavigationPending } from '$lib/navigation/pending';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import ReferenceLookup from '$lib/components/ReferenceLookup.svelte';
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
<form method="GET" class="filter-panel my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" use:seamlessFilter>
  <label class="text-sm font-semibold">NIM / nama<input name="search" value={data.query.search} class="control-base mt-1.5" /></label>
  <SelectField name="status" label="Status" value={data.query.status ?? ''} options={[{ value: '', label: 'Semua' }, ...data.statuses.map(status => ({ value: status, label: status }))]} />
  <ReferenceCombobox name="semester_id" label="Semester" value={data.query.semester_id ?? ''} options={data.terms.data.map(term => ({ value: term.id, label: term.nama, description: term.kode }))} selectedOption={data.query.semester_id ? { value: data.query.semester_id, label: 'Semester terpilih' } : null} meta={data.terms.meta} searchParam="term_search" pageParam="term_page" placeholder="Semua semester" nullable optionalIndicator={false} />
  <ReferenceCombobox name="program_studi_id" label="Program Studi" value={data.query.program_studi_id ?? ''} options={data.programs.data.map(program => ({ value: program.id, label: program.nama, description: program.kode }))} selectedOption={data.query.program_studi_id ? { value: data.query.program_studi_id, label: 'Program studi terpilih' } : null} meta={data.programs.meta} searchParam="program_search" pageParam="program_page" placeholder="Semua program" nullable optionalIndicator={false} />
  <noscript><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Terapkan filter</button></noscript>
  {#if filtersActive}<div class="flex items-end"><a href={resetQueryHref(page.url, resetKeys)} data-sveltekit-noscroll class="py-2 text-sm text-slate-600">Reset filter</a></div>{/if}
</form>
<ReferenceLookup references={[{ label: 'Semester', prefix: 'term', meta: data.terms.meta }, { label: 'Program Studi', prefix: 'program', meta: data.programs.meta }]} />
<div class="table-shell relative overflow-x-auto transition-opacity" class:opacity-80={listPending} aria-busy={listPending}><ListPending /><table class="min-w-[760px] w-full text-left text-sm"><thead><tr><th class="p-4">Mahasiswa</th><th class="p-4">Program studi</th><th class="p-4">Semester</th><th class="p-4">Status</th><th class="p-4">Tindakan</th></tr></thead><tbody class="divide-y divide-slate-100">{#each data.records.data as item}<tr><td class="p-4"><span class="font-mono text-xs font-semibold text-slate-500">{item.mahasiswa.nim}</span><p class="mt-1 font-semibold text-slate-900">{item.mahasiswa.nama}</p></td><td class="p-4">{item.programStudi.nama}</td><td class="p-4">{item.semester.nama}</td><td class="p-4"><Badge tone={item.status === 'DISETUJUI' ? 'success' : item.status === 'DIAJUKAN' ? 'warning' : item.status === 'DITOLAK' || item.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{item.status}</Badge></td><td class="p-4"><a class="action-primary" href={'/akademik/krs/' + item.id}>Tinjau KRS <Icon name="arrow-right" size={15} /></a></td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Tidak ada KRS sesuai filter.</td></tr>{/each}</tbody></table></div>
<Pagination {...data.records.meta} href={value => href('page', value)} />
