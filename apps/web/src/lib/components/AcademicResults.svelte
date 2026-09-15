<script lang="ts">
  import type { AcademicResultsData } from '$lib/server/academic-results';

  let { data }: { data: AcademicResultsData } = $props();
  const student = $derived(data.summary.mahasiswa);
  const card = 'rounded-xl border border-slate-200 bg-white p-5';
</script>

<svelte:head><title>KHS &amp; IPK · Kampusia</title></svelte:head>
<p class="text-sm text-slate-500">{data.managed ? 'Mahasiswa / Hasil Studi' : 'Akademik / Hasil Studi'}</p>
<div class="mt-3 flex flex-wrap items-start justify-between gap-4">
  <div><h1 class="text-3xl font-semibold tracking-tight">KHS &amp; IPK</h1><p class="mt-2 text-slate-600">Hasil resmi yang bersumber hanya dari nilai kelas yang telah difinalisasi.</p></div>
  {#if data.managed}<a class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" href="/akademik/mahasiswa">Kembali ke Mahasiswa</a>{/if}
</div>

<section class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan IPK">
  <div class={card}><p class="text-sm text-slate-500">IPK kumulatif</p><p class="mt-1 text-3xl font-semibold text-teal-800">{data.ipk.ipk ?? '—'}</p></div>
  <div class={card}><p class="text-sm text-slate-500">SKS kumulatif</p><p class="mt-1 text-3xl font-semibold">{data.ipk.totalSksKumulatif}</p></div>
  <div class={card}><p class="text-sm text-slate-500">Bobot kumulatif</p><p class="mt-1 text-3xl font-semibold">{data.ipk.totalBobotKumulatif}</p></div>
  <div class={card}><p class="text-sm text-slate-500">Semester bernilai</p><p class="mt-1 text-3xl font-semibold">{data.ipk.jumlahSemester}</p></div>
</section>

<section class={`${card} mt-6`}>
  <h2 class="text-lg font-semibold">Mahasiswa</h2>
  <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt class="text-slate-500">NIM</dt><dd class="font-medium">{student.nim}</dd></div><div><dt class="text-slate-500">Nama</dt><dd class="font-medium">{student.nama}</dd></div><div><dt class="text-slate-500">Program Studi</dt><dd class="font-medium">{student.programStudi.kode} — {student.programStudi.nama}</dd></div></dl>
</section>

<section class={`${card} mt-6`}>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div><h2 class="text-lg font-semibold">Kartu Hasil Studi</h2><p class="mt-1 text-sm text-slate-500">IPS mengukur satu semester; IPK merangkum seluruh hasil final.</p></div>
    {#if data.summary.semesters.length}
      <form method="GET" class="flex flex-wrap items-end gap-3">
        <label class="text-sm font-medium">Semester<select class="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2" name="semester_id" value={data.selectedSemesterId ?? ''}>{#each data.summary.semesters as item}<option value={item.semester.id}>{item.semester.kode} — {item.semester.nama}</option>{/each}</select></label>
        <button class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">Tampilkan</button>
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
    <div class="mt-5 overflow-x-auto"><table class="w-full whitespace-nowrap text-left text-sm"><thead class="border-b border-slate-200 text-slate-500"><tr><th class="px-3 py-3">Kode</th><th class="px-3 py-3">Mata Kuliah</th><th class="px-3 py-3">Kelas</th><th class="px-3 py-3 text-right">SKS</th><th class="px-3 py-3 text-right">Nilai Angka</th><th class="px-3 py-3 text-center">Huruf</th><th class="px-3 py-3 text-right">Indeks</th></tr></thead>
      <tbody class="divide-y divide-slate-100">{#each data.khs.courses as row}<tr><td class="px-3 py-4 font-medium">{row.mataKuliah.kode}</td><td class="px-3 py-4">{row.mataKuliah.nama}</td><td class="px-3 py-4">{row.kelas.namaKelas}</td><td class="px-3 py-4 text-right">{row.mataKuliah.sks}</td><td class="px-3 py-4 text-right">{row.nilaiAngka}</td><td class="px-3 py-4 text-center font-semibold">{row.nilaiHuruf}</td><td class="px-3 py-4 text-right">{row.nilaiIndeks}</td></tr>{:else}<tr><td class="p-8 text-center text-slate-500" colspan="7">Belum ada hasil final pada semester ini.</td></tr>{/each}</tbody>
    </table></div>
  {:else}
    <p class="mt-5 rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Belum ada hasil studi yang difinalisasi.</p>
  {/if}
</section>

<section class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
  <h2 class="font-semibold text-slate-900">Kebijakan perhitungan saat ini</h2>
  <p class="mt-2">IPS dan IPK dihitung dengan aritmetika desimal eksak, lalu hasil akhirnya ditampilkan dua desimal dengan pembulatan half-up. Nilai indeks nol tetap menghitung SKS.</p>
  <p class="mt-2">Semua percobaan mata kuliah yang telah difinalisasi dihitung, termasuk pengulangan lintas semester. Kebijakan penggantian nilai mata kuliah berulang belum ditetapkan.</p>
  {#if data.ipk.hasRepeatedCourses}<p class="mt-2 font-medium text-amber-800">Data ini memuat mata kuliah berulang; IPK memakai model hitung-semua saat ini.</p>{/if}
</section>
