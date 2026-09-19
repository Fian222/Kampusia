<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
  let saving = $state(false);
</script>

<svelte:head><title>Ganti Password · Kampusia</title></svelte:head>

<main class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
  <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8" aria-labelledby="change-password-title">
    <p class="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Kampusia</p>
    <h1 id="change-password-title" class="mt-2 text-2xl font-bold text-slate-950">Ganti Password</h1>
    <p class="mt-2 text-sm leading-6 text-slate-600">Anda menggunakan password sementara. Buat password baru sebelum melanjutkan.</p>
    <p class="mt-3 font-mono text-sm font-semibold text-slate-800">{data.user.loginId}</p>
    {#if form?.message}<p role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
    <form method="POST" class="mt-6 space-y-4" use:enhance={() => { saving = true; return async ({ update }) => { try { await update(); } finally { saving = false; } }; }}>
      <label class="block text-sm font-semibold text-slate-700">Password baru
        <input class="control-base mt-1.5" name="new_password" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required />
      </label>
      <label class="block text-sm font-semibold text-slate-700">Konfirmasi password baru
        <input class="control-base mt-1.5" name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="1024" required />
      </label>
      <p class="text-xs text-slate-500">Gunakan sedikitnya 12 karakter.</p>
      <button class="min-h-11 w-full rounded-xl bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 disabled:opacity-50" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Password'}</button>
    </form>
    <form method="POST" action="/logout" class="mt-4 text-center"><button class="min-h-10 px-4 text-sm font-semibold text-slate-600 hover:text-slate-900">Keluar</button></form>
  </section>
</main>
