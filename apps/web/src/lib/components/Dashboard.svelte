<script lang="ts">
  import type { AuthUser } from 'api';
  import { roleAreas } from '$lib/auth';
  let { user }: { user: AuthUser } = $props();
</script>

<svelte:head><title>Dashboard {roleAreas[user.role].label} · Kampusia</title></svelte:head>
<p class="text-sm text-slate-500">Dashboard / {roleAreas[user.role].label}</p>
<h1 class="mt-3 text-3xl font-semibold tracking-tight">Selamat datang di Kampusia</h1>
<p class="mt-3 text-slate-600">Anda masuk sebagai {roleAreas[user.role].label}.</p>
<section class="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
  <div class="mb-4 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">Ruang {roleAreas[user.role].label}</div>
  <h2 class="text-lg font-semibold">Dashboard Anda</h2>
  <p class="mt-2 max-w-xl text-sm leading-6 text-slate-500">Halaman ini menjadi beranda untuk aktivitas kampus Anda. Fitur akademik akan tersedia pada tahap berikutnya.</p>
</section>
