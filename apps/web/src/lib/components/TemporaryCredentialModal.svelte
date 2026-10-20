<script lang="ts">
  import Modal from './ui/Modal.svelte';
  type Credential = { account: { loginId: string | null }; temporaryPassword: string | null };
  let { open = $bindable(false), title, credential, linkedMessage = 'Akun yang sudah ada dan cocok telah dihubungkan. Password akun tidak diubah.', onClose }: {
    open?: boolean; title: string; credential: Credential | null; linkedMessage?: string; onClose: () => void;
  } = $props();
  let copyFeedback = $state('');
  async function copyTemporaryPassword() {
    if (!credential?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(credential.temporaryPassword);
      copyFeedback = 'Password disalin';
    } catch { copyFeedback = 'Tidak dapat menyalin otomatis. Salin password secara manual.'; }
  }
</script>

<!-- The plaintext lives only in the parent's component state and is cleared by onClose; it is never stored elsewhere. -->
<Modal bind:open {title} description="Sampaikan kredensial secara aman kepada pemilik akun." width="sm" closeOnBackdrop={false} onClose={() => { copyFeedback = ''; onClose(); }}>
  {#if credential}
    <dl class="space-y-4">
      <div><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Nomor Induk</dt><dd class="mt-1 font-mono text-base font-semibold text-slate-950">{credential.account.loginId}</dd></div>
      {#if credential.temporaryPassword}<div><dt class="text-xs font-bold uppercase tracking-wide text-slate-500">Password sementara</dt><dd class="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-lg font-bold tracking-wide text-slate-950">{credential.temporaryPassword}</dd></div>{/if}
    </dl>
    {#if credential.temporaryPassword}
      <p class="mt-4 text-sm font-semibold text-amber-800">Password ini hanya ditampilkan sekali.</p>
      <button type="button" class="mt-4 min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800" onclick={copyTemporaryPassword}>Salin Password</button>
      {#if copyFeedback}<p class="mt-2 text-sm text-slate-600" role="status">{copyFeedback}</p>{/if}
    {:else}<p class="mt-4 text-sm leading-6 text-slate-600">{linkedMessage}</p>{/if}
    <div class="mt-6 flex justify-end"><button type="button" class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800" onclick={() => open = false}>Tutup</button></div>
  {/if}
</Modal>
