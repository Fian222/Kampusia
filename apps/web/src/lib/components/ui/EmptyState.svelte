<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  let { title, description, icon = 'search', compact = false }: { title: string; description?: string; icon?: IconName; compact?: boolean } = $props();
</script>
<div class={`flex flex-col items-center justify-center text-center ${compact ? 'px-5 py-8' : 'px-6 py-12'}`}>
  <span class="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon name={icon} size={20} /></span>
  <p class="font-semibold text-slate-800">{title}</p>
  {#if description}<p class="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>{/if}
</div>
