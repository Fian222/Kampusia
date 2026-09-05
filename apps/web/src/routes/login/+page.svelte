<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head><title>Masuk · Kampusia</title></svelte:head>
<div class="min-h-screen bg-slate-50 px-5 py-12 flex items-center justify-center">
  <main class="w-full max-w-md">
    <a href="/" class="mb-8 block text-2xl font-bold tracking-tight text-slate-900">Kampusia<span class="text-teal-700">.</span></a>
    <section class="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <p class="text-xs font-semibold uppercase tracking-widest text-teal-700">Sistem Informasi Kampus</p>
      <h1 class="mt-3 text-2xl font-semibold text-slate-900">Masuk ke akun Anda</h1>
      <p class="mt-2 text-sm text-slate-500">Gunakan email dan kata sandi akun kampus.</p>
      <form method="POST" class="mt-7 space-y-5" use:enhance={() => {
        submitting = true;
        return async ({ update }) => { try { await update(); } finally { submitting = false; } };
      }}>
        {#if form?.message}
          <p role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>
        {/if}
        <div>
          <label for="email" class="mb-2 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required maxlength="254" value={form?.email ?? ''}
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
        </div>
        <div>
          <label for="password" class="mb-2 block text-sm font-medium text-slate-700">Kata sandi</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"
            class="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
        </div>
        <button disabled={submitting} class="w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
          {submitting ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </section>
    <p class="mt-6 text-center text-xs text-slate-500">Administrasi akademik dalam satu tempat.</p>
  </main>
</div>
