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
  function href(value: number) { const params = new URLSearchParams(page.url.searchParams); params.set('page', String(value)); return '?' + params; }
</script>
<svelte:head><title>Bimbingan KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Dosen / Pembimbing Akademik" title="Bimbingan KRS" description="Tinjau pengajuan hanya dari mahasiswa yang saat ini berada dalam bimbingan Anda." />
<form method="GET" class="filter-panel my-6 grid gap-4 sm:grid-cols-2" use:seamlessFilter><label class="text-sm font-semibold">NIM / nama<input class="control-base mt-1.5" name="search" value={data.query.search} /></label><label class="text-sm font-semibold">Status<select class="control-base mt-1.5" name="status" value={data.query.status ?? ''}><option value="">Antrean diajukan</option>{#each data.statuses as status}<option value={status}>{status}</option>{/each}</select></label><noscript><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white">Terapkan</button></noscript>{#if hasActiveQuery(page.url, ['search', 'status'])}<a class="text-sm text-slate-600" href={resetQueryHref(page.url, ['search', 'status'])} data-sveltekit-noscroll>Reset filter</a>{/if}</form>
<div class="mb-3"><p class="eyebrow">Antrean bimbingan</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{data.records.meta.total} KRS</h2></div>
<div class="table-shell relative overflow-x-auto" aria-busy={listPending}><ListPending /><table class="min-w-[760px] w-full text-left text-sm transition-opacity" class:opacity-80={listPending}><thead><tr><th class="p-4">Mahasiswa</th><th class="p-4">Program</th><th class="p-4">Semester</th><th class="p-4">Status</th><th class="p-4">SKS</th><th class="p-4">Tindakan</th></tr></thead><tbody class="divide-y divide-slate-100">{#each data.records.data as item}<tr><td class="p-4"><span class="font-mono text-xs text-slate-500">{item.mahasiswa.nim}</span><p class="font-semibold">{item.mahasiswa.nama}</p></td><td class="p-4">{item.programStudi.nama}</td><td class="p-4">{item.semester.nama}</td><td class="p-4"><Badge tone={item.status === 'DIAJUKAN' ? 'warning' : item.status === 'DISETUJUI' ? 'success' : item.status === 'DITOLAK' ? 'danger' : 'neutral'}>{item.status}</Badge></td><td class="p-4"><strong>{item.totalSks}</strong> / {item.batasSks}</td><td class="p-4"><a class="action-primary" href={'/dosen/krs/' + item.id}>Tinjau KRS <Icon name="arrow-right" size={15} /></a></td></tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada KRS dalam antrean bimbingan Anda.</td></tr>{/each}</tbody></table></div>
<Pagination {...data.records.meta} href={href} />
