<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicOptions from '$lib/components/AcademicOptions.svelte';
  import ScheduleForm from '$lib/components/ScheduleForm.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import MeetingManager from '$lib/components/MeetingManager.svelte';
  import GradingManager from '$lib/components/GradingManager.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  const box = 'surface-panel mt-6 p-5 sm:p-6';
  const button = 'min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  function scheduleHref(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set('schedule_page', String(number)); return '?' + p; }
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set('page', String(number)); return '?' + p; }
</script>
<svelte:head><title>Kelas {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`${data.kelas.mataKuliah.kode} / Kelas ${data.kelas.namaKelas}`} title={data.kelas.mataKuliah.nama} description={`${data.kelas.semester.nama} · ${data.kelas.programStudi.nama}`}>{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" href="/akademik/kelas-kuliah"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a><a class="inline-flex min-h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm" href={`/akademik/kelas-kuliah?edit=${data.kelas.id}#kelas-form`}>Edit kelas</a>{/snippet}</PageHeader>
<div class="mt-4"><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></div>
<section class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Kapasitas" value={data.kelas.kapasitas} icon="users" />
  <StatCard label="Mahasiswa aktif" value={data.kelas.jumlahMahasiswa} icon="graduation" accent />
  <StatCard label="Jadwal" value={data.kelas.jumlahJadwal} icon="calendar" />
  <StatCard label="Koordinator" value={data.kelas.dosen.find(row => row.isKoordinator)?.dosen.nama ?? '—'} icon="user" />
</section>
<p class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><Icon name="info" size={18} class="mt-0.5 shrink-0" /> Pembukaan kelas memerlukan prodi dan mata kuliah aktif, mata kuliah pada kurikulum prodi, dosen aktif, serta jadwal valid tanpa bentrok.</p>
<MeetingManager meetings={data.meetings} area="akademik" {form} />
<GradingManager grading={data.grading} area="akademik" {form} />
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
{#if saving}<p role="status" class="mt-3">Menyimpan…</p>{/if}
<section class={box}>
  <h2 class="font-semibold">Dosen Pengajar</h2><p class="mt-2 text-sm text-slate-500">Koordinator opsional, maksimal satu. Lepaskan koordinator lama sebelum menunjuk dosen lain. Homebase tidak membatasi penugasan.</p>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-3">Kode Dosen</th><th class="p-3">Nama</th><th class="p-3">Koordinator</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody>{#each data.assignments.data as row}<tr class="border-b border-slate-100"><td class="p-3">{row.dosen.kodeDosen}</td><td class="p-3">{row.dosen.nama}{row.dosen.isActive ? '' : ' (Nonaktif)'}</td><td class="p-3">{row.isKoordinator ? 'Ya' : 'Tidak'}</td><td class="p-3">
      <form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="update" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="is_koordinator" value={String(!row.isKoordinator)} /><button class={button} disabled={saving}>{row.isKoordinator ? 'Lepaskan koordinator' : 'Jadikan koordinator'}</button></form>
      <details class="mt-3"><summary class="cursor-pointer text-red-700">Hapus penugasan</summary><p class="my-2">Hapus penugasan {row.dosen.nama}? Kelas dibuka harus tetap memiliki dosen aktif.</p><form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="remove" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, hapus penugasan</button></form></details>
    </td></tr>{:else}<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada dosen pengajar.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.assignments.meta} {href} />
</section>
<AcademicOptions prefix="lecturer_" label="Dosen Aktif" meta={data.lecturers.meta} />
<section class={box}><h2 class="font-semibold">Tambah Dosen Pengajar</h2>
  {#key JSON.stringify(form)}<form method="POST" action="?/detail" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
    <input type="hidden" name="mode" value="add" />
    <AcademicFields values={form?.values?.mode === 'add' ? form.values : {}} fields={[
      { name: 'dosen_id', label: 'Dosen', options: data.lecturers.data.map(row => ({ value: row.id, label: row.kodeDosen + ' — ' + row.nama })) },
      { name: 'is_koordinator', label: 'Koordinator', value: 'false', options: [{ value: 'false', label: 'Tidak' }, { value: 'true', label: 'Ya' }] },
    ]} />
    <div><button class={button} disabled={saving}>Tambah dosen</button></div>
  </form>{/key}
</section>

<section class={box}>
  <h2 class="font-semibold">Status Kelas</h2>
  <form method="POST" action="?/detail" class="mt-4 flex flex-wrap items-end gap-3" use:enhance={submit}>
    <input type="hidden" name="mode" value="status" />
    <AcademicFields fields={[{ name: 'status', label: 'Status baru', value: data.kelas.status, options: ['DRAFT', 'DIBUKA', 'DITUTUP', 'DIBATALKAN'].map(value => ({ value, label: value })) }]} />
    <label class="text-sm"><input type="checkbox" name="confirm" value="yes" required /> Konfirmasi perubahan status</label>
    <button class={button} disabled={saving}>Simpan status</button>
  </form>
</section>
<section class={box}>
  <h2 class="font-semibold">Jadwal Kuliah</h2><p class="mt-2 text-sm text-slate-500">Waktu Asia/Jakarta. Jadwal berulang pada rentang tanggal semester. Jam bersebelahan diperbolehkan.</p>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="border-b text-slate-500"><tr>{#each ['Hari', 'Jam Mulai', 'Jam Selesai', 'Ruangan', 'Gedung', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.schedules.data as row}<tr class="border-b border-slate-100">
      <td class="p-3">{days[row.hari - 1]}</td><td class="p-3">{row.jamMulai}</td><td class="p-3">{row.jamSelesai}</td><td class="p-3">{row.ruangan.kode} — {row.ruangan.nama}</td><td class="p-3">{row.ruangan.gedung ?? '—'}</td>
      <td class="min-w-64 p-3"><details><summary class="cursor-pointer text-teal-800">Edit jadwal</summary>
        <ScheduleForm action="?/detail" rooms={data.rooms.data} slot={row} values={form?.values} {saving} {submit} />
      </details><details class="mt-3"><summary class="cursor-pointer text-red-700">Hapus jadwal</summary>
        <p class="my-2">Hapus jadwal ini? Jadwal dengan riwayat KRS disetujui tetap dipertahankan.</p>
        <form method="POST" action="?/detail" use:enhance={submit}><input type="hidden" name="mode" value="schedule-remove" /><input type="hidden" name="jadwal_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, hapus jadwal</button></form>
      </details></td>
    </tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada jadwal kuliah.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.schedules.meta} href={scheduleHref} />
</section>
<AcademicOptions prefix="room_" label="Ruangan Aktif" meta={data.rooms.meta} />
<section class={box}><h2 class="font-semibold">Tambah Jadwal</h2>
  <ScheduleForm action="?/detail" rooms={data.rooms.data} values={form?.values} {saving} {submit} />
  <a href="/akademik/ruangan" class="mt-4 inline-block text-sm text-teal-800">Kelola ruangan</a>
</section>
