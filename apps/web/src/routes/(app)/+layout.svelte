<script lang="ts">
  import { roleAreas } from '$lib/auth';
  import { page, navigating } from '$app/state';
  import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';

  let { data, children } = $props();
  let menuOpen = $state(false);
  let drawer: HTMLDialogElement;
  let accountMenu: HTMLDetailsElement;

  $effect(() => {
    if (!drawer) return;
    if (menuOpen && !drawer.open) drawer.showModal();
    if (!menuOpen && drawer.open) drawer.close();
    if (!menuOpen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previousOverflow; };
  });

  $effect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) menuOpen = false; };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  });
  const area = $derived(roleAreas[data.user.role]);

  type NavItem = { path: string; label: string; icon: IconName; exact?: boolean };
  type NavGroup = { label: string; items: NavItem[] };
  const managerGroups: NavGroup[] = [
    { label: 'Ruang kerja', items: [{ path: '/akademik/krs', label: 'Manajemen KRS', icon: 'clipboard' }] },
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
    if (accountMenu) accountMenu.open = false;
  });
</script>

<svelte:head><meta name="theme-color" content="#183d39" /></svelte:head>
<svelte:window
  onkeydown={event => { if (event.key === 'Escape') { menuOpen = false; if (accountMenu) accountMenu.open = false; } }}
  onpointerdown={event => { if (accountMenu?.open && event.target instanceof Node && !accountMenu.contains(event.target)) accountMenu.open = false; }}
/>

{#snippet navigation(mobile = false)}
  <div class="brand-row">
    <a href={area.path} class="brand" onclick={() => menuOpen = false} aria-label="Kampusia, dashboard">
      <span class="brand-mark"><Icon name="graduation" size={25} strokeWidth={1.7} /></span>
      <span><span class="brand-name">Kampusia<span class="brand-dot">.</span></span><span class="brand-caption">Academic Suite</span></span>
    </a>
    {#if mobile}<button class="drawer-close" aria-label="Tutup menu" onclick={() => menuOpen = false}><Icon name="close" /></button>{/if}
  </div>
  <nav class="sidebar-nav" aria-label="Navigasi utama">
    <a href={area.path} aria-current={page.url.pathname === area.path ? 'page' : undefined} class="nav-link dashboard-link" class:active={page.url.pathname === area.path} onclick={() => menuOpen = false}>
      <Icon name="home" size={19} /><span>Dashboard</span>
    </a>
    {#each groups as group}
      <div class="nav-group">
        <p class="nav-group-label">{group.label}</p>
        {#each group.items as item}
          <a href={item.path} aria-current={isActive(item) ? 'page' : undefined} class="nav-link" class:active={isActive(item)} onclick={() => menuOpen = false}>
            <Icon name={item.icon} size={18} /><span>{item.label}</span>
          </a>
        {/each}
      </div>
    {/each}
  </nav>
  <div class="sidebar-footer">
    <span class="workspace-icon"><Icon name="building" size={18} /></span>
    <div><p>Ruang {area.label}</p><span>Sistem informasi akademik</span></div>
  </div>
{/snippet}

<div class="app-shell">
  <a class="skip-link" href="#main-content">Langsung ke konten</a>
  <aside class="app-sidebar" aria-label="Navigasi aplikasi">{@render navigation()}</aside>
  <dialog bind:this={drawer} class="mobile-drawer" aria-label="Navigasi aplikasi" onclose={() => menuOpen = false} onclick={event => { if (event.target === drawer) menuOpen = false; }}>
    <div class="drawer-content">{@render navigation(true)}</div>
  </dialog>
  <div class="workspace">
    <header class="workspace-header">
      <div class="header-location">
        <button class="menu-toggle" aria-label="Buka menu navigasi" aria-expanded={menuOpen} onclick={() => menuOpen = true}><Icon name="menu" /></button>
        <div class="breadcrumb"><span class="breadcrumb-area">Ruang {area.label}</span><span class="breadcrumb-divider" aria-hidden="true">/</span><span class="breadcrumb-current">{currentItem?.label ?? area.label}</span></div>
      </div>
      <details bind:this={accountMenu} class="account-menu">
        <summary aria-label={'Menu akun ' + (data.user.loginId ?? 'Akun')}>
          <UserAvatar label={data.user.loginId ?? 'Akun'} size="sm" />
          <span class="account-label"><span>{data.user.loginId ?? 'Belum diprovisikan'}</span><span class="account-role">{area.label}</span></span>
          <Icon name="chevron-down" size={16} class="account-chevron" />
        </summary>
        <div class="account-dropdown">
          <div class="account-info"><p>Nomor Induk</p><strong>{data.user.loginId ?? 'Belum diprovisikan'}</strong><span>Peran: {area.label}</span>{#if data.user.email}<span class="truncate">{data.user.email}</span>{/if}</div>
          <form method="POST" action="/logout"><button class="logout-action"><Icon name="logout" size={17} />Keluar dari akun</button></form>
        </div>
      </details>
    </header>
    {#if navigating.to && navigating.to.url.pathname !== page.url.pathname}<p role="status" class="navigation-status">Membuka halaman…</p>{/if}
    <main id="main-content" tabindex="-1" class="app-content">{@render children()}</main>
  </div>
</div>

<style>
  .app-shell { min-height: 100vh; background: var(--color-canvas); }
  .app-sidebar, .drawer-content { flex-direction: column; background: var(--color-ink); color: var(--color-sidebar-text); }
  .app-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; display: none; width: 16.5rem; }
  .brand-row { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; padding: 1.9rem 1.4rem 1.6rem; }
  .brand { display: flex; align-items: center; gap: .7rem; border-radius: .4rem; color: white; }
  .brand-mark { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border: 1px solid #698c7f; border-radius: .75rem; color: var(--color-highlight); }
  .brand-name { display: block; font-size: 1.4rem; font-weight: 700; letter-spacing: -.035em; line-height: 1.2; }
  .brand-dot { color: var(--color-highlight); }
  .brand-caption { display: block; margin-top: .25rem; font-size: .6875rem; color: var(--color-sidebar-muted); }
  .sidebar-nav { min-height: 0; flex: 1; overflow-y: auto; padding: .5rem 1rem 1.5rem; }
  @media (forced-colors: none) {
    .sidebar-nav {
      --sidebar-scroll-thumb: var(--color-ink-line);
      scrollbar-width: thin;
      scrollbar-color: var(--sidebar-scroll-thumb) transparent;
    }
    .sidebar-nav:hover, .sidebar-nav:focus-within {
      --sidebar-scroll-thumb: color-mix(in srgb, var(--color-sidebar-muted) 40%, var(--color-ink));
    }
    @supports selector(::-webkit-scrollbar) {
      /* Standard scrollbar properties override Chromium's pseudo-element styles. */
      .sidebar-nav { scrollbar-width: auto; scrollbar-color: auto; }
      .sidebar-nav::-webkit-scrollbar { width: 6px; background: transparent; }
      .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
      .sidebar-nav::-webkit-scrollbar-thumb {
        background: var(--sidebar-scroll-thumb);
        border-radius: 999px;
      }
      .sidebar-nav::-webkit-scrollbar-button { display: none; }
      .sidebar-nav::-webkit-scrollbar-corner { background: transparent; }
    }
  }
  .nav-link { display: flex; align-items: center; gap: .8rem; min-height: 2.75rem; padding: .6rem .8rem; margin-top: .2rem; border-radius: .5rem; color: var(--color-sidebar-text); font-size: .8125rem; font-weight: 500; transition: color 160ms ease, background-color 160ms ease; }
  .nav-link:hover { background: var(--color-ink-hover); color: white; }
  .nav-link.active { background: var(--color-highlight); color: var(--color-ink); font-weight: 650; }
  .nav-link:focus-visible, .brand:focus-visible, .drawer-close:focus-visible { outline-color: var(--color-highlight); }
  .nav-group { margin-top: 1.4rem; }
  .nav-group-label { margin: 0 0 .6rem .8rem; font-size: .6875rem; font-weight: 600; color: var(--color-sidebar-heading); }
  .sidebar-footer { display: flex; align-items: center; gap: .75rem; margin: 0 1.3rem; padding: 1.2rem 0; border-top: 1px solid var(--color-ink-line); }
  .workspace-icon { display: grid; place-items: center; height: 2.25rem; width: 2.25rem; border-radius: .5rem; background: var(--color-ink-hover); color: var(--color-sidebar-text); }
  .sidebar-footer p { font-size: .75rem; font-weight: 600; color: #ecf3ef; }
  .sidebar-footer span:not(.workspace-icon) { font-size: .625rem; color: var(--color-sidebar-muted); }
  .workspace-header { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4.5rem; padding: .65rem 1rem; border-bottom: 1px solid var(--color-line); background: var(--color-canvas); }
  .header-location { display: flex; align-items: center; gap: .75rem; min-width: 0; }
  .breadcrumb { display: flex; align-items: center; gap: .8rem; min-width: 0; font-size: .8125rem; }
  .breadcrumb-area, .breadcrumb-divider { display: none; }
  .breadcrumb-area { color: var(--color-muted); }
  .breadcrumb-divider { color: #939b97; }
  .breadcrumb-current { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .menu-toggle, .drawer-close { display: grid; place-items: center; flex-shrink: 0; min-width: 2.75rem; min-height: 2.75rem; border-radius: .5rem; }
  .menu-toggle { border: 1px solid var(--color-line); background: white; color: var(--color-ink); }
  .menu-toggle:hover { background: var(--color-brand-50); }
  .drawer-close { color: var(--color-sidebar-text); }
  .drawer-close:hover { background: var(--color-ink-hover); }
  .account-menu { position: relative; flex-shrink: 0; }
  .account-menu summary { display: flex; align-items: center; gap: .65rem; min-height: 2.75rem; padding: .3rem .5rem; border-radius: .6rem; list-style: none; }
  .account-menu summary::-webkit-details-marker { display: none; }
  .account-menu summary:hover { background: #e9ece5; }
  .account-label { display: none; max-width: 11rem; font-size: .75rem; font-weight: 650; }
  .account-label > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .account-role { margin-top: .2rem; color: var(--color-muted); font-size: .6875rem; font-weight: 400; }
  .account-menu :global(.account-chevron) { color: var(--color-muted); transition: transform 160ms ease; }
  .account-menu[open] :global(.account-chevron) { transform: rotate(180deg); }
  .account-dropdown { position: absolute; right: 0; width: min(17rem, calc(100vw - 2rem)); margin-top: .6rem; border-radius: .75rem; background: white; padding: .5rem; box-shadow: 0 12px 32px rgb(24 61 57 / .16); }
  .account-info { display: flex; flex-direction: column; gap: .35rem; padding: .75rem; border-bottom: 1px solid var(--color-line); font-size: .75rem; color: var(--color-muted); }
  .account-info strong { overflow-wrap: anywhere; color: var(--color-ink); font-weight: 600; }
  .logout-action { display: flex; align-items: center; gap: .6rem; min-height: 2.75rem; width: 100%; margin-top: .4rem; padding: .6rem .75rem; border-radius: .5rem; text-align: left; color: #b91c1c; font-size: .8125rem; font-weight: 600; }
  .logout-action:hover { background: #fef2f2; }
  .navigation-status { position: fixed; z-index: 35; inset: 4.5rem 0 auto; padding: .5rem 1rem; background: var(--color-brand-50); color: var(--color-brand-800); font-size: .8125rem; text-align: center; }
  .app-content { max-width: 90rem; width: 100%; margin: 0 auto; padding: 1.75rem 1rem 3rem; }
  .app-content:focus { outline: none; }
  .skip-link { position: fixed; left: 1rem; top: -5rem; z-index: 60; border-radius: .5rem; padding: .75rem 1rem; background: white; color: var(--color-ink); font-size: .875rem; font-weight: 600; }
  .skip-link:focus { top: 1rem; }
  .mobile-drawer { inset: 0 auto 0 0; margin: 0; padding: 0; border: 0; max-width: calc(100vw - 2rem); width: 18rem; max-height: none; height: 100dvh; background: var(--color-ink); box-shadow: 8px 0 40px rgb(15 35 32 / .2); }
  .mobile-drawer::backdrop { background: rgb(15 35 32 / .5); backdrop-filter: none; }
  .drawer-content { display: flex; height: 100%; }
  .mobile-drawer[open] .drawer-content { animation: drawer-reveal 180ms cubic-bezier(.22, 1, .36, 1); }
  @keyframes drawer-reveal { from { clip-path: inset(0 12% 0 0); } to { clip-path: inset(0); } }
  @media (min-width: 640px) { .workspace-header { padding-inline: 1.75rem; } .app-content { padding: 2.25rem 1.75rem 3rem; } .breadcrumb-area, .breadcrumb-divider { display: inline; } .account-label { display: block; } }
  @media (min-width: 1024px) { .app-sidebar { display: flex; } .workspace { padding-left: 16.5rem; } .workspace-header { padding-inline: 2.25rem; } .menu-toggle { display: none; } .app-content { padding: 2.5rem 2.25rem 3.5rem; } }
  @media (prefers-reduced-motion: reduce) { .mobile-drawer[open] .drawer-content { animation: none; } .nav-link, .account-menu :global(.account-chevron) { transition: none; } }
</style>
