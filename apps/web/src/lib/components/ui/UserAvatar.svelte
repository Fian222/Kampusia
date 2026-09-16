<script lang="ts">
  let { label, size = 'md' }: { label: string; size?: 'sm' | 'md' | 'lg' } = $props();
  const initials = $derived(label.split(/[@\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'K');
  const sizes = { sm: 'size-8 text-[11px]', md: 'size-10 text-xs', lg: 'size-12 text-sm' };
</script>
<span class={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800 ring-1 ring-inset ring-brand-200 ${sizes[size]}`} aria-hidden="true">{initials}</span>
