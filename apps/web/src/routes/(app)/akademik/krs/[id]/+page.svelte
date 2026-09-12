<script lang="ts">
  import KrsSummary from '$lib/components/KrsSummary.svelte';
  import KrsAction from '$lib/components/KrsAction.svelte';
  let { data, form } = $props();
</script>
<svelte:head><title>Detail KRS · Kampusia</title></svelte:head>
<a href="/akademik/krs" class="text-sm text-teal-700 underline">Kembali ke daftar KRS</a>
<h1 class="mt-4 text-2xl font-bold">Peninjauan KRS</h1>
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
