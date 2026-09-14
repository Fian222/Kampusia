<script lang="ts">
  import MeetingManager from '$lib/components/MeetingManager.svelte';
  let { data, form } = $props();
</script>
<svelte:head><title>{data.kelas.mataKuliah.kode} / {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<a class="text-teal-800" href="/dosen/kelas-kuliah">← Kelas yang Diajar</a>
<h1 class="mt-3 text-3xl font-semibold">{data.kelas.mataKuliah.kode} — {data.kelas.mataKuliah.nama} / {data.kelas.namaKelas}</h1>
<section class="mt-6 rounded-xl border border-slate-200 bg-white p-5"><p>{data.kelas.semester.nama} · {data.kelas.programStudi.nama}</p><p class="mt-2 font-semibold">Status: {data.kelas.status}</p></section>
<MeetingManager meetings={data.meetings} area="dosen" {form} />
