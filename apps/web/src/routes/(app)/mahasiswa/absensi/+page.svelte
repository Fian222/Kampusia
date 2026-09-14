<script lang="ts">
  import Pagination from '$lib/components/Pagination.svelte';
  let { data } = $props();
  const href = (page: number) => `?page=${page}`;
</script>
<svelte:head><title>Riwayat Absensi · Kampusia</title></svelte:head>
<h1 class="text-3xl font-semibold">Riwayat Absensi</h1><p class="mt-2 text-slate-600">Catatan kehadiran yang telah direkam untuk akun mahasiswa Anda.</p>
<h2 class="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Ringkasan halaman ini</h2><section class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">{#each Object.entries(data.summary) as [status, total]}<div class="rounded-xl border bg-white p-4"><p class="text-sm text-slate-500">{status}</p><p class="text-2xl font-semibold">{total}</p></div>{/each}</section>
<section class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-4">Mata Kuliah</th><th class="p-4">Kelas</th><th class="p-4">Pertemuan</th><th class="p-4">Tanggal</th><th class="p-4">Materi</th><th class="p-4">Status</th></tr></thead>
  <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100"><td class="p-4">{row.mataKuliah.kode} — {row.mataKuliah.nama}</td><td class="p-4">{row.kelas.namaKelas}</td><td class="p-4">{row.pertemuan.nomorPertemuan}</td><td class="p-4">{row.pertemuan.tanggal}</td><td class="p-4">{row.pertemuan.materi ?? '—'}</td><td class="p-4"><span class="rounded-full bg-teal-50 px-2 py-1 text-teal-800">{row.status}</span></td></tr>{:else}<tr><td colspan="6" class="p-8 text-center text-slate-500">Belum ada absensi yang dicatat.</td></tr>{/each}</tbody>
</table></section><Pagination {...data.records.meta} {href} />
