<script lang="ts">
  import { navigating, page } from '$app/state';
  import { isListNavigationPending } from '$lib/navigation/pending';
  const pending = $derived(isListNavigationPending(navigating, page.url.pathname));
</script>

{#if pending}
  <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-100" role="progressbar" aria-label="Memperbarui daftar">
    <span class="block h-full w-1/3 animate-pulse rounded-full bg-brand-600"></span>
  </div>
{/if}
