<script lang="ts">
  let { page, limit, total, href }: { page: number; limit: number; total: number; href: (page: number) => string } = $props();
  const pages = $derived(Math.max(1, Math.ceil(total / limit)));
</script>
<nav class="flex flex-wrap items-center justify-between gap-3 py-4 text-sm" aria-label="Halaman data">
  <span class="text-slate-500">{total} data · Halaman {page} dari {pages}</span>
  <div class="flex gap-3">
    {#if page > 1}<a class="rounded-lg border border-slate-300 px-3 py-2" href={href(page - 1)}>Sebelumnya</a>{/if}
    {#if page < pages}<a class="rounded-lg border border-slate-300 px-3 py-2" href={href(page + 1)}>Berikutnya</a>{/if}
  </div>
</nav>
