<script lang="ts">
  import { page } from '$app/state';
  import Pagination from './Pagination.svelte';
  let { prefix, label, meta }: { prefix: string; label: string; meta: { page: number; limit: number; total: number } } = $props();
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set(prefix + 'page', String(number)); return '?' + p; }
</script>
<section class="mt-5 rounded-xl border border-slate-200 bg-white p-5">
  <h2 class="font-semibold">Pilihan {label}</h2><p class="mt-1 text-sm text-slate-500">Cari atau pindah halaman sebelum mengisi formulir untuk memilih data lain.</p>
  <form method="GET" class="mt-3 flex items-end gap-3">
    {#each [...page.url.searchParams].filter(([key]) => ![prefix + 'page', prefix + 'search'].includes(key)) as [key, value]}<input type="hidden" name={key} {value} />{/each}
    <label class="grow text-sm">Cari {label}<input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" name={prefix + 'search'} value={page.url.searchParams.get(prefix + 'search') ?? ''} maxlength="150" /></label>
    <button class="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">Cari pilihan</button>
  </form>
  <Pagination {...meta} {href} />
</section>
