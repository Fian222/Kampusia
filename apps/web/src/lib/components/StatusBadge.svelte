<script lang="ts">let { active }: { active: boolean } = $props();</script>
<span class={active ? 'rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800' : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'}>{active ? 'Aktif' : 'Nonaktif'}</span>
