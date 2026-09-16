<script lang="ts">
  import type { Snippet } from 'svelte';
  let { eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: Snippet } = $props();
</script>
<header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
  <div class="min-w-0">
    {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
    <h1 class={eyebrow ? 'mt-2' : ''}>{title}</h1>
    {#if description}<p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>{/if}
  </div>
  {#if actions}<div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</header>
