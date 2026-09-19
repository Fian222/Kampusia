<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import { onDestroy, tick, untrack } from 'svelte';
  import Icon from './ui/Icon.svelte';

  export type ReferenceOption = {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  };

  let {
    name,
    label,
    value = $bindable(''),
    options,
    selectedOption,
    meta,
    searchParam,
    pageParam,
    watchParams = [],
    placeholder = 'Pilih data',
    searchPlaceholder = 'Cari kode atau nama…',
    required = false,
    nullable = false,
    clearLabel,
    disabled = false,
    error,
    help,
    onValueChange,
  }: {
    name: string;
    label: string;
    value?: string;
    options: ReferenceOption[];
    selectedOption?: ReferenceOption | null;
    meta: { page: number; limit: number; total: number };
    searchParam: string;
    pageParam: string;
    watchParams?: string[];
    placeholder?: string;
    searchPlaceholder?: string;
    required?: boolean;
    nullable?: boolean;
    clearLabel?: string;
    disabled?: boolean;
    error?: string;
    help?: string;
    onValueChange?: (value: string, previousValue: string) => void;
  } = $props();

  const id = $derived(`reference-${name.replace(/[^a-z0-9_-]/gi, '-')}`);
  const listboxId = $derived(`${id}-listbox`);
  let root = $state<HTMLDivElement>();
  let searchInput = $state<HTMLInputElement>();
  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(-1);
  let loadedSearch = $state('');
  let shownOptions = $state<ReferenceOption[]>([]);
  let selectedMemory = $state<ReferenceOption | null>(null);
  let debounceTimer: number | undefined;
  const loading = $derived(Boolean(navigating?.to?.url.pathname === page.url.pathname
    && [searchParam, pageParam, ...watchParams].some(param => navigating.to!.url.searchParams.get(param) !== page.url.searchParams.get(param))));
  const hasMore = $derived(meta.page * meta.limit < meta.total);
  const allOptions = $derived.by(() => {
    const rows = [...shownOptions];
    if (selectedMemory?.value === value && !rows.some(option => option.value === selectedMemory?.value)) rows.unshift(selectedMemory);
    if (selectedOption?.value === value && !rows.some(option => option.value === selectedOption.value)) rows.unshift(selectedOption);
    return rows;
  });
  const selected = $derived(allOptions.find(option => option.value === value) ?? (selectedOption?.value === value ? selectedOption : null));

  $effect(() => {
    const currentSearch = page.url.searchParams.get(searchParam) ?? '';
    const incoming = options;
    const previous = untrack(() => shownOptions);
    const previousSearch = untrack(() => loadedSearch);
    let next: ReferenceOption[];
    if (meta.page > 1 && currentSearch === previousSearch) {
      next = [...previous, ...incoming.filter(option => !previous.some(existing => existing.value === option.value))];
    } else {
      next = [...incoming];
    }
    shownOptions = next;
    loadedSearch = currentSearch;
    query = currentSearch;
    if (untrack(() => activeIndex) >= next.length) activeIndex = next.length - 1;
  });

  function navigate(changes: Record<string, string | number | null>) {
    const url = new URL(page.url);
    for (const [key, next] of Object.entries(changes)) {
      if (next === null || next === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(next));
    }
    void goto(`${url.pathname}?${url.searchParams.toString()}${url.hash}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function search() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => navigate({ [searchParam]: query.trim() || null, [pageParam]: null }), 250);
  }

  async function show() {
    if (disabled) return;
    open = true;
    activeIndex = Math.max(0, allOptions.findIndex(option => option.value === value && !option.disabled));
    await tick();
    searchInput?.focus();
  }

  function choose(option: ReferenceOption) {
    if (option.disabled) return;
    const previous = value;
    value = option.value;
    selectedMemory = option;
    onValueChange?.(option.value, previous);
    open = false;
  }

  function clear() {
    const previous = value;
    value = '';
    selectedMemory = null;
    onValueChange?.('', previous);
    open = false;
  }

  function move(direction: 1 | -1) {
    if (!allOptions.length) return;
    let next = activeIndex;
    do next = (next + direction + allOptions.length) % allOptions.length;
    while (allOptions[next]?.disabled && next !== activeIndex);
    activeIndex = next;
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); const option = allOptions[activeIndex]; if (option) choose(option); }
    else if (event.key === 'Escape') { event.preventDefault(); open = false; }
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void show();
    } else if (event.key === 'Escape') open = false;
  }

  function handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !root?.contains(next)) open = false;
  }

  onDestroy(() => window.clearTimeout(debounceTimer));
</script>

<div class="relative" bind:this={root} onfocusout={handleFocusOut}>
  <label id={`${id}-label`} class="text-sm font-semibold text-slate-700" for={id}>{label}{#if required}<span class="ml-1 text-red-500" aria-hidden="true">*</span>{:else}<span class="ml-1 font-normal text-slate-400">(opsional)</span>{/if}</label>
  <input type="hidden" {name} {value} disabled={disabled} />
  <div class="relative mt-1.5">
    <button
      id={id}
      type="button"
      role="combobox"
      class="control-base flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      aria-labelledby={`${id}-label ${id}`}
      aria-controls={listboxId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-invalid={error ? 'true' : undefined}
      aria-required={required}
      aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
      aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      {disabled}
      onclick={() => open ? open = false : void show()}
      onkeydown={handleTriggerKeydown}
    >
      <span class="min-w-0 flex-1"><span class={`block truncate ${selected ? '' : 'text-slate-400'}`}>{selected?.label ?? placeholder}</span>{#if selected?.description}<span class="mt-0.5 block truncate text-xs font-normal text-slate-500">{selected.description}</span>{/if}</span>
      <Icon name="chevron-down" size={17} class={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {#if nullable && value && !disabled}
      <button type="button" class="absolute right-9 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={clearLabel ?? `Kosongkan ${label}`} onclick={(event) => { event.stopPropagation(); clear(); }}><Icon name="close" size={15} /></button>
    {/if}
  </div>

  {#if open}
    <div class="absolute z-50 mt-1.5 w-full min-w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div class="border-b border-slate-100 p-2.5">
        <div class="relative"><Icon name="search" size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input bind:this={searchInput} bind:value={query} class="control-base w-full pl-9" role="searchbox" aria-label={`Cari ${label}`} aria-controls={listboxId} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} placeholder={searchPlaceholder} oninput={search} onkeydown={handleSearchKeydown} /></div>
      </div>
      <div id={listboxId} role="listbox" aria-labelledby={`${id}-label`} class="max-h-64 overflow-y-auto p-1.5">
        {#if loading}<div class="flex items-center gap-2 px-3 py-3 text-sm text-slate-500" role="status"><span class="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"></span> Mencari data…</div>
        {:else if !allOptions.length}<div class="px-3 py-5 text-center text-sm text-slate-500">Tidak ada pilihan yang cocok.</div>
        {:else}
          {#each allOptions as option, index (option.value)}
            <div id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled} class={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none ${index === activeIndex ? 'bg-brand-50' : 'hover:bg-slate-50'} ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`} tabindex="-1" onmouseenter={() => activeIndex = index} onclick={() => choose(option)} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(option); } }}>
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold text-slate-800">{option.label}</span>{#if option.description}<span class="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span>{/if}</span>{#if option.value === value}<Icon name="check" size={16} class="shrink-0 text-brand-700" />{/if}
            </div>
          {/each}
        {/if}
        {#if hasMore && !loading}<button type="button" class="mt-1 w-full rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" onclick={() => navigate({ [pageParam]: meta.page + 1 })}>Muat lebih banyak</button>{/if}
      </div>
    </div>
  {/if}
  {#if error}<p id={`${id}-error`} class="mt-1.5 text-xs text-red-700">{error}</p>{:else if help}<p id={`${id}-help`} class="mt-1.5 text-xs text-slate-500">{help}</p>{/if}
</div>
