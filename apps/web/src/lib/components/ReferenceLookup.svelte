<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import { queryHref, resetQueryHref } from '$lib/navigation/query';
  import Pagination from './Pagination.svelte';

  let { references }: { references: { label: string; prefix: string; meta: { page: number; limit: number; total: number } }[] } = $props();
  let enhanced = $state(false);
  onMount(() => { enhanced = true; });
</script>

{#if references.some(reference => reference.meta.total > reference.meta.limit || page.url.searchParams.has(`${reference.prefix}_search`) || reference.meta.page > 1)}
  <details hidden={enhanced} class="surface-panel mt-3 p-4 text-sm">
    <summary class="min-h-11 content-center font-semibold text-brand-700">Cari pilihan filter lainnya</summary>
    <p class="mt-2 text-muted">Cari kode atau nama, lalu pilih hasilnya pada filter di atas.</p>
    <div class="mt-4 grid gap-5 lg:grid-cols-2">
      {#each references as reference}
        <div class="min-w-0">
          <form method="GET" use:seamlessFilter={{ pageKey: `${reference.prefix}_page` }}>
            {#each [...page.url.searchParams].filter(([key]) => key !== `${reference.prefix}_search` && key !== `${reference.prefix}_page`) as [key, value]}<input type="hidden" name={key} {value} />{/each}
            <label class="block font-medium">{reference.label}<input class="control-base mt-1.5" name={`${reference.prefix}_search`} value={page.url.searchParams.get(`${reference.prefix}_search`) ?? ''} maxlength="150" placeholder="Kode atau nama" /></label>
            <noscript><button class="action-secondary mt-2">Cari pilihan</button></noscript>
            {#if page.url.searchParams.get(`${reference.prefix}_search`)}<a class="mt-2 inline-flex min-h-11 items-center text-brand-700" href={resetQueryHref(page.url, [`${reference.prefix}_search`], `${reference.prefix}_page`)} data-sveltekit-noscroll>Reset pencarian pilihan</a>{/if}
          </form>
          <div class="mt-3"><Pagination {...reference.meta} href={number => queryHref(page.url, { [`${reference.prefix}_page`]: number })} /></div>
        </div>
      {/each}
    </div>
  </details>
{/if}
