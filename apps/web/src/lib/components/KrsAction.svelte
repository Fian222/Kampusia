<script lang="ts">
  import Icon from './ui/Icon.svelte';
  let { id, mode, label, explanation }: { id: string; mode: string; label: string; explanation: string } = $props();
  let dialog: HTMLDialogElement;
  const dangerous = $derived(mode === 'cancel' || mode === 'reject');
</script>
<button type="button" class={dangerous ? 'min-h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50' : 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800'} onclick={() => dialog.showModal()}>{label}</button>
<dialog bind:this={dialog} class="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900" aria-labelledby={`krs-action-${mode}`}>
  <div class="p-6"><div class={`mb-4 inline-flex size-10 items-center justify-center rounded-xl ${dangerous ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}><Icon name={dangerous ? 'alert' : 'check'} /></div><h3 id={`krs-action-${mode}`} class="text-lg font-bold">{label}</h3><p class="mt-2 text-sm leading-6 text-slate-600">{explanation}</p></div>
  <form method="POST" class="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} /><input type="hidden" name="confirmed" value="yes" />
    <button type="button" class="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onclick={() => dialog.close()}>Kembali</button><button class={`min-h-10 rounded-lg px-4 text-sm font-semibold text-white shadow-sm ${dangerous ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-700 hover:bg-brand-800'}`}>Ya, konfirmasi</button>
  </form>
</dialog>
<noscript><form method="POST" class="my-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} /><label><input type="checkbox" name="confirmed" value="yes" required /> {explanation}</label><button class="ml-3 underline">{label}</button></form></noscript>
