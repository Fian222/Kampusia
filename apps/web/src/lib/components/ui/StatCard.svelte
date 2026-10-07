<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  let { label, value, detail, icon = 'chart', accent = false, compact = false, embedded = false }: { label: string; value: string | number; detail?: string; icon?: IconName; accent?: boolean; compact?: boolean; embedded?: boolean } = $props();
</script>

<div class="stat-card" class:accent class:compact class:embedded>
  <div class="stat-heading"><p>{label}</p><Icon name={icon} size={18} /></div>
  <p class="stat-value">{value}</p>
  {#if detail}<p class="stat-detail">{detail}</p>{/if}
</div>

<style>
  .stat-card { min-width: 0; padding: 1.4rem; border: 1px solid var(--color-line); border-radius: .875rem; background: white; }
  .stat-card.embedded { border: 0; }
  .stat-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; color: var(--color-muted); font-size: .8125rem; line-height: 1.5; }
  .stat-heading :global(svg) { flex-shrink: 0; margin-top: .1rem; color: var(--color-brand-700); }
  .stat-value { margin-top: 1rem; color: var(--color-ink); font-size: 2rem; font-weight: 650; letter-spacing: -.035em; line-height: 1.15; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .stat-detail { margin-top: .5rem; color: var(--color-muted); font-size: .6875rem; line-height: 1.6; }
  .stat-card.accent { background: var(--color-brand-50); }
  .accent .stat-heading, .accent .stat-detail { color: var(--color-brand-800); }
  .compact { padding: 1rem; }
  .compact .stat-value { margin-top: .5rem; font-size: 1.25rem; }
  @media (max-width: 639px) { .stat-card { padding: 1.15rem 1rem; } .stat-heading { font-size: .75rem; } .stat-value { font-size: 1.75rem; } }
</style>
