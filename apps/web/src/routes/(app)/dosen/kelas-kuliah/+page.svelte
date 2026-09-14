<script lang="ts">
  import Pagination from '$lib/components/Pagination.svelte';
  import { page } from '$app/state';
  let { data } = $props();
  function href(number: number) { const params = new URLSearchParams(page.url.searchParams); params.set('page', String(number)); return '?' + params; }
</script>
<svelte:head><title>Kelas yang Diajar · Kampusia</title></svelte:head>
<h1 class="text-3xl font-semibold">Kelas yang Diajar</h1><p class="mt-2 text-slate-600">Kelola pertemuan dan absensi hanya untuk kelas tempat Anda ditugaskan.</p>
<form class="mt-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
  <input class="min-w-60 flex-1 rounded-lg border p-2" name="search" value={data.query.search} placeholder="Cari kode, mata kuliah, atau kelas" />
  <select class="rounded-lg border p-2" name="status"><option value="">Semua status</option>{#each data.statuses as status}<option value={status} selected={data.query.status === status}>{status}</option>{/each}</select>
  <button class="rounded-lg bg-teal-700 px-4 py-2 text-white">Terapkan</button>
</form>
<section class="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-4">Mata Kuliah</th><th class="p-4">Kelas</th><th class="p-4">Semester</th><th class="p-4">Status</th><th class="p-4">Tindakan</th></tr></thead>
  <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100"><td class="p-4">{row.mataKuliah.kode} — {row.mataKuliah.nama}</td><td class="p-4">{row.namaKelas}</td><td class="p-4">{row.semester.nama}</td><td class="p-4">{row.status}</td><td class="p-4"><a class="text-teal-800" href={`/dosen/kelas-kuliah/${row.id}`}>Buka kelas</a></td></tr>{:else}<tr><td colspan="5" class="p-8 text-center text-slate-500">Belum ada kelas yang ditugaskan.</td></tr>{/each}</tbody>
</table></section><Pagination {...data.records.meta} {href} />
