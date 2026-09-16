<script lang="ts">
  import type { Snippet } from 'svelte';
  let { tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; children: Snippet } = $props();
  const styles = { success: 'border-emerald-200 bg-emerald-50 text-emerald-700', warning: 'border-amber-200 bg-amber-50 text-amber-800', danger: 'border-red-200 bg-red-50 text-red-700', neutral: 'border-slate-200 bg-slate-100 text-slate-600', info: 'border-blue-200 bg-blue-50 text-blue-700' };
</script>
<span class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none ${styles[tone]}`}>{@render children()}</span>
