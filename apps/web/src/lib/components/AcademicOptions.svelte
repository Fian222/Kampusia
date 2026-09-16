<script lang="ts">
  import { page } from '$app/state';
  import Pagination from './Pagination.svelte';
  let { prefix, label, meta }: { prefix: string; label: string; meta: { page: number; limit: number; total: number } } = $props();
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set(prefix + 'page', String(number)); return '?' + p; }
</script>
<section class="surface-panel mt-6 p-5 sm:p-6">
  <h2 class="font-bold">Pilihan {label}</h2><p class="mt-1 text-sm leading-6 text-slate-500">Cari atau pindah halaman sebelum mengisi formulir untuk memilih data lain.</p>
  <form method="GET" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
    {#each [...page.url.searchParams].filter(([key]) => ![prefix + 'page', prefix + 'search'].includes(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
    <label class="grow text-sm font-semibold">Cari {label}<input class="control-base mt-1.5" name={prefix + 'search'} value={page.url.searchParams.get(prefix + 'search') ?? ''} maxlength="150" /></label>
    <button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Cari pilihan</button>
  </form>
  <Pagination {...meta} {href} />
</section>
