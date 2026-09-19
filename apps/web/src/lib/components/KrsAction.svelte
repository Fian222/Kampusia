<script lang="ts">
  import { enhance } from '$app/forms';
  import Icon from './ui/Icon.svelte';
  import Modal from './ui/Modal.svelte';

  let {
    id,
    mode,
    label,
    explanation,
    reasonLabel,
    disabled = false,
  }: {
    id: string;
    mode: string;
    label: string;
    explanation: string;
    reasonLabel?: string;
    disabled?: boolean;
  } = $props();

  let open = $state(false);
  let saving = $state(false);
  let localError = $state<string | null>(null);
  const dangerous = $derived(mode === 'cancel' || mode === 'reject' || mode === 'clear');

  function messageFrom(value: unknown) {
    if (!value || typeof value !== 'object' || !('message' in value)) return 'Tindakan belum dapat disimpan.';
    return typeof value.message === 'string' ? value.message : 'Tindakan belum dapat disimpan.';
  }

  const submit: NonNullable<Parameters<typeof enhance>[1]> = () => {
    saving = true;
    localError = null;
    return async ({ result, update }) => {
      try {
        if (result.type === 'failure') localError = messageFrom(result.data);
        await update({ reset: false, invalidateAll: true });
        if (result.type === 'success') open = false;
      } finally {
        saving = false;
      }
    };
  };
</script>
<button
  type="button"
  class={dangerous ? 'min-h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50' : 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50'}
  {disabled}
  onclick={() => { localError = null; open = true; }}
>{label}</button>

<Modal bind:open title={label} description={explanation} width="sm" closeDisabled={saving}>
  <div class={`mb-4 inline-flex size-10 items-center justify-center rounded-xl ${dangerous ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}><Icon name={dangerous ? 'alert' : 'check'} /></div>
  {#if localError}<p class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{localError}</p>{/if}
  <form method="POST" use:enhance={submit}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="mode" value={mode} />
    <input type="hidden" name="confirmed" value="yes" />
    {#if reasonLabel}<label class="mb-5 block text-sm font-semibold">{reasonLabel}<textarea name="alasan" required minlength="1" maxlength="2000" class="control-base mt-1.5 min-h-24" placeholder="Tuliskan alasan yang jelas"></textarea></label>{/if}
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" class="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" disabled={saving} onclick={() => open = false}>Kembali</button>
      <button class={`min-h-10 rounded-lg px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-70 ${dangerous ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-700 hover:bg-brand-800'}`} disabled={saving}>{saving ? 'Menyimpan…' : 'Ya, konfirmasi'}</button>
    </div>
  </form>
</Modal>
<noscript><form method="POST" class="my-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} />{#if reasonLabel}<label>{reasonLabel}<textarea name="alasan" required maxlength="2000"></textarea></label>{/if}<label><input type="checkbox" name="confirmed" value="yes" required /> {explanation}</label><button class="ml-3 underline">{label}</button></form></noscript>
