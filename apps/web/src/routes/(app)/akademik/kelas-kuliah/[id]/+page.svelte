<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import ReferenceCombobox from '$lib/components/ReferenceCombobox.svelte';
  import ScheduleForm from '$lib/components/ScheduleForm.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import MeetingManager from '$lib/components/MeetingManager.svelte';
  import GradingManager from '$lib/components/GradingManager.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { classWorkspaceTabHref, classWorkspaceTabs, resolveClassWorkspaceTab, type ClassWorkspaceTab } from '$lib/navigation/class-workspace';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let lecturerOpen = $state(false);
  let scheduleOpen = $state(false);
  let statusOpen = $state(false);
  let editingScheduleId = $state<string>();
  let feedbackVisible = $state(false);

  const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const subtleButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const activeTab = $derived(resolveClassWorkspaceTab(page.url.searchParams.get('tab')));
  const regularSchedule = $derived(data.schedules.data[0]);
  const editingSchedule = $derived(regularSchedule?.id === editingScheduleId ? regularSchedule : undefined);
  const coordinator = $derived(data.kelas.dosen.find(row => row.isKoordinator)?.dosen);
  const activeComponents = $derived(data.grading.components.filter((item: { isActive: boolean }) => item.isActive).length);
  const lecturerOptions = $derived(data.lecturers.data.map(row => ({ value: row.id, label: row.nama, description: [row.kodeDosen, row.nidn ? `NIDN ${row.nidn}` : ''].filter(Boolean).join(' · ') })));
  const lecturerError = $derived(!form?.saved && ['update', 'remove'].includes(form?.values?.mode ?? '') ? form?.message : undefined);
  const scheduleError = $derived(!form?.saved && form?.values?.mode === 'schedule-remove' ? form?.message : undefined);

  function tabHref(tab: ClassWorkspaceTab) { return classWorkspaceTabHref(page.url, tab); }
  function lecturerHref(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('page', String(number)); return `?${params}`; }
  function formatTime(value: string) { return value.slice(0, 5).replace(':', '.'); }

  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  const lecturerSubmit = () => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false }); if (result.type === 'success') lecturerOpen = false; } finally { saving = false; } }; };
  const scheduleSubmit = () => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false }); if (result.type === 'success') scheduleOpen = false; } finally { saving = false; } }; };
  const statusSubmit = () => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false }); if (result.type === 'success') statusOpen = false; } finally { saving = false; } }; };

  $effect(() => {
    if (form?.values?.mode === 'add' && !form.saved) lecturerOpen = true;
    if (form?.values?.mode === 'schedule-save' && !form.saved) { editingScheduleId = form.values.jadwal_id || undefined; scheduleOpen = true; }
    if (form?.values?.mode === 'status' && !form.saved) statusOpen = true;
  });

  $effect(() => {
    if (!form?.saved || !form.message) { feedbackVisible = false; return; }
    feedbackVisible = true;
    const timeout = window.setTimeout(() => { feedbackVisible = false; }, 4500);
    return () => window.clearTimeout(timeout);
  });
</script>

<svelte:head><title>Kelas {data.kelas.namaKelas} · Kampusia</title></svelte:head>

<section class="surface-panel p-5 sm:p-6">
  <PageHeader eyebrow={`${data.kelas.mataKuliah.kode} / Kelas ${data.kelas.namaKelas}`} title={data.kelas.mataKuliah.nama} description={`${data.kelas.semester.nama} · ${data.kelas.programStudi.nama}`}>
    {#snippet actions()}<a class={subtleButton} href="/akademik/kelas-kuliah"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}
  </PageHeader>
  <div class="mt-4 flex flex-wrap items-center gap-2"><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge><span class="text-sm text-slate-500">{data.kelas.mataKuliah.sks} SKS</span></div>
</section>

<section class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan metrik kelas">
  <StatCard compact label="Kapasitas" value={data.kelas.kapasitas} icon="users" />
  <StatCard compact label="Mahasiswa aktif" value={data.kelas.jumlahMahasiswa} icon="graduation" accent />
  <StatCard compact label="Jadwal" value={regularSchedule ? 'Tersedia' : 'Belum diatur'} icon="calendar" />
  <StatCard compact label="Koordinator" value={coordinator?.nama ?? '—'} detail={coordinator?.kodeDosen} icon="user" />
</section>

<nav class="sticky top-3 z-20 mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur" aria-label="Ruang kerja kelas">
  <div class="flex min-w-max gap-1">
    {#each classWorkspaceTabs as tab}
      <a href={tabHref(tab.id)} class={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab.id ? 'bg-brand-50 text-brand-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`} aria-current={activeTab === tab.id ? 'page' : undefined} data-sveltekit-noscroll data-sveltekit-keepfocus>{tab.label}</a>
    {/each}
  </div>
</nav>

{#if feedbackVisible && form?.message}
  <div class="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status"><span class="inline-flex items-center gap-2"><Icon name="check" size={16} /> {form.message}</span><button type="button" class="rounded p-1 text-emerald-700 hover:bg-emerald-100" aria-label="Tutup pemberitahuan" onclick={() => feedbackVisible = false}><Icon name="close" size={15} /></button></div>
{/if}
{#if saving}<span role="status" class="sr-only">Menyimpan perubahan</span>{/if}

{#if activeTab === 'overview'}
  <section class="mt-6" aria-labelledby="overview-heading">
    <div class="flex flex-wrap items-end justify-between gap-3"><div><p class="eyebrow">Ruang kerja akademik</p><h2 id="overview-heading" class="mt-2 text-xl font-bold">Ringkasan kelas</h2></div><p class="max-w-xl text-sm text-slate-500">Informasi utama dan kesiapan operasional kelas dalam satu tampilan.</p></div>
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <article class="surface-panel p-5 sm:p-6">
        <h3 class="font-bold text-slate-950">Informasi Kelas</h3>
        <dl class="mt-4 divide-y divide-slate-100 text-sm">
          <div class="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><dt class="text-slate-500">Mata kuliah</dt><dd class="font-semibold text-slate-900 sm:text-right">{data.kelas.mataKuliah.kode} · {data.kelas.mataKuliah.nama}</dd></div>
          <div class="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><dt class="text-slate-500">Semester</dt><dd class="font-semibold text-slate-900 sm:text-right">{data.kelas.semester.nama}</dd></div>
          <div class="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><dt class="text-slate-500">Program studi</dt><dd class="font-semibold text-slate-900 sm:text-right">{data.kelas.programStudi.nama}</dd></div>
          <div class="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><dt class="text-slate-500">Kelas</dt><dd class="font-semibold text-slate-900 sm:text-right">{data.kelas.namaKelas} · {data.kelas.kapasitas} kursi</dd></div>
          <div class="flex items-center justify-between gap-4 pt-3"><dt class="text-slate-500">Status</dt><dd><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></dd></div>
        </dl>
      </article>

      <article class="surface-panel p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3"><div><p class="eyebrow">Pengajaran</p><h3 class="mt-2 font-bold text-slate-950">Tim Pengajar</h3></div><span class="text-sm font-semibold text-slate-500">{data.assignments.meta.total} dosen</span></div>
        <div class="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 p-4"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icon name="user" size={19} /></span><div class="min-w-0"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Koordinator</p><p class="mt-1 truncate font-semibold text-slate-950">{coordinator?.nama ?? 'Belum ditentukan'}</p>{#if coordinator}<p class="mt-0.5 text-xs text-slate-500">{coordinator.kodeDosen}</p>{/if}</div></div>
        <a class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800" href={tabHref('lecturers')} data-sveltekit-noscroll>Kelola dosen <Icon name="arrow-right" size={15} /></a>
      </article>

      <article class="surface-panel p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3"><div><p class="eyebrow">Jadwal</p><h3 class="mt-2 font-bold text-slate-950">Waktu & Ruangan</h3></div><span class="text-sm font-semibold text-slate-500">{regularSchedule ? 'Tersedia' : 'Belum diatur'}</span></div>
        <div class="mt-4">
          {#if regularSchedule}
            <div class="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-3.5"><div><p class="font-semibold text-slate-900">{days[regularSchedule.hari - 1]} · {formatTime(regularSchedule.jamMulai)}–{formatTime(regularSchedule.jamSelesai)}</p><p class="mt-1 text-sm text-slate-500">{regularSchedule.ruangan.nama}{regularSchedule.ruangan.gedung ? ` · ${regularSchedule.ruangan.gedung}` : ''}</p></div><Icon name="clock" size={18} class="mt-0.5 shrink-0 text-slate-400" /></div>
          {:else}<p class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Belum ada jadwal kuliah.</p>{/if}
        </div>
        <a class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800" href={tabHref('schedule')} data-sveltekit-noscroll>Kelola jadwal <Icon name="arrow-right" size={15} /></a>
      </article>

      <article class="surface-panel p-5 sm:p-6">
        <p class="eyebrow">Aktivitas akademik</p><h3 class="mt-2 font-bold text-slate-950">Kesiapan Kelas</h3>
        <div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-xl bg-slate-50 p-4"><p class="text-2xl font-bold text-slate-950">{data.meetings.meta.total}</p><p class="mt-1 text-xs text-slate-500">Pertemuan</p></div><div class="rounded-xl bg-slate-50 p-4"><p class="text-2xl font-bold text-slate-950">{activeComponents}</p><p class="mt-1 text-xs text-slate-500">Komponen nilai aktif</p></div></div>
        <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2"><a class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800" href={tabHref('meetings')} data-sveltekit-noscroll>Lihat pertemuan <Icon name="arrow-right" size={15} /></a><a class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800" href={tabHref('grading')} data-sveltekit-noscroll>Kelola penilaian <Icon name="arrow-right" size={15} /></a></div>
      </article>
    </div>
  </section>
{:else if activeTab === 'lecturers'}
  <section class="surface-panel mt-6 p-5 sm:p-6" aria-labelledby="lecturers-heading">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="eyebrow">Tim pengajar</p><h2 id="lecturers-heading" class="mt-2 text-xl font-bold">Dosen Pengajar</h2></div><button type="button" class={button} onclick={() => lecturerOpen = true}><Icon name="plus" size={15} /> Tambah Dosen</button></div>
    {#if lecturerError}<p role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{lecturerError}</p>{/if}
    <div class="mt-5 divide-y divide-slate-100">
      {#each data.assignments.data as row}
        <article class="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-3"><span class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon name="user" size={18} /></span><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-semibold text-slate-950">{row.dosen.nama}</h3>{#if row.isKoordinator}<Badge tone="info">Koordinator</Badge>{/if}{#if !row.dosen.isActive}<Badge>Nonaktif</Badge>{/if}</div><p class="mt-1 font-mono text-xs font-semibold text-slate-500">{row.dosen.kodeDosen}</p></div></div>
          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
            <form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="update" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="is_koordinator" value={String(!row.isKoordinator)} /><button class="action-ghost" disabled={saving}>{row.isKoordinator ? 'Lepaskan' : 'Jadikan koordinator'}</button></form>
            <details class="relative"><summary class="inline-flex size-9 list-none items-center justify-center rounded-lg text-lg font-bold tracking-widest text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label={`Tindakan lain untuk ${row.dosen.nama}`}><span aria-hidden="true">•••</span></summary><div class="mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:absolute sm:right-0 sm:z-10"><p class="text-xs leading-5 text-slate-600">Hapus penugasan {row.dosen.nama}? Kelas dibuka harus tetap memiliki dosen aktif.</p><form method="POST" action="?/detail" class="mt-2" use:enhance={submit}><input type="hidden" name="mode" value="remove" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class="action-danger" disabled={saving}>Hapus penugasan</button></form></div></details>
          </div>
        </article>
      {:else}<p class="py-10 text-center text-sm text-slate-500">Belum ada dosen pengajar.</p>{/each}
    </div>
    <Pagination {...data.assignments.meta} href={lecturerHref} />
  </section>
{:else if activeTab === 'schedule'}
  <section class="surface-panel mt-6 p-5 sm:p-6" aria-labelledby="schedule-heading">
    <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="eyebrow">Operasional kelas</p><h2 id="schedule-heading" class="mt-2 text-xl font-bold">Jadwal Kuliah</h2><p class="mt-1 text-sm text-slate-500">Satu jadwal reguler dalam waktu lokal Asia/Jakarta.</p></div>{#if !regularSchedule}<button type="button" class={button} onclick={() => { editingScheduleId = undefined; scheduleOpen = true; }}><Icon name="plus" size={15} /> Atur Jadwal</button>{/if}</div>
    {#if scheduleError}<p role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{scheduleError}</p>{/if}
    <div class="mt-5">
      {#if regularSchedule}
        <article class="rounded-xl border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{days[regularSchedule.hari - 1]}</p><h3 class="mt-1 text-xl font-bold text-slate-950">{formatTime(regularSchedule.jamMulai)}–{formatTime(regularSchedule.jamSelesai)}</h3></div><span class="inline-flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon name="clock" size={17} /></span></div>
          <div class="mt-4 border-t border-slate-100 pt-3"><p class="font-semibold text-slate-900">{regularSchedule.ruangan.nama}</p><p class="mt-1 text-sm text-slate-500">{regularSchedule.ruangan.kode}{regularSchedule.ruangan.gedung ? ` · ${regularSchedule.ruangan.gedung}` : ''}</p></div>
          <div class="mt-4 flex items-center gap-2"><button type="button" class="action-secondary" aria-label={`Edit jadwal ${days[regularSchedule.hari - 1]} ${formatTime(regularSchedule.jamMulai)}`} onclick={() => { editingScheduleId = regularSchedule.id; scheduleOpen = true; }}>Edit Jadwal</button><details class="relative"><summary class="inline-flex size-9 list-none items-center justify-center rounded-lg text-lg font-bold tracking-widest text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label={`Tindakan lain jadwal ${days[regularSchedule.hari - 1]}`}><span aria-hidden="true">•••</span></summary><div class="mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:absolute sm:left-0 sm:z-10"><p class="text-xs leading-5 text-slate-600">Hapus jadwal ini? Jadwal dengan riwayat KRS disetujui tetap dipertahankan.</p><form method="POST" action="?/detail" class="mt-2" use:enhance={submit}><input type="hidden" name="mode" value="schedule-remove" /><input type="hidden" name="jadwal_id" value={regularSchedule.id} /><input type="hidden" name="confirm" value="yes" /><button class="action-danger" disabled={saving}>Hapus jadwal</button></form></div></details></div>
        </article>
      {:else}<p class="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Belum ada jadwal untuk kelas ini. Gunakan “Atur Jadwal” untuk menentukan jadwal reguler kelas.</p>{/if}
    </div>
  </section>
{:else if activeTab === 'meetings'}
  <MeetingManager meetings={data.meetings} area="akademik" {form} />
{:else if activeTab === 'grading'}
  <GradingManager grading={data.grading} area="akademik" {form} />
{:else if activeTab === 'settings'}
  <section class="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Pengaturan kelas">
    <article class="surface-panel p-5 sm:p-6"><p class="eyebrow">Konfigurasi</p><h2 class="mt-2 text-xl font-bold">Edit Kelas</h2><p class="mt-2 text-sm leading-6 text-slate-500">Perbarui mata kuliah, semester, program studi, nama kelas, dan kapasitas melalui formulir kelas.</p><a class={`${subtleButton} mt-5`} href={`/akademik/kelas-kuliah?edit=${data.kelas.id}`} data-sveltekit-noscroll data-sveltekit-keepfocus>Edit Kelas</a></article>
    <article class="surface-panel p-5 sm:p-6"><p class="eyebrow">Alur akademik</p><h2 class="mt-2 text-xl font-bold">Status Kelas</h2><div class="mt-4 flex flex-col items-stretch gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status saat ini</p><div class="mt-2"><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></div></div><button type="button" class={button} onclick={() => statusOpen = true}>Ubah Status</button></div><p class="mt-3 text-xs leading-5 text-slate-500">Perubahan tetap mengikuti validasi kesiapan dan transisi status kelas.</p></article>
  </section>
{/if}

<Modal bind:open={lecturerOpen} title="Tambah Dosen Pengajar" description="Pilih dosen aktif dan tentukan koordinator bila diperlukan." closeDisabled={saving} width="md" onClose={() => { if (form?.values?.mode === 'add') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'add'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key JSON.stringify(form)}<form method="POST" action="?/detail" class="grid gap-4 sm:grid-cols-2" use:enhance={lecturerSubmit}>
    <input type="hidden" name="mode" value="add" />
    <ReferenceCombobox name="dosen_id" label="Dosen" value={form?.values?.mode === 'add' ? form.values.dosen_id ?? '' : ''} options={lecturerOptions} meta={data.lecturers.meta} searchParam="lecturer_search" pageParam="lecturer_page" placeholder="Pilih dosen aktif" searchPlaceholder="Cari nama, kode dosen, atau NIDN…" required />
    <AcademicFields values={form?.values?.mode === 'add' ? form.values : {}} fields={[{ name: 'is_koordinator', label: 'Koordinator', value: 'false', options: [{ value: 'false', label: 'Tidak' }, { value: 'true', label: 'Ya' }] }]} />
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => lecturerOpen = false}>Batal</button><button class={button} disabled={saving}>Tambah dosen</button></div>
  </form>{/key}
</Modal>

<Modal bind:open={scheduleOpen} title={`${editingSchedule ? 'Edit' : 'Atur'} Jadwal`} description="Jadwal divalidasi terhadap ruangan, dosen, kelas, dan mahasiswa." closeDisabled={saving} width="lg" onClose={() => { if (form?.values?.mode === 'schedule-save') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'schedule-save' && (form.values.jadwal_id ?? '') === (editingScheduleId ?? '')}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <ScheduleForm action="?/detail" kelas={data.kelas} rooms={data.rooms.data} roomMeta={data.rooms.meta} schedule={editingSchedule} values={form?.values} {saving} submit={scheduleSubmit} />
  <a href="/akademik/ruangan" class="mt-4 inline-block text-sm font-semibold text-brand-700">Kelola ruangan</a>
</Modal>

<Modal bind:open={statusOpen} title="Ubah Status Kelas" description={`Status saat ini: ${data.kelas.status}`} closeDisabled={saving} width="sm" onClose={() => { if (form?.values?.mode === 'status') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'status'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <form method="POST" action="?/detail" class="grid gap-4" use:enhance={statusSubmit}>
    <input type="hidden" name="mode" value="status" />
    <AcademicFields values={form?.values?.mode === 'status' ? form.values : {}} fields={[{ name: 'status', label: 'Status baru', value: data.kelas.status, options: ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'].map(value => ({ value, label: value })) }]} />
    <label class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><input class="mt-0.5" type="checkbox" name="confirm" value="yes" required /> <span>Saya memahami dan mengonfirmasi perubahan status kelas.</span></label>
    <div class="flex justify-end gap-3"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => statusOpen = false}>Batal</button><button class={button} disabled={saving}>Simpan Status</button></div>
  </form>
</Modal>
