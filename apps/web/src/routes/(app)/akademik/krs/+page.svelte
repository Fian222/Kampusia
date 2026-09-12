<script lang="ts">
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  let { data } = $props();
  function href(key: string, value: number) { const p = new URLSearchParams(page.url.searchParams); p.set(key, String(value)); return '?' + p; }
</script>
<svelte:head><title>Manajemen KRS · Kampusia</title></svelte:head>
<h1 class="text-2xl font-bold">Manajemen KRS</h1>
<form method="GET" class="my-5 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
  <label class="text-sm">NIM / nama<input name="search" value={data.query.search} class="mt-1 block w-full rounded border p-2" /></label>
  <label class="text-sm">Status<select name="status" value={data.query.status ?? ''} class="mt-1 block w-full rounded border p-2"><option value="">Semua</option>{#each data.statuses as status}<option value={status}>{status}</option>{/each}</select></label>
  <label class="text-sm">Semester<select name="semester_id" value={data.query.semester_id ?? ''} class="mt-1 block w-full rounded border p-2"><option value="">Semua semester</option>{#if data.query.semester_id && !data.terms.data.some(row => row.id === data.query.semester_id)}<option value={data.query.semester_id}>Semester terpilih</option>{/if}{#each data.terms.data as term}<option value={term.id}>{term.nama}</option>{/each}</select></label>
  <label class="text-sm">Program studi<select name="program_studi_id" value={data.query.program_studi_id ?? ''} class="mt-1 block w-full rounded border p-2"><option value="">Semua program</option>{#if data.query.program_studi_id && !data.programs.data.some(row => row.id === data.query.program_studi_id)}<option value={data.query.program_studi_id}>Program terpilih</option>{/if}{#each data.programs.data as program}<option value={program.id}>{program.nama}</option>{/each}</select></label>
  <label class="text-sm">Cari pilihan semester<input name="term_search" value={page.url.searchParams.get('term_search') ?? ''} class="mt-1 block w-full rounded border p-2" /></label>
  <label class="text-sm">Cari pilihan program<input name="program_search" value={page.url.searchParams.get('program_search') ?? ''} class="mt-1 block w-full rounded border p-2" /></label>
  <button class="rounded-lg bg-teal-700 px-4 py-2 text-white">Terapkan filter / cari pilihan</button>
</form>
<details class="mb-4 text-sm"><summary>Paginasi pilihan filter</summary><p>Semester</p><Pagination {...data.terms.meta} href={value => href('term_page', value)} /><p>Program studi</p><Pagination {...data.programs.meta} href={value => href('program_page', value)} /></details>
<div class="overflow-x-auto rounded-lg border bg-white"><table class="w-full text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">Mahasiswa</th><th class="p-3">Program studi</th><th class="p-3">Semester</th><th class="p-3">Status</th><th class="p-3">Tindakan</th></tr></thead><tbody>{#each data.records.data as item}<tr class="border-t"><td class="p-3">{item.mahasiswa.nim}<p>{item.mahasiswa.nama}</p></td><td class="p-3">{item.programStudi.nama}</td><td class="p-3">{item.semester.nama}</td><td class="p-3">{item.status}</td><td class="p-3"><a class="text-teal-700 underline" href={'/akademik/krs/' + item.id}>Tinjau KRS</a></td></tr>{:else}<tr><td colspan="5" class="p-5 text-slate-500">Tidak ada KRS sesuai filter.</td></tr>{/each}</tbody></table></div>
<Pagination {...data.records.meta} href={value => href('page', value)} />
