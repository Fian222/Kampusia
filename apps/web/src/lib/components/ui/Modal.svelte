<script lang="ts">
  import { onDestroy, tick, type Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    title,
    description,
    width = 'md',
    closeOnBackdrop = true,
    closeDisabled = false,
    onClose,
    children,
  }: {
    open?: boolean;
    title: string;
    description?: string;
    width?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnBackdrop?: boolean;
    closeDisabled?: boolean;
    onClose?: () => void;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;
  let opener: HTMLElement | null = null;
  let previousOverflow = '';
  let scrollLocked = false;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  function unlock() {
    if (scrollLocked && typeof document !== 'undefined') {
      document.documentElement.style.overflow = previousOverflow;
      scrollLocked = false;
    }
  }

  function requestClose() {
    if (!closeDisabled) open = false;
  }

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      scrollLocked = true;
      dialog.showModal();
      void tick().then(() => dialog.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), select, textarea, button')?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });
  onDestroy(unlock);
</script>

<dialog
  bind:this={dialog}
  class={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${widths[width]} overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 sm:max-h-[calc(100dvh-4rem)]`}
  aria-label={title}
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  onclose={() => {
    open = false;
    unlock();
    opener?.focus({ preventScroll: true });
    onClose?.();
  }}
  onclick={(event) => { if (closeOnBackdrop && event.target === dialog) requestClose(); }}
>
  <div class="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[calc(100dvh-4rem)]">
    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-lg font-bold text-slate-950">{title}</h2>
        {#if description}<p class="mt-1 text-sm leading-6 text-slate-500">{description}</p>{/if}
      </div>
      <button type="button" class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-600" aria-label={`Tutup ${title}`} disabled={closeDisabled} onclick={requestClose}>
        <Icon name="close" size={19} />
      </button>
    </header>
    <div class="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
      {@render children()}
    </div>
  </div>
</dialog>
