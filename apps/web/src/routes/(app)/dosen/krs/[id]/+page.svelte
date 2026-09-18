<script lang="ts">
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  let { data, form } = $props();
  const periodOpen = $derived(data.krs.semester.isActive && data.krs.semester.krsMulaiAt && data.krs.semester.krsSelesaiAt && new Date() >= new Date(data.krs.semester.krsMulaiAt) && new Date() < new Date(data.krs.semester.krsSelesaiAt));
</script>
<svelte:head><title>Tinjau Bimbingan KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Dosen / Bimbingan KRS" title="Tinjau KRS Mahasiswa" description="Validasi pilihan, jadwal, kapasitas, batas SKS, dan konteks IPS sebelum mengambil keputusan." />
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class="my-4 rounded-xl border bg-white p-4 text-sm">{form.message}</p>{/if}
{#if !periodOpen}<p class="my-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Periode peninjauan KRS tidak sedang dibuka. Detail tetap tersedia sebagai baca-saja.</p>{/if}
<KrsSummary krs={data.krs} />
<div class="my-5 flex flex-wrap gap-3">{#if data.krs.status === 'DIAJUKAN' && periodOpen}<KrsAction id={data.krs.id} mode="approve" label="Setujui KRS" explanation="Setujui setelah seluruh pilihan divalidasi ulang dan kursi dipastikan tersedia?" /><KrsAction id={data.krs.id} mode="reject" label="Tolak KRS" explanation="Mahasiswa akan menerima alasan ini dan dapat memperbaiki KRS selama periode masih dibuka." reasonLabel="Alasan penolakan" />{/if}{#if data.krs.status === 'DISETUJUI' && periodOpen}<KrsAction id={data.krs.id} mode="reopen" label="Buka kembali" explanation="KRS kembali DRAFT, kursi efektif dilepas, dan mahasiswa harus mengajukan ulang." />{/if}</div>
