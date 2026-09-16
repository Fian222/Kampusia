<script lang="ts">
  import { page } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';
  import Pagination from './Pagination.svelte';
  let { prefix, label, meta }: { prefix: string; label: string; meta: { page: number; limit: number; total: number } } = $props();
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set(prefix + 'page', String(number)); return '?' + p; }
</script>
<section class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
  <h2 class="text-sm font-bold">Cari {label}</h2>
  <form method="GET" class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" use:seamlessFilter={{ pageKey: prefix + 'page' }}>
    {#each [...page.url.searchParams].filter(([key]) => ![prefix + 'page', prefix + 'search'].includes(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
    <label class="grow text-sm font-semibold">Kode atau nama<input class="control-base mt-1.5" name={prefix + 'search'} value={page.url.searchParams.get(prefix + 'search') ?? ''} maxlength="150" /></label>
    <noscript><button class="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Cari</button></noscript>
    {#if hasActiveQuery(page.url, [prefix + 'search'])}<div class="flex items-end"><a class="py-2 text-sm text-slate-600" href={resetQueryHref(page.url, [prefix + 'search'], prefix + 'page')} data-sveltekit-noscroll>Reset filter</a></div>{/if}
  </form>
  <Pagination {...meta} {href} />
</section>
