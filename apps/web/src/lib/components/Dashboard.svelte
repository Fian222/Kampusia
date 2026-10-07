<script lang="ts">
  import type { DashboardData } from '$lib/server/dashboard';
  import { roleAreas } from '$lib/auth';
  import Badge from './ui/Badge.svelte';
  import Icon, { type IconName } from './ui/Icon.svelte';
  import PageHeader from './ui/PageHeader.svelte';
  import StatCard from './ui/StatCard.svelte';
  import { formatAcademicDateRange } from '$lib/date-format';

  let { data }: { data: DashboardData } = $props();
  type Shortcut = { title: string; description: string; href: string; icon: IconName };

  const managerShortcuts: Shortcut[] = [
    { title: 'Manajemen KRS', description: 'Tinjau KRS yang menunggu keputusan.', href: '/akademik/krs?status=DIAJUKAN', icon: 'clipboard' },
    { title: 'Kelas Kuliah', description: 'Kelola penawaran dan pantau pelaksanaan kelas.', href: '/akademik/kelas-kuliah', icon: 'presentation' },
    { title: 'Mahasiswa', description: 'Kelola profil dan buka hasil studi.', href: '/akademik/mahasiswa', icon: 'users' },
    { title: 'Semester', description: 'Atur semester aktif dan periode KRS.', href: '/akademik/semester', icon: 'calendar' },
  ];
  const lecturerShortcuts: Shortcut[] = [
    { title: 'Kelas yang Diajar', description: 'Lanjutkan absensi dan penilaian kelas.', href: '/dosen/kelas-kuliah', icon: 'presentation' },
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

<PageHeader {title} {description} />

{#if data.kind === 'manager'}
  {@const semester = data.manager.activeSemester}
  {@const period = periodState(semester)}
  <section class="context-panel" aria-labelledby="manager-context-title">
    <div class="context-heading"><span class="context-label"><Icon name="calendar" size={18} />Semester aktif</span><Badge tone={period.tone}>{period.label}</Badge></div>
    <div class="context-body">
      <div><h2 id="manager-context-title">{semester?.nama ?? 'Belum ditetapkan'}</h2>{#if semester}<p class="context-dates">{formatAcademicDateRange(semester.tanggalMulai, semester.tanggalSelesai)}</p>{/if}</div>
      <a href="/akademik/semester" class="context-action">Kelola semester <Icon name="arrow-right" size={17} /></a>
    </div>
  </section>

  <section class="metric-strip" aria-label="Ringkasan data akademik">
    <StatCard embedded label="Mahasiswa" value={data.manager.studentTotal} detail="Profil tersimpan" icon="users" />
    <StatCard embedded label="Dosen" value={data.manager.lecturerTotal} detail="Profil tersimpan" icon="user" />
    <StatCard embedded label="Kelas kuliah" value={data.manager.classTotal} detail="Seluruh semester" icon="presentation" />
    <StatCard embedded label="KRS menunggu review" value={data.manager.pendingKrsTotal} detail="Status DIAJUKAN" icon="clipboard" accent />
  </section>
{:else if data.kind === 'lecturer'}
  <section class="metric-strip" aria-label="Ringkasan ruang dosen">
    <StatCard embedded label="Kelas ditugaskan" value={data.lecturer.classes.meta.total} detail="Seluruh status kelas" icon="presentation" accent />
    <StatCard embedded label="KRS menunggu review" value={data.lecturer.pendingKrsTotal} detail="Mahasiswa bimbingan" icon="clipboard" />
    <StatCard embedded label="Nilai perlu dilengkapi" value={data.lecturer.gradingNeedsAttention} detail={`Dari ${data.lecturer.classes.data.length} kelas ditampilkan`} icon="chart" />
    <StatCard embedded label="Siap difinalisasi" value={data.lecturer.readyToFinalize} detail={`Dari ${data.lecturer.classes.data.length} kelas ditampilkan`} icon="check" />
  </section>

  <section class="class-panel" aria-labelledby="lecturer-classes-title">
    <div class="section-heading"><h2 id="lecturer-classes-title">Kelas terbaru</h2><a class="section-link" href="/dosen/kelas-kuliah">Lihat semua <Icon name="arrow-right" size={16} /></a></div>
    <ul class="divide-y divide-slate-100">
      {#each data.lecturer.classes.data as kelas}
        {@const grading = data.lecturer.gradingByClass[kelas.id]}
        <li><a class="class-row group" href={`/dosen/kelas-kuliah/${kelas.id}`}><span class="class-letter">{kelas.namaKelas}</span><span class="min-w-0 flex-1"><span class="block truncate font-semibold text-slate-900 group-hover:text-brand-800">{kelas.mataKuliah.nama}</span><span class="mt-0.5 block truncate text-xs text-slate-500">{kelas.mataKuliah.kode} · {kelas.semester.nama}</span>{#if grading}<span class="mt-1 block text-xs text-slate-500">Nilai lengkap {grading.summary.completeStudents}/{grading.summary.totalStudents} · Bobot {grading.summary.activeWeight}%</span>{/if}</span><span class="class-status"><Badge tone={grading?.summary.finalized ? 'success' : grading?.permissions.canFinalize && grading.kelas.status === 'DITUTUP' && grading.summary.activeWeight === '100.00' && grading.summary.missingScores === 0 && grading.summary.totalStudents > 0 ? 'info' : 'neutral'}>{grading?.summary.finalized ? 'Final' : grading?.permissions.canFinalize && grading.kelas.status === 'DITUTUP' && grading.summary.activeWeight === '100.00' && grading.summary.missingScores === 0 && grading.summary.totalStudents > 0 ? 'Siap final' : kelas.status}</Badge></span><Icon name="arrow-right" size={16} class="text-slate-400" /></a></li>
      {:else}
        <li class="px-5 py-8 text-center text-sm text-slate-500">Belum ada kelas yang ditugaskan.</li>
      {/each}
    </ul>
  </section>
{:else}
  {@const semester = data.student.activeSemester}
  {@const currentKrs = data.student.currentKrs}
  {@const period = periodState(semester)}
  <section class="context-panel" aria-labelledby="student-context-title">
    <div class="context-heading"><span class="context-label"><Icon name="calendar" size={18} />Semester aktif</span><div class="context-status"><Badge tone={period.tone}>{period.label}</Badge>{#if currentKrs}<Badge tone={krsTone(currentKrs.status)}>KRS {currentKrs.status}</Badge>{/if}</div></div>
    <div class="context-body">
      <div><h2 id="student-context-title">{semester?.nama ?? 'Belum ditetapkan'}</h2></div>
      <div class="adviser"><Icon name="user" size={20} /><div><p class="adviser-label">Dosen PA</p><p class="adviser-name">{data.student.dosenPa?.nama ?? 'Belum ditetapkan'}</p>{#if data.student.dosenPa}<p class="adviser-code">{data.student.dosenPa.kodeDosen}</p>{/if}</div></div>
    </div>
  </section>

  <section class="metric-strip" aria-label="Ringkasan akademik mahasiswa">
    <StatCard embedded label="SKS KRS" value={currentKrs ? `${currentKrs.totalSks}/${currentKrs.batasSks}` : '—'} detail={currentKrs ? `${currentKrs.remainingSks} SKS tersisa` : 'Belum ada KRS'} icon="clipboard" accent />
    <StatCard embedded label="IPS terbaru" value={data.student.latestSemesterResult?.ips ?? '—'} detail={data.student.latestSemesterResult ? `${data.student.latestSemesterResult.semester.nama}${data.student.latestSemesterResult.provisional ? ' · Hasil belum lengkap' : ''}` : 'Belum ada hasil final'} icon="chart" />
    <StatCard embedded label="IPK" value={data.student.cumulative.ipk ?? '—'} detail={`${data.student.cumulative.totalSksKumulatif} SKS kumulatif`} icon="graduation" />
    <StatCard embedded label="Catatan absensi" value={data.student.attendanceTotal} detail="Riwayat tercatat" icon="clock" />
  </section>
{/if}

<section class="shortcuts-section" aria-labelledby="shortcut-heading">
  <div class="section-heading"><h2 id="shortcut-heading">Lanjutkan pekerjaan</h2><span class="section-caption">Pintasan ruang {roleAreas[data.user.role].label}</span></div>
  <div class="shortcut-list">
    {#each shortcuts as item}
      <a href={item.href} class="shortcut-link">
        <span class="shortcut-icon"><Icon name={item.icon} size={21} /></span>
        <span class="shortcut-copy"><span class="shortcut-title">{item.title}</span><span class="shortcut-description">{item.description}</span></span>
        <span class="shortcut-arrow"><Icon name="arrow-right" size={18} /></span>
      </a>
    {/each}
  </div>
</section>

<style>
  .context-panel { margin-top: 1.75rem; padding: 1.5rem; border-radius: 1rem; background: var(--color-ink); color: var(--color-on-ink); }
  .context-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .85rem; }
  .context-label { display: inline-flex; align-items: center; gap: .65rem; color: var(--color-sidebar-text); font-size: .8125rem; font-weight: 500; }
  .context-status { display: flex; flex-wrap: wrap; gap: .5rem; }
  .context-body { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.25rem; margin-top: 1.25rem; }
  .context-panel h2 { color: var(--color-on-ink); font-size: 1.5rem; font-weight: 600; line-height: 1.3; letter-spacing: -.025em; overflow-wrap: anywhere; }
  .context-dates { margin-top: .5rem; color: var(--color-sidebar-text); font-size: .8125rem; line-height: 1.6; }
  .context-action { display: inline-flex; align-items: center; justify-content: center; gap: .75rem; min-height: 2.75rem; padding: .65rem 1rem; border-radius: .5rem; background: var(--color-highlight); color: var(--color-ink); font-size: .8125rem; font-weight: 650; }
  .context-action:hover { background: var(--color-highlight-hover); }
  .context-action:focus-visible { outline-color: var(--color-highlight); outline-offset: 4px; }
  .adviser { display: flex; align-items: center; gap: .85rem; border-top: 1px solid var(--color-ink-line); padding-top: 1rem; width: 100%; }
  .adviser-label, .adviser-code { color: var(--color-sidebar-text); font-size: .75rem; }
  .adviser-name { margin-top: .2rem; font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .adviser-code { margin-top: .25rem; }
  .metric-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 1.5rem; border: 1px solid var(--color-line); border-radius: .875rem; background: white; overflow: hidden; }
  .metric-strip :global(.stat-card) { min-width: 0; border-radius: 0; }
  .metric-strip :global(.stat-card:nth-child(2n)) { border-left: 1px solid var(--color-line); }
  .metric-strip :global(.stat-card:nth-child(n+3)) { border-top: 1px solid var(--color-line); }
  .class-panel, .shortcuts-section { margin-top: 2.25rem; }
  .section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .5rem 1rem; margin-bottom: 1rem; }
  .section-heading h2 { font-size: 1.125rem; font-weight: 650; letter-spacing: -.02em; }
  .section-caption { font-size: .75rem; color: var(--color-muted); }
  .section-link { display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; color: var(--color-brand-700); font-size: .8125rem; font-weight: 600; }
  .section-link:hover { color: var(--color-brand-900); }
  .class-panel ul { border: 1px solid var(--color-line); border-radius: .875rem; overflow: hidden; background: white; }
  .class-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem; }
  .class-row:hover { background: var(--color-brand-50); }
  .class-letter { display: grid; place-items: center; flex-shrink: 0; width: 2.5rem; height: 2.5rem; border: 1px solid var(--color-line); border-radius: .5rem; font-size: .875rem; font-weight: 650; color: var(--color-ink); }
  .class-status { max-width: 100%; }
  .class-status :global(span) { line-height: 1.4; white-space: normal; }
  .shortcut-list { display: grid; border: 1px solid var(--color-line); border-radius: .875rem; background: white; overflow: hidden; }
  .shortcut-link { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; min-width: 0; }
  .shortcut-link + .shortcut-link { border-top: 1px solid var(--color-line); }
  .shortcut-link:hover { background: var(--color-brand-50); }
  .shortcut-link:focus-visible { outline-offset: -3px; }
  .shortcut-icon { display: grid; place-items: center; flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: .625rem; background: var(--color-brand-50); color: var(--color-brand-700); }
  .shortcut-copy { flex: 1; min-width: 0; }
  .shortcut-title { display: block; color: var(--color-ink); font-size: .875rem; font-weight: 650; }
  .shortcut-description { display: block; margin-top: .35rem; color: var(--color-muted); font-size: .8125rem; line-height: 1.65; }
  .shortcut-arrow { color: var(--color-brand-700); flex-shrink: 0; }
  @media (min-width: 640px) { .context-panel { padding: 1.75rem 2rem; } .context-panel h2 { font-size: 1.75rem; } .adviser { width: auto; max-width: 45%; padding: 0 0 0 1.5rem; border-top: 0; border-left: 1px solid var(--color-ink-line); } .shortcut-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .shortcut-link:nth-child(2) { border-top: 0; } .shortcut-link:nth-child(2n) { border-left: 1px solid var(--color-line); } .shortcut-link:last-child:nth-child(odd) { grid-column: 1 / -1; } }
  @media (min-width: 1280px) { .metric-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); } .metric-strip :global(.stat-card:nth-child(n+3)) { border-top: 0; } .metric-strip :global(.stat-card + .stat-card) { border-left: 1px solid var(--color-line); } }
  @media (max-width: 399px) { .class-status { order: 1; flex-basis: 100%; padding-left: 3.5rem; } .shortcut-description { font-size: .75rem; } }
</style>
