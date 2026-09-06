<script lang="ts">
  import { roleAreas } from '$lib/auth';
  import { page } from '$app/state';
  let { data, children } = $props();
  let menuOpen = $state(false);
  const area = $derived(roleAreas[data.user.role]);
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
  <aside class="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-r lg:border-b-0">
    <div class="flex h-20 items-center justify-between px-6">
      <a href={area.path} class="text-2xl font-bold tracking-tight">Kampusia<span class="text-teal-700">.</span></a>
      <button class="rounded-md border border-slate-200 px-3 py-2 text-sm lg:hidden" aria-expanded={menuOpen} aria-controls="sidebar-nav" onclick={() => menuOpen = !menuOpen}>Menu</button>
    </div>
    <nav id="sidebar-nav" class="px-4 pb-6 lg:block" class:hidden={!menuOpen} aria-label="Navigasi utama">
      <p class="px-3 py-4 text-xs font-semibold uppercase tracking-widest text-slate-400">{area.label}</p>
      <a href={area.path} aria-current={page.url.pathname === area.path ? 'page' : undefined} class="block rounded-lg px-3 py-3 text-sm font-semibold text-teal-800" class:bg-teal-50={page.url.pathname === area.path}>Dashboard</a>
      {#if data.user.role === 'ADMIN' || data.user.role === 'AKADEMIK'}
        {#each [{ path: '/akademik/fakultas', label: 'Fakultas' }, { path: '/akademik/program-studi', label: 'Program Studi' }] as item}
          <a href={item.path} aria-current={page.url.pathname === item.path ? 'page' : undefined} class="mt-1 block rounded-lg px-3 py-3 text-sm font-medium text-teal-800" class:bg-teal-50={page.url.pathname === item.path}>{item.label}</a>
        {/each}
      {/if}
    </nav>
    <p class="absolute bottom-6 hidden px-7 text-xs text-slate-400 lg:block">Sistem Informasi Kampus</p>
  </aside>
  <div class="lg:pl-64">
    <header class="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
      <span class="text-sm font-medium text-slate-500">Ruang {area.label}</span>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <p class="max-w-52 truncate text-sm font-medium">{data.user.email}</p>
          <p class="text-xs text-slate-500">{area.label}</p>
        </div>
        <form method="POST" action="/logout">
          <button class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Keluar</button>
        </form>
      </div>
    </header>
    <main class="mx-auto max-w-6xl p-5 sm:p-8">{@render children()}</main>
  </div>
</div>
