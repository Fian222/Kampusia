<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import { onDestroy, tick, untrack } from 'svelte';
  import Icon from './ui/Icon.svelte';
  import { nextEnabledOption } from '$lib/navigation/reference-options';

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
  let trigger = $state<HTMLButtonElement>();
  let popup = $state<HTMLDivElement>();
  let popupStyle = $state('');
  let open = $state(false);
  let query = $state('');
  let lookupError = $state<string | null>(null);
  let lastLookupChanges: Record<string, string | number | null> = {};
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
    if (untrack(() => activeIndex) >= next.length) activeIndex = -1;
  });

  function navigate(changes: Record<string, string | number | null>) {
    lastLookupChanges = changes;
    lookupError = null;
    const url = new URL(page.url);
    for (const [key, next] of Object.entries(changes)) {
      if (next === null || next === '') url.searchParams.delete(key);
      else url.searchParams.set(key, String(next));
    }
    void goto(`${url.pathname}?${url.searchParams.toString()}${url.hash}`, { replaceState: true, noScroll: true, keepFocus: true }).catch(() => { lookupError = 'Pilihan belum dapat dimuat. Periksa koneksi lalu coba lagi.'; });
  }

  function search() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => navigate({ [searchParam]: query.trim() || null, [pageParam]: null }), 250);
  }

  async function show() {
    if (disabled) return;
    open = true;
    const selectedIndex = allOptions.findIndex(option => option.value === value && !option.disabled);
    activeIndex = selectedIndex >= 0 ? selectedIndex : nextEnabledOption(allOptions, -1, 1);
    await tick();
    searchInput?.focus();
  }

  function dismiss() {
    globalThis.clearTimeout(debounceTimer);
    open = false;
    trigger?.focus({ preventScroll: true });
  }

  function positionPopup() {
    if (!trigger || !popup) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const below = viewportTop + viewportHeight - rect.bottom - 12;
    const above = rect.top - viewportTop - 12;
    const height = Math.min(360, Math.max(below, above));
    const top = below >= Math.min(360, above) ? rect.bottom + 6 : Math.max(viewportTop + 8, rect.top - height - 6);
    const width = Math.min(rect.width, window.innerWidth - 24);
    popupStyle = `left: ${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px; top: ${top}px; width: ${width}px; max-height: ${Math.max(100, height)}px;`;
  }

  $effect(() => {
    if (!open || !popup) return;
    positionPopup();
    if (typeof popup.showPopover === 'function') popup.showPopover();
    const reposition = () => positionPopup();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
    };
  });

  function choose(option: ReferenceOption) {
    if (option.disabled) return;
    const previous = value;
    value = option.value;
    selectedMemory = option;
    onValueChange?.(option.value, previous);
    dismiss();
  }

  function clear() {
    const previous = value;
    value = '';
    selectedMemory = null;
    onValueChange?.('', previous);
    dismiss();
  }

  function move(direction: 1 | -1) {
    activeIndex = nextEnabledOption(allOptions, activeIndex, direction);
    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); if (query.trim() !== loadedSearch) { globalThis.clearTimeout(debounceTimer); navigate({ [searchParam]: query.trim() || null, [pageParam]: null }); } else if (!loading && activeIndex >= 0) { const option = allOptions[activeIndex]; if (option) choose(option); } }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); }
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void show();
    } else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); dismiss(); }
  }

  function handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !root?.contains(next)) { globalThis.clearTimeout(debounceTimer); open = false; }
  }

  onDestroy(() => globalThis.clearTimeout(debounceTimer));
</script>

<svelte:window
  onkeydown={event => { if (open && event.key === 'Escape' && event.target instanceof Node && root?.contains(event.target)) { event.preventDefault(); event.stopPropagation(); dismiss(); } }}
  onpointerdown={event => { if (open && event.target instanceof Node && !root?.contains(event.target)) { globalThis.clearTimeout(debounceTimer); open = false; } }}
/>

<div class="relative" bind:this={root} onfocusout={handleFocusOut}>
  <label id={`${id}-label`} class="text-sm font-semibold text-slate-700" for={id}>{label}{#if required}<span class="ml-1 text-red-500" aria-hidden="true">*</span>{:else}<span class="ml-1 font-normal text-slate-400">(opsional)</span>{/if}</label>
  <input type="hidden" {name} {value} disabled={disabled} />
  <div class="relative mt-1.5 flex items-center gap-2">
    <button
      id={id}
      bind:this={trigger}
      type="button"
      role="combobox"
      class="control-base flex min-w-0 w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      aria-labelledby={`${id}-label ${id}`}
      aria-controls={listboxId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-invalid={error ? 'true' : undefined}
      aria-required={required}
      aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
      aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      {disabled}
      onclick={() => open ? dismiss() : void show()}
      onkeydown={handleTriggerKeydown}
    >
      <span class="min-w-0 flex-1"><span class={`block truncate ${selected ? '' : 'text-slate-400'}`}>{selected?.label ?? placeholder}</span>{#if selected?.description}<span class="mt-0.5 block truncate text-xs font-normal text-slate-500">{selected.description}</span>{/if}</span>
      <Icon name="chevron-down" size={17} class={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {#if nullable && value && !disabled}
      <button type="button" class="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={clearLabel ?? `Kosongkan ${label}`} onclick={(event) => { event.stopPropagation(); clear(); }}><Icon name="close" size={15} /></button>
    {/if}
  </div>

  {#if open}
    <div bind:this={popup} popover="manual" style={popupStyle} class="reference-popup fixed z-50 m-0 flex flex-col overflow-hidden rounded-xl border border-line bg-white p-0 shadow-xl">
      <div class="border-b border-slate-100 p-2.5">
        <div class="relative"><Icon name="search" size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input bind:this={searchInput} bind:value={query} class="control-base w-full pl-9" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-label={`Cari ${label}`} aria-controls={listboxId} aria-activedescendant={!loading && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} placeholder={searchPlaceholder} oninput={search} onkeydown={handleSearchKeydown} /></div>
      </div>
      {#if lookupError}<p role="alert" class="p-3 text-sm text-red-700">{lookupError}<button type="button" class="action-secondary mt-2" onclick={() => navigate(lastLookupChanges)}>Coba lagi</button></p>{/if}
      <div id={listboxId} role="listbox" aria-labelledby={`${id}-label`} class="min-h-0 overflow-y-auto p-1.5">
        {#if loading}<div class="flex items-center gap-2 px-3 py-3 text-sm text-slate-500" role="status"><span class="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"></span> Mencari data…</div>
        {:else if !allOptions.length}<div class="px-3 py-5 text-center text-sm text-slate-500">Tidak ada pilihan yang cocok.</div>
        {:else}
          {#each allOptions as option, index (option.value)}
            <div id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled} class={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none ${index === activeIndex ? 'bg-brand-50' : 'hover:bg-slate-50'} ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`} tabindex="-1" onmouseenter={() => activeIndex = index} onclick={() => choose(option)} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(option); } }}>
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold text-slate-800">{option.label}</span>{#if option.description}<span class="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span>{/if}</span>{#if option.value === value}<Icon name="check" size={16} class="shrink-0 text-brand-700" />{/if}
            </div>
          {/each}
        {/if}
        {#if hasMore && !loading}<button type="button" class="mt-1 w-full rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" onclick={() => { globalThis.clearTimeout(debounceTimer); navigate(query.trim() === loadedSearch ? { [pageParam]: meta.page + 1 } : { [searchParam]: query.trim() || null, [pageParam]: null }); }}>Muat lebih banyak</button>{/if}
      </div>
    </div>
  {/if}
  {#if error}<p id={`${id}-error`} class="mt-1.5 text-xs text-red-700">{error}</p>{:else if help}<p id={`${id}-help`} class="mt-1.5 text-xs text-slate-500">{help}</p>{/if}
</div>

<style>
  .reference-popup { display: flex; }
  .reference-popup::backdrop { background: transparent; }
</style>
