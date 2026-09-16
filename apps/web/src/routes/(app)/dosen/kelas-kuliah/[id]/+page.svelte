<script lang="ts">
  import MeetingManager from '$lib/components/MeetingManager.svelte';
  import GradingManager from '$lib/components/GradingManager.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data, form } = $props();
</script>
<svelte:head><title>{data.kelas.mataKuliah.kode} / {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<PageHeader eyebrow={`${data.kelas.mataKuliah.kode} / Kelas ${data.kelas.namaKelas}`} title={data.kelas.mataKuliah.nama} description="Kelola aktivitas pertemuan, kehadiran, dan penilaian kelas.">{#snippet actions()}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm" href="/dosen/kelas-kuliah"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}</PageHeader>
<section class="surface-panel mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p class="text-sm font-semibold text-slate-900">{data.kelas.semester.nama}</p><p class="mt-1 text-sm text-slate-500">{data.kelas.programStudi.nama}</p></div><Badge tone={data.kelas.status === 'DIBUKA' ? 'success' : data.kelas.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>{data.kelas.status}</Badge></section>
<MeetingManager meetings={data.meetings} area="dosen" {form} />
<GradingManager grading={data.grading} area="dosen" {form} />
