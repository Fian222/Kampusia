<script lang="ts">
  import type { AuthUser } from 'api';
  import { roleAreas } from '$lib/auth';
  import Icon, { type IconName } from './ui/Icon.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import UserAvatar from './ui/UserAvatar.svelte';

  let { user }: { user: AuthUser } = $props();
  type Shortcut = { title: string; description: string; href: string; icon: IconName };
  const manager: Shortcut[] = [
    { title: 'Mahasiswa', description: 'Kelola profil dan hasil studi mahasiswa.', href: '/akademik/mahasiswa', icon: 'users' },
    { title: 'Kelas kuliah', description: 'Atur penawaran, dosen, dan jadwal kelas.', href: '/akademik/kelas-kuliah', icon: 'presentation' },
    { title: 'Persetujuan KRS', description: 'Tinjau rencana studi yang diajukan.', href: '/akademik/krs', icon: 'clipboard' },
    { title: 'Semester', description: 'Kelola periode akademik dan status aktif.', href: '/akademik/semester', icon: 'calendar' },
  ];
  const shortcuts = $derived<Shortcut[]>(user.role === 'ADMIN' || user.role === 'AKADEMIK' ? manager : user.role === 'DOSEN' ? [
    { title: 'Kelas yang Diajar', description: 'Buka daftar kelas, pertemuan, absensi, dan penilaian.', href: '/dosen/kelas-kuliah', icon: 'presentation' },
  ] : [
    { title: 'Kartu Rencana Studi', description: 'Susun dan pantau status rencana studi semester.', href: '/mahasiswa/krs', icon: 'clipboard' },
    { title: 'KHS & IPK', description: 'Lihat hasil studi dan capaian akademik.', href: '/mahasiswa/khs', icon: 'chart' },
    { title: 'Riwayat Absensi', description: 'Pantau catatan kehadiran setiap pertemuan.', href: '/mahasiswa/absensi', icon: 'clock' },
  ]);
  const roleCopy = $derived(user.role === 'DOSEN' ? 'Kelola aktivitas perkuliahan, kehadiran, dan penilaian dari satu ruang kerja.' : user.role === 'MAHASISWA' ? 'Pantau rencana studi, kehadiran, dan hasil akademik Anda.' : 'Kelola operasional dan data akademik kampus secara terstruktur.');
</script>

<svelte:head><title>Dashboard {roleAreas[user.role].label} · Kampusia</title></svelte:head>

<PageHeader eyebrow={`Dashboard ${roleAreas[user.role].label}`} title="Selamat datang di Kampusia" description={roleCopy} />

<section class="mt-7 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-panel">
  <div class="relative grid gap-7 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
    <div class="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-brand-500/20 blur-3xl"></div>
    <div class="relative">
      <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-brand-100"><Icon name="sparkles" size={15} /> Ruang {roleAreas[user.role].label}</span>
      <h2 class="mt-4 text-2xl font-bold text-white">Semua aktivitas akademik, tetap terarah.</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Gunakan pintasan di bawah untuk melanjutkan pekerjaan utama sesuai akses Anda.</p>
    </div>
    <div class="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
      <UserAvatar label={user.email} size="lg" />
      <div class="min-w-0"><p class="max-w-56 truncate text-sm font-semibold">{user.email}</p><p class="mt-0.5 text-xs text-slate-400">Akun {roleAreas[user.role].label}</p></div>
    </div>
  </div>
</section>

<section class="mt-8" aria-labelledby="shortcut-heading">
  <div class="flex items-end justify-between gap-4"><div><h2 id="shortcut-heading" class="text-lg font-bold">Akses cepat</h2><p class="mt-1 text-sm text-slate-500">Pilih area yang ingin Anda buka.</p></div></div>
  <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#each shortcuts as item}
      <a href={item.href} class="group surface-panel flex min-h-40 flex-col p-5 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg focus-visible:outline-brand-700">
        <span class="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"><Icon name={item.icon} /></span>
        <h3 class="mt-5 font-bold text-slate-900 group-hover:text-brand-800">{item.title}</h3>
        <p class="mt-1.5 flex-1 text-sm leading-6 text-slate-500">{item.description}</p>
        <span class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">Buka <Icon name="arrow-right" size={16} class="transition-transform group-hover:translate-x-1" /></span>
      </a>
    {/each}
  </div>
</section>

<section class="surface-panel mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
  <div class="flex items-start gap-3"><span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="check" size={18} /></span><div><h2 class="text-sm font-bold">Sesi Anda aktif</h2><p class="mt-1 text-sm text-slate-500">Akses menu telah disesuaikan dengan peran {roleAreas[user.role].label}.</p></div></div>
  <p class="text-xs text-slate-400">Kampusia Academic Suite</p>
</section>
