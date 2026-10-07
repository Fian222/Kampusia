<script lang="ts">
  import Icon from './ui/Icon.svelte';
  import { paginationRange } from '$lib/navigation/pagination';
  let { page, limit, total, href }: { page: number; limit: number; total: number; href: (page: number) => string } = $props();
  const range = $derived(paginationRange(page, limit, total));
  const pages = $derived(range.pages);
  const start = $derived(range.start);
  const end = $derived(range.end);
</script>
<nav class="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Paginasi data" data-sveltekit-noscroll data-sveltekit-keepfocus>
  {#if range.outOfRange}<span role="status" class="text-sm text-muted">Halaman {page} tidak tersedia. <a class="font-semibold text-brand-700 underline" href={href(pages)}>Kembali ke halaman {pages}</a>.</span>{:else}<span class="text-xs text-slate-500 sm:text-sm">Menampilkan <strong class="font-semibold text-slate-700">{start}–{end}</strong> dari <strong class="font-semibold text-slate-700">{total}</strong> data</span>{/if}
  <div class="flex items-center justify-between gap-2 sm:justify-end">
    {#if page > 1}<a class="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50" href={href(range.previous)} rel="prev"><Icon name="arrow-right" size={14} class="rotate-180" /> Sebelumnya</a>{:else}<span class="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-400 opacity-60"><Icon name="arrow-right" size={14} class="rotate-180" /> Sebelumnya</span>{/if}
    <span class="min-w-16 text-center text-xs font-semibold text-slate-600">{range.outOfRange ? '—' : page} / {pages}</span>
    {#if page < pages}<a class="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50" href={href(page + 1)} rel="next">Berikutnya <Icon name="arrow-right" size={14} /></a>{:else}<span class="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-400 opacity-60">Berikutnya <Icon name="arrow-right" size={14} /></span>{/if}
  </div>
</nav>
