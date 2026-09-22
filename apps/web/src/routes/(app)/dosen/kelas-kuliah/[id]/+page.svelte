<script lang="ts">
  import MeetingManager from '$lib/components/MeetingManager.svelte';
  import GradingManager from '$lib/components/GradingManager.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  let { data, form } = $props();
</script>
<svelte:head><title>{data.kelas.mataKuliah.kode} / {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`${data.kelas.mataKuliah.kode} / Kelas ${data.kelas.namaKelas}`} title={data.kelas.mataKuliah.nama} description="Catat absensi pada pertemuan yang dibuka Akademik dan kelola penilaian kelas.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" href="/dosen/kelas-kuliah"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}</PageHeader>
<div id="ringkasan" class="scroll-mt-24"><section class="surface-panel mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-sm font-semibold text-slate-900">{data.kelas.semester.nama}</p><p class="mt-1 text-sm text-slate-500">{data.kelas.programStudi.nama}</p></div><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></section>
<section class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Bobot mata kuliah" value={`${data.kelas.mataKuliah.sks} SKS`} icon="book" accent /><StatCard label="Kapasitas kelas" value={data.kelas.kapasitas} icon="users" /><StatCard label="Pertemuan tercatat" value={data.meetings.meta.total} icon="calendar" /><StatCard label="Kelengkapan nilai" value={`${data.grading.summary.completeStudents}/${data.grading.summary.totalStudents}`} detail={data.grading.summary.finalized ? 'Sudah final' : `${data.grading.summary.activeWeight}% bobot aktif`} icon="chart" /></section></div>
<nav class="sticky top-3 z-20 mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur" aria-label="Bagian ruang kerja kelas"><a class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" href="#ringkasan">Ringkasan</a><a class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" href="#pertemuan">Pertemuan / Absensi</a><a class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" href="#nilai">Penilaian</a></nav>
<div id="pertemuan" class="scroll-mt-24"><MeetingManager meetings={data.meetings} area="dosen" {form} /></div>
<div id="nilai" class="scroll-mt-24"><GradingManager grading={data.grading} area="dosen" {form} /></div>
