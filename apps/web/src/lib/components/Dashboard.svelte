<script lang="ts">
  import type { DashboardData } from '$lib/server/dashboard';
  import { roleAreas } from '$lib/auth';
  import Badge from './ui/Badge.svelte';
  import Icon, { type IconName } from './ui/Icon.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import StatCard from './ui/StatCard.svelte';

  let { data }: { data: DashboardData } = $props();
  type Shortcut = { title: string; description: string; href: string; icon: IconName };

  const managerShortcuts: Shortcut[] = [
    { title: 'Persetujuan KRS', description: 'Buka antrean dan riwayat keputusan KRS.', href: '/akademik/krs', icon: 'clipboard' },
    { title: 'Kelas Kuliah', description: 'Kelola penawaran, dosen, jadwal, dan nilai.', href: '/akademik/kelas-kuliah', icon: 'presentation' },
    { title: 'Mahasiswa', description: 'Kelola profil dan buka hasil studi.', href: '/akademik/mahasiswa', icon: 'users' },
    { title: 'Semester', description: 'Atur semester aktif dan periode KRS.', href: '/akademik/semester', icon: 'calendar' },
  ];
  const lecturerShortcuts: Shortcut[] = [
    { title: 'Kelas yang Diajar', description: 'Pertemuan, absensi, dan penilaian kelas.', href: '/dosen/kelas-kuliah', icon: 'presentation' },
    { title: 'Bimbingan KRS', description: 'Tinjau rencana studi mahasiswa bimbingan.', href: '/dosen/krs', icon: 'clipboard' },
  ];
  const studentShortcuts: Shortcut[] = [
    { title: 'Susun KRS', description: 'Pilih kelas dan pantau persetujuan Dosen PA.', href: '/mahasiswa/krs', icon: 'clipboard' },
    { title: 'KHS & IPK', description: 'Lihat hasil final dan capaian akademik.', href: '/mahasiswa/khs', icon: 'chart' },
    { title: 'Riwayat Absensi', description: 'Periksa catatan kehadiran perkuliahan.', href: '/mahasiswa/absensi', icon: 'clock' },
  ];
  const shortcuts = $derived(data.kind === 'manager' ? managerShortcuts : data.kind === 'lecturer' ? lecturerShortcuts : studentShortcuts);

  const title = $derived(data.user.role === 'ADMIN'
    ? 'Kendali operasional kampus'
    : data.user.role === 'AKADEMIK'
      ? 'Ruang kerja akademik'
      : data.user.role === 'DOSEN'
        ? 'Ruang mengajar Anda'
        : 'Ringkasan akademik Anda');
  const description = $derived(data.user.role === 'ADMIN'
    ? 'Pantau data inti dan pekerjaan akademik yang memerlukan perhatian.'
    : data.user.role === 'AKADEMIK'
      ? 'Kelola semester, kelas, dan alur akademik dari satu tempat.'
      : data.user.role === 'DOSEN'
        ? 'Lanjutkan pengajaran dan bimbingan akademik yang sedang berjalan.'
        : 'Lihat status semester, rencana studi, dan capaian terbaru Anda.');

  function periodState(semester: { isActive: boolean; krsMulaiAt: Date | string | null; krsSelesaiAt: Date | string | null } | null) {
    if (!semester) return { label: 'Belum ada semester aktif', tone: 'neutral' as const };
    if (!semester.krsMulaiAt || !semester.krsSelesaiAt) return { label: 'KRS belum dijadwalkan', tone: 'neutral' as const };
    const now = new Date();
    if (now < new Date(semester.krsMulaiAt)) return { label: 'KRS belum dibuka', tone: 'info' as const };
    if (now >= new Date(semester.krsSelesaiAt)) return { label: 'KRS ditutup', tone: 'warning' as const };
    return { label: 'KRS sedang dibuka', tone: 'success' as const };
  }

  function krsTone(status: string | undefined) {
    if (status === 'DISETUJUI') return 'success' as const;
    if (status === 'DIAJUKAN') return 'warning' as const;
    if (status === 'DITOLAK' || status === 'DIBATALKAN') return 'danger' as const;
    return 'neutral' as const;
  }
</script>

<svelte:head><title>Dashboard {roleAreas[data.user.role].label} · Kampusia</title></svelte:head>

<PageHeader eyebrow={`Dashboard / ${roleAreas[data.user.role].label}`} {title} {description} />

{#if data.kind === 'manager'}
  {@const semester = data.manager.activeSemester}
  {@const period = periodState(semester)}
  <section class="mt-6 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/70" aria-labelledby="manager-context-title">
    <div class="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm"><Icon name="calendar" /></span>
        <div><p class="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Semester aktif</p><h2 id="manager-context-title" class="mt-1 text-xl font-bold text-slate-950">{semester?.nama ?? 'Belum ditetapkan'}</h2>{#if semester}<p class="mt-1 text-sm text-slate-600">{semester.tanggalMulai} – {semester.tanggalSelesai}</p>{/if}</div>
      </div>
      <div class="flex flex-wrap items-center gap-3"><Badge tone={period.tone}>{period.label}</Badge><a href="/akademik/semester" class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50">Kelola semester <Icon name="arrow-right" size={15} /></a></div>
    </div>
  </section>

  <section class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan data akademik">
    <StatCard label="Mahasiswa" value={data.manager.studentTotal} detail="Profil tersimpan" icon="users" />
    <StatCard label="Dosen" value={data.manager.lecturerTotal} detail="Profil tersimpan" icon="user" />
    <StatCard label="Kelas kuliah" value={data.manager.classTotal} detail="Seluruh semester" icon="presentation" />
    <StatCard label="KRS menunggu review" value={data.manager.pendingKrsTotal} detail="Status DIAJUKAN" icon="clipboard" accent />
  </section>
{:else if data.kind === 'lecturer'}
  <section class="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Ringkasan ruang dosen">
    <StatCard label="Kelas ditugaskan" value={data.lecturer.classes.meta.total} detail="Seluruh status kelas" icon="presentation" accent />
    <StatCard label="KRS menunggu review" value={data.lecturer.pendingKrsTotal} detail="Mahasiswa bimbingan" icon="clipboard" />
  </section>

  <section class="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel" aria-labelledby="lecturer-classes-title">
    <div class="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><p class="eyebrow">Perkuliahan</p><h2 id="lecturer-classes-title" class="mt-1 text-lg font-bold">Kelas terbaru</h2></div><a class="text-sm font-semibold text-brand-700 hover:text-brand-800" href="/dosen/kelas-kuliah">Lihat semua</a></div>
    <ul class="divide-y divide-slate-100">
      {#each data.lecturer.classes.data as kelas}
        <li><a class="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 sm:px-6" href={`/dosen/kelas-kuliah/${kelas.id}`}><span class="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">{kelas.namaKelas}</span><span class="min-w-0 flex-1"><span class="block truncate font-semibold text-slate-900 group-hover:text-brand-800">{kelas.mataKuliah.nama}</span><span class="mt-0.5 block truncate text-xs text-slate-500">{kelas.mataKuliah.kode} · {kelas.semester.nama}</span></span><Badge tone={kelas.status === 'DIBUKA' ? 'success' : kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{kelas.status}</Badge><Icon name="arrow-right" size={16} class="text-slate-400" /></a></li>
      {:else}
        <li class="px-5 py-8 text-center text-sm text-slate-500">Belum ada kelas yang ditugaskan.</li>
      {/each}
    </ul>
  </section>
{:else}
  {@const semester = data.student.activeSemester}
  {@const currentKrs = data.student.currentKrs}
  {@const period = periodState(semester)}
  <section class="mt-6 overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/70" aria-labelledby="student-context-title">
    <div class="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div><p class="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Semester aktif</p><h2 id="student-context-title" class="mt-1 text-xl font-bold text-slate-950">{semester?.nama ?? 'Belum ditetapkan'}</h2><div class="mt-2 flex flex-wrap gap-2"><Badge tone={period.tone}>{period.label}</Badge>{#if currentKrs}<Badge tone={krsTone(currentKrs.status)}>KRS {currentKrs.status}</Badge>{/if}</div></div>
      <div class="rounded-xl border border-brand-100 bg-white px-4 py-3"><p class="text-xs text-slate-500">Dosen PA</p><p class="mt-1 font-semibold text-slate-900">{data.student.dosenPa?.nama ?? 'Belum ditetapkan'}</p>{#if data.student.dosenPa}<p class="mt-0.5 text-xs text-slate-500">{data.student.dosenPa.kodeDosen}</p>{/if}</div>
    </div>
  </section>

  <section class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan akademik mahasiswa">
    <StatCard label="SKS KRS" value={currentKrs ? `${currentKrs.totalSks}/${currentKrs.batasSks}` : '—'} detail={currentKrs ? `${currentKrs.remainingSks} SKS tersisa` : 'Belum ada KRS'} icon="clipboard" accent />
    <StatCard label="IPS terbaru" value={data.student.latestSemesterResult?.ips ?? '—'} detail={data.student.latestSemesterResult?.semester.nama ?? 'Belum ada hasil final'} icon="chart" />
    <StatCard label="IPK" value={data.student.cumulative.ipk ?? '—'} detail={`${data.student.cumulative.totalSksKumulatif} SKS kumulatif`} icon="graduation" />
    <StatCard label="Catatan absensi" value={data.student.attendanceTotal} detail="Riwayat tercatat" icon="clock" />
  </section>
{/if}

<section class="mt-8" aria-labelledby="shortcut-heading">
  <div><p class="eyebrow">Pintasan</p><h2 id="shortcut-heading" class="mt-1 text-lg font-bold">Lanjutkan pekerjaan</h2></div>
  <div class={`mt-4 grid gap-3 sm:grid-cols-2 ${shortcuts.length > 2 ? 'xl:grid-cols-4' : 'lg:grid-cols-2'}`}>
    {#each shortcuts as item}
      <a href={item.href} class="group flex min-h-32 items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-panel hover:border-brand-200 hover:bg-brand-50/30">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name={item.icon} /></span>
        <span class="min-w-0 flex-1"><span class="font-bold text-slate-900 group-hover:text-brand-800">{item.title}</span><span class="mt-1.5 block text-sm leading-5 text-slate-500">{item.description}</span><span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Buka <Icon name="arrow-right" size={15} /></span></span>
      </a>
    {/each}
  </div>
</section>
