<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  let { label, value, detail, icon = 'chart', accent = false }: { label: string; value: string | number; detail?: string; icon?: IconName; accent?: boolean } = $props();
</script>
<div class={`surface-panel relative overflow-hidden p-5 ${accent ? 'border-brand-200 bg-brand-50/60' : ''}`}>
  <div class="flex items-start justify-between gap-4">
    <div><p class="text-sm font-medium text-slate-500">{label}</p><p class={`mt-2 text-3xl font-bold tracking-tight ${accent ? 'text-brand-800' : 'text-slate-950'}`}>{value}</p>{#if detail}<p class="mt-1 text-xs text-slate-500">{detail}</p>{/if}</div>
    <span class={`inline-flex size-10 items-center justify-center rounded-xl ${accent ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}><Icon name={icon} /></span>
  </div>
</div>
