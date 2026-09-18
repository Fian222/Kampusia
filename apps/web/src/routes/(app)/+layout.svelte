<script lang="ts">
  import { roleAreas } from '$lib/auth';
  import { page } from '$app/state';
  import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';

  let { data, children } = $props();
  let menuOpen = $state(false);
  const area = $derived(roleAreas[data.user.role]);

  type NavItem = { path: string; label: string; icon: IconName; exact?: boolean };
  type NavGroup = { label: string; items: NavItem[] };
  const managerGroups: NavGroup[] = [
    { label: 'Ruang kerja', items: [{ path: '/akademik/krs', label: 'Persetujuan KRS', icon: 'clipboard' }] },
    { label: 'Data akademik', items: [
      { path: '/akademik/fakultas', label: 'Fakultas', icon: 'building' },
      { path: '/akademik/program-studi', label: 'Program Studi', icon: 'graduation' },
      { path: '/akademik/mahasiswa', label: 'Mahasiswa', icon: 'users' },
      { path: '/akademik/dosen', label: 'Dosen', icon: 'user' },
      { path: '/akademik/mata-kuliah', label: 'Mata Kuliah', icon: 'book' },
      { path: '/akademik/kurikulum', label: 'Kurikulum', icon: 'layers' },
    ] },
    { label: 'Perkuliahan', items: [
      { path: '/akademik/semester', label: 'Semester', icon: 'calendar' },
      { path: '/akademik/kelas-kuliah', label: 'Kelas Kuliah', icon: 'presentation' },
      { path: '/akademik/ruangan', label: 'Ruangan', icon: 'door' },
    ] },
  ];
  const lecturerGroups: NavGroup[] = [{ label: 'Perkuliahan', items: [{ path: '/dosen/krs', label: 'Bimbingan KRS', icon: 'clipboard' }, { path: '/dosen/kelas-kuliah', label: 'Kelas yang Diajar', icon: 'presentation' }] }];
  const studentGroups: NavGroup[] = [{ label: 'Akademik', items: [
    { path: '/mahasiswa/krs', label: 'Kartu Rencana Studi', icon: 'clipboard' },
    { path: '/mahasiswa/khs', label: 'KHS & IPK', icon: 'chart' },
    { path: '/mahasiswa/absensi', label: 'Riwayat Absensi', icon: 'clock' },
  ] }];
  const groups = $derived(data.user.role === 'ADMIN' || data.user.role === 'AKADEMIK' ? managerGroups : data.user.role === 'DOSEN' ? lecturerGroups : studentGroups);
  const allItems = $derived([{ path: area.path, label: 'Dashboard', icon: 'home' as IconName, exact: true }, ...groups.flatMap(group => group.items)]);
  const currentItem = $derived(allItems.filter(item => item.exact ? page.url.pathname === item.path : page.url.pathname === item.path || page.url.pathname.startsWith(item.path + '/')).sort((a, b) => b.path.length - a.path.length)[0]);
  const isActive = (item: NavItem) => item.exact ? page.url.pathname === item.path : page.url.pathname === item.path || page.url.pathname.startsWith(item.path + '/');

  $effect(() => {
    page.url.pathname;
    menuOpen = false;
  });
</script>

<svelte:head><meta name="theme-color" content="#ffffff" /></svelte:head>
<svelte:window onkeydown={event => { if (event.key === 'Escape') menuOpen = false; }} />
<svelte:body class:overflow-hidden={menuOpen} />

<div class="min-h-screen bg-[#f7f8fa] text-slate-900">
  {#if menuOpen}<button class="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden" aria-label="Tutup navigasi" onclick={() => menuOpen = false}></button>{/if}

  <aside class={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`} aria-label="Navigasi aplikasi">
    <div class="flex h-20 shrink-0 items-center justify-between border-b border-slate-100 px-5">
      <a href={area.path} class="flex items-center gap-3 rounded-lg focus-visible:outline-offset-4" aria-label="Kampusia, dashboard">
        <span class="grid size-9 place-items-center rounded-xl bg-brand-700 text-sm font-black text-white shadow-sm">K</span>
        <span><span class="block text-lg font-bold tracking-[-0.025em] text-slate-950">Kampusia</span><span class="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Academic Suite</span></span>
      </a>
      <button class="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden" aria-label="Tutup menu" onclick={() => menuOpen = false}><Icon name="close" /></button>
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Navigasi utama">
      <a href={area.path} aria-current={page.url.pathname === area.path ? 'page' : undefined} class={`mb-5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${page.url.pathname === area.path ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
        <Icon name="home" size={19} /><span>Dashboard</span>
      </a>
      {#each groups as group}
        <div class="mb-5">
          <p class="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p>
          <div class="space-y-0.5">
            {#each group.items as item}
              <a href={item.path} aria-current={isActive(item) ? 'page' : undefined} class={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(item) ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                <Icon name={item.icon} size={18} class={isActive(item) ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600'} /><span>{item.label}</span>
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </nav>

    <div class="shrink-0 border-t border-slate-100 p-4">
      <div class="rounded-xl bg-slate-50 px-3 py-3"><p class="text-xs font-semibold text-slate-700">Ruang {area.label}</p><p class="mt-1 text-[11px] leading-4 text-slate-500">Sistem informasi akademik terintegrasi.</p></div>
    </div>
  </aside>

  <div class="lg:pl-[17rem]">
    <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div class="flex min-w-0 items-center gap-3">
        <button class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 shadow-sm hover:bg-slate-50 lg:hidden" aria-label="Buka menu navigasi" aria-expanded={menuOpen} onclick={() => menuOpen = true}><Icon name="menu" /></button>
        <div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{currentItem?.label ?? area.label}</p><p class="hidden text-xs text-slate-500 sm:block">Ruang {area.label}</p></div>
      </div>

      <details class="group relative">
        <summary class="flex list-none items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <UserAvatar label={data.user.email} />
          <span class="hidden min-w-0 text-left md:block"><span class="block max-w-44 truncate text-sm font-semibold text-slate-800">{data.user.email}</span><span class="block text-xs text-slate-500">{area.label}</span></span>
          <Icon name="chevron-down" size={16} class="hidden text-slate-400 transition-transform group-open:rotate-180 sm:block" />
        </summary>
        <div class="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div class="border-b border-slate-100 px-3 py-2.5"><p class="truncate text-sm font-semibold text-slate-900">{data.user.email}</p><p class="mt-0.5 text-xs text-slate-500">Peran: {area.label}</p></div>
          <form method="POST" action="/logout" class="pt-2"><button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"><Icon name="logout" size={17} />Keluar dari akun</button></form>
        </div>
      </details>
    </header>

    <main class="app-content mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">{@render children()}</main>
  </div>
</div>
