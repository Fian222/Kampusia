<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { selectionPopover } from '$lib/actions/selection-popover';
  import { nextEnabledOption } from '$lib/navigation/reference-options';
  import Icon from './Icon.svelte';

  export type SelectOption = { value: string; label: string; disabled?: boolean };
  let { name, label, options, value = $bindable(''), required = false, disabled = false,
    placeholder = 'Pilih data', error, help, hideLabel = false, searchable = false,
    class: className = '',
  }: { name: string; label: string; options: SelectOption[]; value?: string; required?: boolean;
    disabled?: boolean; placeholder?: string; error?: string; help?: string; hideLabel?: boolean;
    searchable?: boolean; class?: string;
  } = $props();
  const id = $props.id();
  let enhanced = $state(false);
  let open = $state(false);
  let root: HTMLDivElement;
  let trigger = $state<HTMLButtonElement>();
  let native: HTMLSelectElement;
  let searchInput = $state<HTMLInputElement>();
  let query = $state('');
  let activeIndex = $state(-1);
  let invalid = $state(false);
  let typed = '';
  let typedAt = 0;
  const selected = $derived(options.find(option => option.value === value));
  const visibleOptions = $derived(options.filter(option => !searchable || option.label.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))));
  const message = $derived(error ?? (invalid ? `${label} wajib dipilih.` : undefined));

  onMount(() => {
    enhanced = true;
    const restore = () => { value = native.value; invalid = false; };
    const reset = () => { queueMicrotask(restore); };
    const form = native.form;
    form?.addEventListener('reset', reset);
    native.addEventListener('kampusia:restore', restore);
    return () => { form?.removeEventListener('reset', reset); native.removeEventListener('kampusia:restore', restore); };
  });
  $effect(() => { if (disabled) open = false; });
  function dismiss(returnFocus = true) {
    open = false;
    if (returnFocus) trigger?.focus({ preventScroll: true });
  }
  async function show(direction: 1 | -1 = 1) {
    if (disabled) return;
    query = '';
    open = true;
    activeIndex = options.findIndex(option => option.value === value && !option.disabled);
    if (activeIndex < 0) activeIndex = nextEnabledOption(options, -1, direction);
    await tick();
    if (searchable) searchInput?.focus();
    scrollActive();
  }
  async function choose(option: SelectOption | undefined) {
    if (!option || option.disabled || disabled) return;
    value = option.value;
    invalid = false;
    dismiss();
    await tick();
    native.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function scrollActive() { document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }); }
  function move(direction: 1 | -1) { activeIndex = nextEnabledOption(visibleOptions, activeIndex, direction); scrollActive(); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); dismiss(); }
    else if (event.key === 'Tab' && open) dismiss();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (open) move(event.key === 'ArrowDown' ? 1 : -1); else void show(event.key === 'ArrowDown' ? 1 : -1);
    } else if ((event.key === 'Home' || event.key === 'End') && (!searchable || event.target === trigger)) {
      event.preventDefault(); if (!open) void show(); activeIndex = nextEnabledOption(visibleOptions, -1, event.key === 'Home' ? 1 : -1); void tick().then(scrollActive);
    } else if (event.key === 'Enter' || event.key === ' ' && event.target === trigger) {
      event.preventDefault(); if (open) void choose(visibleOptions[activeIndex]); else void show();
    } else if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now(); typed = now - typedAt > 700 ? event.key : typed + event.key; typedAt = now;
      const prefix = [...typed].every(character => character === typed[0]) ? typed.charAt(0) : typed;
      for (let step = 1; step <= visibleOptions.length; step++) {
        const index = (activeIndex + step) % visibleOptions.length;
        const option = visibleOptions[index];
        if (option && !option.disabled && option.label.toLocaleLowerCase('id').startsWith(prefix.toLocaleLowerCase('id'))) {
          if (!open) void show();
          activeIndex = index; void tick().then(scrollActive); break;
        }
      }
    }
  }
</script>

<svelte:window onpointerdown={event => { if (open && event.target instanceof Node && !root.contains(event.target)) dismiss(false); }} />
<div bind:this={root} class={`selection-field ${className}`} data-enhanced={enhanced} onfocusout={event => { if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) dismiss(false); }}>
  <label id={`${id}-label`} for={enhanced ? id : `${id}-native`} class:sr-only={hideLabel} class="selection-label">{label}{#if required}<span class="ml-1 text-red-500" aria-hidden="true">*</span>{/if}</label>
  <!-- Native backing preserves FormData, reset, required validation and the no-JS path. -->
  <select bind:this={native} id={`${id}-native`} class="selection-native control-base" {name} {value} {required} {disabled} tabindex={enhanced ? -1 : undefined} aria-hidden={enhanced ? 'true' : undefined}
    onchange={() => { value = native.value; invalid = false; }}
    oninvalid={event => { if (enhanced) { event.preventDefault(); invalid = true; trigger?.focus(); } }}>
    {#if !options.some(option => option.value === '')}<option value="" disabled={required}>{placeholder}</option>{/if}
    {#each options as option}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
  </select>
  {#if enhanced}
    <button bind:this={trigger} id={id} type="button" class="selection-trigger control-base" {disabled} role="combobox" aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={`${id}-listbox`} aria-haspopup="listbox" aria-required={required} aria-invalid={message ? 'true' : undefined} aria-describedby={message ? `${id}-error` : help ? `${id}-help` : undefined} aria-activedescendant={open && !searchable && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} onclick={() => open ? dismiss() : void show()} onkeydown={keydown}>
      <span class="min-w-0 flex-1 truncate" class:text-muted={!selected}>{selected?.label ?? placeholder}</span><Icon name="chevron-down" size={17} class="shrink-0 text-muted" />
    </button>
  {/if}
  {#if open && enhanced}
    <div class="selection-popup" popover="manual" data-selection-popup use:selectionPopover={() => trigger}>
      {#if searchable}<div class="border-b border-line p-2.5"><input bind:this={searchInput} value={query} class="control-base" role="combobox" aria-label={`Cari ${label}`} aria-expanded={open} aria-controls={`${id}-listbox`} aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} placeholder="Cari kode atau nama…" oninput={event => { query = event.currentTarget.value; activeIndex = nextEnabledOption(visibleOptions, -1, 1); }} onkeydown={keydown} /></div>{/if}
      <div id={`${id}-listbox`} role="listbox" aria-labelledby={`${id}-label`} class="min-h-0 overflow-y-auto p-1.5">
        {#each visibleOptions as option, index (option.value)}<div id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled} class="selection-option" class:selection-active={index === activeIndex} tabindex="-1" onpointerdown={event => event.preventDefault()} onmouseenter={() => { if (!option.disabled) activeIndex = index; }} onclick={() => void choose(option)} onkeydown={keydown}><span class="min-w-0 flex-1 break-words">{option.label}</span>{#if option.value === value}<Icon name="check" size={16} class="shrink-0 text-brand-700" />{/if}</div>{:else}<p class="p-4 text-sm text-muted">Tidak ada pilihan yang cocok.</p>{/each}
      </div>
    </div>
  {/if}
  {#if message}<p id={`${id}-error`} role="alert" class="mt-1.5 text-xs text-red-700">{message}</p>{:else if help}<p id={`${id}-help`} class="mt-1.5 text-xs text-muted">{help}</p>{/if}
</div>
