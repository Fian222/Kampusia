<script lang="ts">
  import type { AcademicResultsData } from '$lib/server/academic-results';
  import PageHeader from './ui/PageHeader.svelte';
  import StatCard from './ui/StatCard.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Icon from './ui/Icon.svelte';

  let { data }: { data: AcademicResultsData } = $props();
  const student = $derived(data.summary.mahasiswa);
  const card = 'surface-panel p-5 sm:p-6';
</script>

<svelte:head><title>KHS &amp; IPK · Kampusia</title></svelte:head>
<PageHeader eyebrow={data.managed ? 'Mahasiswa / Hasil Studi' : 'Akademik / Hasil Studi'} title="KHS & IPK" description="Hasil resmi yang bersumber hanya dari nilai kelas yang telah difinalisasi.">
  {#snippet actions()}{#if data.managed}<a class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" href="/akademik/mahasiswa"><Icon name="arrow-right" size={16} class="rotate-180" /> Kembali</a>{/if}{/snippet}
</PageHeader>

<section class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan IPK">
  <StatCard label="IPK kumulatif" value={data.ipk.ipk ?? '—'} icon="graduation" accent />
  <StatCard label="SKS kumulatif" value={data.ipk.totalSksKumulatif} icon="book" />
  <StatCard label="Bobot kumulatif" value={data.ipk.totalBobotKumulatif} icon="chart" />
  <StatCard label="Semester bernilai" value={data.ipk.jumlahSemester} icon="calendar" />
</section>

<section class={`${card} mt-6`}>
  <h2 class="text-lg font-bold">Informasi mahasiswa</h2>
  <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">NIM</dt><dd class="mt-1 font-semibold text-slate-800">{student.nim}</dd></div><div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Nama</dt><dd class="mt-1 font-semibold text-slate-800">{student.nama}</dd></div><div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Program Studi</dt><dd class="mt-1 font-semibold text-slate-800">{student.programStudi.kode} — {student.programStudi.nama}</dd></div></dl>
</section>

<section class={`${card} mt-6`}>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div><h2 class="text-lg font-semibold">Kartu Hasil Studi</h2><p class="mt-1 text-sm text-slate-500">IPS mengukur satu semester; IPK merangkum seluruh hasil final.</p></div>
    {#if data.summary.semesters.length}
      <form method="GET" class="flex flex-wrap items-end gap-3">
        <label class="text-sm font-medium">Semester<select class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2" name="semester_id" value={data.selectedSemesterId ?? ''}>{#each data.summary.semesters as item}<option value={item.semester.id}>{item.semester.kode} — {item.semester.nama}</option>{/each}</select></label>
        <button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">Tampilkan</button>
      </form>
    {/if}
  </div>

  {#if data.khs}
    <div class="mt-5 grid gap-3 sm:grid-cols-3">
      <div class="rounded-lg bg-slate-50 p-4"><p class="text-sm text-slate-500">IPS</p><p class="text-2xl font-semibold">{data.khs.summary.ips ?? '—'}</p></div>
      <div class="rounded-lg bg-slate-50 p-4"><p class="text-sm text-slate-500">Total SKS semester</p><p class="text-2xl font-semibold">{data.khs.summary.totalSks}</p></div>
      <div class="rounded-lg bg-slate-50 p-4"><p class="text-sm text-slate-500">Bobot semester</p><p class="text-2xl font-semibold">{data.khs.summary.totalBobot}</p></div>
    </div>
    {#if data.khs.summary.provisional}<p role="status" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ada {data.khs.summary.unfinishedCourseCount} mata kuliah efektif yang belum memiliki hasil final. Mata kuliah tersebut tidak masuk perhitungan; ringkasan semester ini masih provisional.</p>{/if}
    <div class="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table class="w-full whitespace-nowrap text-left text-sm"><thead><tr><th class="px-4 py-3">Kode</th><th class="px-4 py-3">Mata Kuliah</th><th class="px-4 py-3">Kelas</th><th class="px-4 py-3 text-right">SKS</th><th class="px-4 py-3 text-right">Nilai Angka</th><th class="px-4 py-3 text-center">Huruf</th><th class="px-4 py-3 text-right">Indeks</th></tr></thead>
      <tbody class="divide-y divide-slate-100">{#each data.khs.courses as row}<tr><td class="px-3 py-4 font-medium">{row.mataKuliah.kode}</td><td class="px-3 py-4">{row.mataKuliah.nama}</td><td class="px-3 py-4">{row.kelas.namaKelas}</td><td class="px-3 py-4 text-right">{row.mataKuliah.sks}</td><td class="px-3 py-4 text-right">{row.nilaiAngka}</td><td class="px-3 py-4 text-center font-semibold">{row.nilaiHuruf}</td><td class="px-3 py-4 text-right">{row.nilaiIndeks}</td></tr>{:else}<tr><td class="p-8 text-center text-slate-500" colspan="7">Belum ada hasil final pada semester ini.</td></tr>{/each}</tbody>
    </table></div>
  {:else}
    <div class="mt-5 rounded-xl border border-slate-200"><EmptyState title="Belum ada hasil studi" description="Hasil akan tersedia setelah nilai kelas difinalisasi." icon="graduation" compact /></div>
  {/if}
</section>

<section class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
  <h2 class="font-semibold text-slate-900">Kebijakan perhitungan saat ini</h2>
  <p class="mt-2">IPS dan IPK dihitung dengan aritmetika desimal eksak, lalu hasil akhirnya ditampilkan dua desimal dengan pembulatan half-up. Nilai indeks nol tetap menghitung SKS.</p>
  <p class="mt-2">Semua percobaan mata kuliah yang telah difinalisasi dihitung, termasuk pengulangan lintas semester. Kebijakan penggantian nilai mata kuliah berulang belum ditetapkan.</p>
  {#if data.ipk.hasRepeatedCourses}<p class="mt-2 font-medium text-amber-800">Data ini memuat mata kuliah berulang; IPK memakai model hitung-semua saat ini.</p>{/if}
</section>
