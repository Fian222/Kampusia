<script lang="ts">
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data, form } = $props();
</script>
<svelte:head><title>Detail KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Persetujuan KRS" title="Peninjauan KRS" description="Periksa kelas, jumlah SKS, dan kapasitas sebelum mengambil keputusan.">{#snippet actions()}<a href="/akademik/krs" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}</PageHeader>
{#if form?.message}<p role="status" class="my-4 rounded-lg border bg-white p-4">{form.message}</p>{/if}
<KrsSummary krs={data.krs} />
<div class="my-5 flex flex-wrap gap-3">
  {#if data.krs.status === 'DIAJUKAN'}
    <KrsAction id={data.krs.id} mode="approve" label="Setujui" explanation="Setujui seluruh pilihan setelah validasi ulang dan pemeriksaan kapasitas kelas?" />
    <KrsAction id={data.krs.id} mode="reject" label="Tolak" explanation="Tolak pengajuan ini agar mahasiswa dapat membuka kembali dan memperbaikinya?" />
  {/if}
  {#if data.krs.status === 'DISETUJUI' && data.krs.semester.isActive}<KrsAction id={data.krs.id} mode="reopen" label="Buka kembali" explanation="KRS kembali DRAFT dan kursi dilepas. Mahasiswa wajib mengajukan ulang untuk mendapatkan persetujuan baru." />{/if}
  {#if data.krs.status !== 'DIBATALKAN'}<KrsAction id={data.krs.id} mode="cancel" label="Batalkan KRS" explanation="Semua pilihan aktif dibatalkan dan kursi dilepas. KRS semester ini tidak dapat dibuat ulang. Riwayat tetap disimpan." />{/if}
</div>
