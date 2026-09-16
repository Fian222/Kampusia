<script lang="ts">
  import Badge from './ui/Badge.svelte';
  let { active }: { active: boolean } = $props();
</script>
<Badge tone={active ? 'success' : 'neutral'}><span class={`size-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>{active ? 'Aktif' : 'Nonaktif'}</Badge>
