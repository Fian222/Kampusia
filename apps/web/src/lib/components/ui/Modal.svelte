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
  let phase = $state<'closed' | 'opening' | 'open' | 'closing'>('closed');
  let openingFrame: number | undefined;
  let closeFallback: number | undefined;
  const closing = $derived(phase === 'closing');
  const motionDuration = 200;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelOpeningFrame() {
    if (openingFrame !== undefined) cancelAnimationFrame(openingFrame);
    openingFrame = undefined;
  }

  function cancelCloseFallback() {
    if (closeFallback !== undefined) window.clearTimeout(closeFallback);
    closeFallback = undefined;
  }

  function finishClose() {
    if (!dialog.open || phase !== 'closing') return;
    cancelCloseFallback();
    phase = 'closed';
    dialog.close();
  }

  function beginClose() {
    if (!dialog.open || phase === 'closing') return;
    cancelOpeningFrame();
    phase = 'closing';

    if (reducedMotion()) {
      finishClose();
      return;
    }

    void tick().then(() => {
      if (phase === 'closing' && closeFallback === undefined) {
        closeFallback = window.setTimeout(finishClose, motionDuration);
      }
    });
  }

  function beginOpen() {
    if (dialog.open) {
      if (phase === 'closing') {
        cancelCloseFallback();
        phase = 'open';
      }
      return;
    }

    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    scrollLocked = true;
    phase = 'opening';
    dialog.showModal();

    void tick().then(() => {
      dialog.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), select, textarea, button')?.focus();
      if (reducedMotion()) {
        phase = 'open';
        return;
      }

      // Two frames ensure the hidden starting styles are painted before transitioning in.
      openingFrame = requestAnimationFrame(() => {
        openingFrame = requestAnimationFrame(() => {
          openingFrame = undefined;
          if (open && dialog.open && phase === 'opening') phase = 'open';
        });
      });
    });
  }

  function unlock() {
    if (scrollLocked && typeof document !== 'undefined') {
      document.documentElement.style.overflow = previousOverflow;
      scrollLocked = false;
    }
  }

  function requestClose() {
    if (closeDisabled || phase === 'closing') return;
    open = false;
    beginClose();
  }

  $effect(() => {
    if (!dialog) return;
    if (open) beginOpen();
    else beginClose();
  });
  onDestroy(() => {
    cancelOpeningFrame();
    cancelCloseFallback();
    unlock();
  });
</script>

<dialog
  bind:this={dialog}
  data-state={phase}
  inert={closing}
  class={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${widths[width]} overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 sm:max-h-[calc(100dvh-4rem)]`}
  aria-label={title}
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  ontransitionend={(event) => { if (event.target === dialog && event.propertyName === 'opacity') finishClose(); }}
  onclose={() => {
    cancelOpeningFrame();
    cancelCloseFallback();
    phase = 'closed';
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
      <button type="button" class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-600" aria-label={`Tutup ${title}`} disabled={closeDisabled || closing} onclick={requestClose}>
        <Icon name="close" size={19} />
      </button>
    </header>
    <div class="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  dialog {
    opacity: 0;
    pointer-events: none;
    transform: translateY(6px) scale(0.985);
    transition:
      opacity 200ms ease,
      transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  dialog::backdrop {
    opacity: 0;
    transition: opacity 200ms ease;
  }

  dialog[data-state='open'] {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }

  dialog[data-state='open']::backdrop {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    dialog {
      transform: none;
      transition: none;
    }

    dialog::backdrop {
      transition: none;
    }
  }
</style>
