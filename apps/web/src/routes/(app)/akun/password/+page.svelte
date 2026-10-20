<script lang="ts">
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  let { form } = $props();
  let saving = $state(false);
</script>

<svelte:head><title>Ganti Kata Sandi · Kampusia</title></svelte:head>

<PageHeader eyebrow="Akun" title="Ganti Kata Sandi" description="Konfirmasi kata sandi saat ini, lalu buat kata sandi baru." />

<section class="surface-panel mt-6 max-w-xl p-5 sm:p-6" aria-label="Formulir ganti kata sandi">
  {#if form?.message}<p role={form.saved ? 'status' : 'alert'} class={`mb-5 rounded-lg border p-3 text-sm ${form.saved ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-red-200 bg-red-50 text-red-800'}`}>{form.message}</p>{/if}
  <form method="POST" class="space-y-4" use:enhance={() => { saving = true; return async ({ update }) => { try { await update(); } finally { saving = false; } }; }}>
    <label class="block text-sm font-semibold text-slate-700">Kata sandi saat ini
      <input class="control-base mt-1.5" name="current_password" type="password" autocomplete="current-password" maxlength="1024" required />
    </label>
    <label class="block text-sm font-semibold text-slate-700">Kata sandi baru
      <input class="control-base mt-1.5" name="new_password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required />
    </label>
    <label class="block text-sm font-semibold text-slate-700">Konfirmasi kata sandi baru
      <input class="control-base mt-1.5" name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required />
    </label>
    <p class="text-xs text-slate-500">Gunakan sedikitnya 12 karakter dan berbeda dari kata sandi saat ini.</p>
    <div class="flex justify-end"><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Kata Sandi'}</button></div>
  </form>
</section>
