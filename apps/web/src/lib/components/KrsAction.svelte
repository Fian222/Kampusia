<script lang="ts">
  let { id, mode, label, explanation }: { id: string; mode: string; label: string; explanation: string } = $props();
  let dialog: HTMLDialogElement;
</script>
<button type="button" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" onclick={() => dialog.showModal()}>{label}</button>
<dialog bind:this={dialog} class="m-auto max-w-md rounded-xl p-6 shadow-xl backdrop:bg-slate-900/40">
  <h3 class="font-semibold">{label}</h3><p class="my-4 text-sm">{explanation}</p>
  <form method="POST" class="flex gap-3">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} /><input type="hidden" name="confirmed" value="yes" />
    <button class="rounded-lg bg-teal-700 px-4 py-2 text-white">Konfirmasi</button><button type="button" class="rounded-lg border px-4 py-2" onclick={() => dialog.close()}>Kembali</button>
  </form>
</dialog>
<noscript><form method="POST" class="my-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} /><label><input type="checkbox" name="confirmed" value="yes" required /> {explanation}</label><button class="ml-3 underline">{label}</button></form></noscript>
