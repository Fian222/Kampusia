<script lang="ts">
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data, form } = $props();
  const periodOpen = $derived(data.krs.semester.isActive && data.krs.semester.krsMulaiAt && data.krs.semester.krsSelesaiAt && new Date() >= new Date(data.krs.semester.krsMulaiAt) && new Date() < new Date(data.krs.semester.krsSelesaiAt));
</script>
<svelte:head><title>Detail KRS · Kampusia</title></svelte:head>
<PageHeader eyebrow="Akademik / Persetujuan KRS" title="Peninjauan KRS" description="Periksa kelas, jumlah SKS, dan kapasitas sebelum mengambil keputusan.">{#snippet actions()}<a href="/akademik/krs" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/snippet}</PageHeader>
{#if form?.message}<p role="status" class="my-4 rounded-lg border bg-white p-4">{form.message}</p>{/if}
<KrsSummary krs={data.krs} />
<div class="my-5 flex flex-wrap gap-3">
  {#if data.krs.status === 'DIAJUKAN' && periodOpen}
    <KrsAction id={data.krs.id} mode="approve" label="Setujui (override administratif)" explanation="Setujui seluruh pilihan sebagai override ADMIN/AKADEMIK setelah validasi ulang dan pemeriksaan kapasitas kelas?" />
    <KrsAction id={data.krs.id} mode="reject" label="Tolak (override administratif)" explanation="Tolak pengajuan sebagai override agar mahasiswa dapat memperbaikinya?" reasonLabel="Alasan penolakan" />
  {/if}
  {#if data.krs.status === 'DISETUJUI' && periodOpen}<KrsAction id={data.krs.id} mode="reopen" label="Buka kembali (override administratif)" explanation="KRS kembali DRAFT dan kursi dilepas. Mahasiswa wajib mengajukan ulang untuk mendapatkan persetujuan baru." />{/if}
  {#if data.krs.status !== 'DIBATALKAN'}<KrsAction id={data.krs.id} mode="cancel" label="Batalkan Administratif" explanation="Semua pilihan aktif dibatalkan dan kursi dilepas. KRS semester ini menjadi terminal; riwayat akademik tetap disimpan." reasonLabel="Alasan pembatalan administratif" />{/if}
</div>
