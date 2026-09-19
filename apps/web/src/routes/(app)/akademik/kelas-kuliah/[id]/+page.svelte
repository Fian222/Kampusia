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
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  let lecturerOpen = $state(false);
  let scheduleOpen = $state(false);
  let editingScheduleId = $state<string>();
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  function scheduleHref(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set('schedule_page', String(number)); return '?' + p; }
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set('page', String(number)); return '?' + p; }
  const editingSchedule = $derived(data.schedules.data.find(row => row.id === editingScheduleId));
  const lecturerOptions = $derived(data.lecturers.data.map(row => ({ value: row.id, label: row.nama, description: [row.kodeDosen, row.nidn ? `NIDN ${row.nidn}` : ''].filter(Boolean).join(' · ') })));
  $effect(() => {
    if (form?.values?.mode === 'add' && !form.saved) lecturerOpen = true;
    if (form?.values?.mode === 'schedule-save' && !form.saved) {
      editingScheduleId = form.values.jadwal_id || undefined;
      scheduleOpen = true;
    }
  });
  const lecturerSubmit = () => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false }); if (result.type === 'success') lecturerOpen = false; } finally { saving = false; } }; };
  const scheduleSubmit = () => { saving = true; return async ({ update, result }: { update: (options: { reset: boolean }) => Promise<void>; result: { type: string } }) => { try { await update({ reset: false }); if (result.type === 'success') scheduleOpen = false; } finally { saving = false; } }; };
</script>
<svelte:head><title>Kelas {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`${data.kelas.mataKuliah.kode} / Kelas ${data.kelas.namaKelas}`} title={data.kelas.mataKuliah.nama} description={`${data.kelas.semester.nama} · ${data.kelas.programStudi.nama}`}>{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" href="/akademik/kelas-kuliah"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a><a class="inline-flex min-h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={`/akademik/kelas-kuliah?edit=${data.kelas.id}`} data-sveltekit-noscroll data-sveltekit-keepfocus>Edit kelas</a>{/snippet}</PageHeader>
<div class="mt-4"><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></div>
<section class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Kapasitas" value={data.kelas.kapasitas} icon="users" />
  <StatCard label="Mahasiswa aktif" value={data.kelas.jumlahMahasiswa} icon="graduation" accent />
  <StatCard label="Jadwal" value={data.kelas.jumlahJadwal} icon="calendar" />
  <StatCard label="Koordinator" value={data.kelas.dosen.find(row => row.isKoordinator)?.dosen.nama ?? '—'} icon="user" />
</section>
<nav class="sticky top-3 z-20 mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur" aria-label="Bagian ruang kerja kelas">
  {#each [['#ringkasan', 'Ringkasan'], ['#dosen', 'Dosen'], ['#jadwal', 'Jadwal'], ['#pertemuan', 'Pertemuan'], ['#nilai', 'Nilai'], ['#status', 'Status']] as item}
    <a class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900" href={item[0]}>{item[1]}</a>
  {/each}
</nav>
<div id="ringkasan" class="scroll-mt-24"><p class="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600"><Icon name="info" size={18} class="mt-0.5 shrink-0 text-amber-600" /> Kelas dapat dibuka setelah dosen, kurikulum, dan jadwalnya siap tanpa konflik.</p></div>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
{#if saving}<span role="status" class="sr-only">Menyimpan perubahan</span>{/if}
<section id="dosen" class={`${box} scroll-mt-24`}>
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">Dosen Pengajar</h2><p class="mt-2 text-sm text-slate-500">Koordinator opsional, maksimal satu. Lepaskan koordinator lama sebelum menunjuk dosen lain. Homebase tidak membatasi penugasan.</p></div><button type="button" class={button} onclick={() => lecturerOpen = true}><span class="inline-flex items-center gap-1.5"><Icon name="plus" size={15} /> Tambah Dosen</span></button></div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-3">Kode Dosen</th><th class="p-3">Nama</th><th class="p-3">Koordinator</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody>{#each data.assignments.data as row}<tr class="border-b border-slate-100"><td class="p-3">{row.dosen.kodeDosen}</td><td class="p-3">{row.dosen.nama}{row.dosen.isActive ? '' : ' (Nonaktif)'}</td><td class="p-3">{row.isKoordinator ? 'Ya' : 'Tidak'}</td><td class="p-3">
      <form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="update" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="is_koordinator" value={String(!row.isKoordinator)} /><button class={button} disabled={saving}>{row.isKoordinator ? 'Lepaskan koordinator' : 'Jadikan koordinator'}</button></form>
      <details class="mt-3"><summary class="cursor-pointer text-red-700">Hapus penugasan</summary><p class="my-2">Hapus penugasan {row.dosen.nama}? Kelas dibuka harus tetap memiliki dosen aktif.</p><form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="remove" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, hapus penugasan</button></form></details>
    </td></tr>{:else}<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada dosen pengajar.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.assignments.meta} {href} />
</section>
<Modal bind:open={lecturerOpen} title="Tambah Dosen Pengajar" description="Pilih dosen aktif dan tentukan apakah menjadi koordinator." closeDisabled={saving} width="md" onClose={() => { if (form?.values?.mode === 'add') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'add'}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  {#key JSON.stringify(form)}<form method="POST" action="?/detail" class="grid gap-4 sm:grid-cols-2" use:enhance={lecturerSubmit}>
    <input type="hidden" name="mode" value="add" />
    <ReferenceCombobox name="dosen_id" label="Dosen" value={form?.values?.mode === 'add' ? form.values.dosen_id ?? '' : ''} options={lecturerOptions} meta={data.lecturers.meta} searchParam="lecturer_search" pageParam="lecturer_page" placeholder="Pilih dosen aktif" searchPlaceholder="Cari nama, kode dosen, atau NIDN…" required />
    <AcademicFields values={form?.values?.mode === 'add' ? form.values : {}} fields={[
      { name: 'is_koordinator', label: 'Koordinator', value: 'false', options: [{ value: 'false', label: 'Tidak' }, { value: 'true', label: 'Ya' }] },
    ]} />
    <div class="flex justify-end gap-3 sm:col-span-2"><button type="button" class="px-4 py-2 text-sm font-semibold text-slate-600" disabled={saving} onclick={() => lecturerOpen = false}>Batal</button><button class={button} disabled={saving}>Tambah dosen</button></div>
  </form>{/key}
</Modal>

<section id="status" class={`${box} scroll-mt-24`}>
  <h2 class="font-semibold">Status Kelas</h2>
  <form method="POST" action="?/detail" class="mt-4 flex flex-wrap items-end gap-3" use:enhance={submit}>
    <input type="hidden" name="mode" value="status" />
    <AcademicFields fields={[{ name: 'status', label: 'Status baru', value: data.kelas.status, options: ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'].map(value => ({ value, label: value })) }]} />
    <label class="text-sm"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi perubahan status</label>
    <button class={button} disabled={saving}>Simpan status</button>
  </form>
</section>
<section id="jadwal" class={`${box} scroll-mt-24`}>
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">Jadwal Kuliah</h2><p class="mt-2 text-sm text-slate-500">Waktu Asia/Jakarta. Jadwal berulang pada rentang tanggal semester. Jam bersebelahan diperbolehkan.</p></div><button type="button" class={button} onclick={() => { editingScheduleId = undefined; scheduleOpen = true; }}><span class="inline-flex items-center gap-1.5"><Icon name="plus" size={15} /> Tambah Jadwal</span></button></div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="border-b text-slate-500"><tr>{#each ['Hari', 'Jam Mulai', 'Jam Selesai', 'Ruangan', 'Gedung', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.schedules.data as row}<tr class="border-b border-slate-100">
      <td class="p-3">{days[row.hari - 1]}</td><td class="p-3">{row.jamMulai}</td><td class="p-3">{row.jamSelesai}</td><td class="p-3">{row.ruangan.kode} — {row.ruangan.nama}</td><td class="p-3">{row.ruangan.gedung ?? '—'}</td>
      <td class="min-w-64 p-3"><button type="button" class="text-teal-800" aria-label={`Edit jadwal ${days[row.hari - 1]} ${row.jamMulai}`} onclick={() => { editingScheduleId = row.id; scheduleOpen = true; }}>Edit jadwal</button><details class="mt-3"><summary class="cursor-pointer text-red-700">Hapus jadwal</summary>
        <p class="my-2">Hapus jadwal ini? Jadwal dengan riwayat KRS disetujui tetap dipertahankan.</p>
        <form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="schedule-remove" /><input type="hidden" name="jadwal_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, hapus jadwal</button></form>
      </details></td>
    </tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada jadwal kuliah.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.schedules.meta} href={scheduleHref} />
</section>
<Modal bind:open={scheduleOpen} title={`${editingSchedule ? 'Edit' : 'Tambah'} Jadwal`} description="Jadwal divalidasi terhadap ruangan, dosen, kelas, dan mahasiswa." closeDisabled={saving} width="lg" onClose={() => { if (form?.values?.mode === 'schedule-save') void goto(page.url, { replaceState: true, noScroll: true, keepFocus: true }); }}>
  {#if form?.message && form.values?.mode === 'schedule-save' && (form.values.jadwal_id ?? '') === (editingScheduleId ?? '')}<p role="alert" class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{form.message}</p>{/if}
  <ScheduleForm action="?/detail" rooms={data.rooms.data} roomMeta={data.rooms.meta} schedule={editingSchedule} values={form?.values} {saving} submit={scheduleSubmit} />
  <a href="/akademik/ruangan" class="mt-4 inline-block text-sm text-teal-800">Kelola ruangan</a>
</Modal>
<div id="pertemuan" class="scroll-mt-24"><MeetingManager meetings={data.meetings} area="akademik" {form} /></div>
<div id="nilai" class="scroll-mt-24"><GradingManager grading={data.grading} area="akademik" {form} /></div>
