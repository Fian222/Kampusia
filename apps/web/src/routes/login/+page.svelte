<script lang="ts">
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { form } = $props();
  let submitting = $state(false);
  let showPassword = $state(false);
  const features = [
    { icon: 'graduation' as const, label: 'Terintegrasi' },
    { icon: 'check' as const, label: 'Terpercaya' },
    { icon: 'users' as const, label: 'Multi-peran' },
  ];
</script>

<svelte:head>
  <title>Masuk · Kampusia</title>
  <meta name="description" content="Masuk ke sistem informasi akademik Kampusia." />
</svelte:head>

<main class="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(30rem,0.95fr)]">
  <section class="relative hidden overflow-hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14" aria-label="Tentang Kampusia">
    <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 20% 20%, #24a996 0, transparent 35%), radial-gradient(circle at 80% 75%, #176d63 0, transparent 32%);"></div>
    <div class="absolute inset-0 opacity-[0.045]" style="background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px); background-size: 48px 48px;"></div>
    <a href="/" class="relative flex w-fit items-center gap-3 rounded-lg focus-visible:outline-white">
      <span class="grid size-10 place-items-center rounded-xl bg-white text-sm font-black text-brand-800">K</span>
      <span class="text-xl font-bold tracking-[-0.025em]">Kampusia</span>
    </a>

    <div class="relative max-w-2xl pb-8">
      <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-100"><Icon name="sparkles" size={15} /> Academic Management Suite</span>
      <h1 class="mt-7 max-w-xl text-4xl font-bold leading-[1.12] tracking-[-0.04em] xl:text-5xl">Administrasi akademik yang terasa lebih sederhana.</h1>
      <p class="mt-5 max-w-xl text-base leading-7 text-slate-300">Satu ruang kerja yang terstruktur untuk mengelola data akademik, perkuliahan, KRS, kehadiran, dan hasil studi.</p>
      <div class="mt-9 grid max-w-lg grid-cols-3 gap-3 text-sm">
        {#each features as item}
          <div class="rounded-xl border border-white/10 bg-white/[0.06] p-3.5"><Icon name={item.icon} size={18} class="text-brand-300" /><p class="mt-2 font-medium text-slate-200">{item.label}</p></div>
        {/each}
      </div>
    </div>
    <p class="relative text-xs text-slate-500">Sistem Informasi Kampus · Kampusia</p>
  </section>

  <section class="flex min-h-screen items-center justify-center bg-[#f8fafb] px-5 py-10 sm:px-10">
    <div class="w-full max-w-md">
      <a href="/" class="mb-10 flex w-fit items-center gap-3 lg:hidden">
        <span class="grid size-10 place-items-center rounded-xl bg-brand-700 text-sm font-black text-white">K</span><span class="text-xl font-bold tracking-tight">Kampusia</span>
      </a>
      <p class="eyebrow">Selamat datang kembali</p>
      <h1 class="mt-3 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">Masuk ke akun Anda</h1>
      <p class="mt-3 text-sm leading-6 text-slate-600">Gunakan akun institusi yang telah diberikan untuk mengakses ruang kerja Anda.</p>

      {#if form?.message}
        <div role="alert" class="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span class="mt-0.5"><Icon name="alert" size={18} /></span><p>{form.message}</p></div>
      {/if}

      <form method="POST" class="mt-8 space-y-5" use:enhance={() => {
        submitting = true;
        return async ({ update }) => { try { await update(); } finally { submitting = false; } };
      }}>
        <div>
          <label for="login_id" class="mb-2 block text-sm font-semibold text-slate-700">Nomor Induk</label>
          <input id="login_id" name="login_id" type="text" autocomplete="username" inputmode="numeric" required maxlength="30" pattern="[0-9]+" value={form?.loginId ?? ''} placeholder="Masukkan NIM atau NIK" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm outline-none placeholder:text-slate-400" />
        </div>
        <div>
          <label for="password" class="mb-2 block text-sm font-semibold text-slate-700">Kata sandi</label>
          <div class="relative">
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autocomplete="current-password" required maxlength="1024" placeholder="Masukkan kata sandi" class="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-20 text-sm shadow-sm outline-none placeholder:text-slate-400" />
            <button type="button" class="absolute inset-y-1 right-1 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800" aria-pressed={showPassword} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onclick={() => showPassword = !showPassword}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button>
          </div>
        </div>
        <button disabled={submitting} class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
          {#if submitting}<span class="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true"></span>Memproses…{:else}Masuk <Icon name="arrow-right" size={17} />{/if}
        </button>
      </form>

      <div class="mt-8 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
        <Icon name="info" size={17} class="mt-0.5 shrink-0 text-slate-400" /><p>Akses diberikan sesuai peran akun. Hubungi administrator akademik jika Anda mengalami kendala masuk.</p>
      </div>
      <p class="mt-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} Kampusia</p>
    </div>
  </section>
</main>
