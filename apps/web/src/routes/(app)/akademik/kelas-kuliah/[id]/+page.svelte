<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicOptions from '$lib/components/AcademicOptions.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  const box = 'mt-6 rounded-xl border border-slate-200 bg-white p-5';
  const button = 'rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50';
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
  function href(number: number) { const p = new URLSearchParams(page.url.searchParams); p.set('page', String(number)); return '?' + p; }
</script>
<svelte:head><title>Kelas {data.kelas.namaKelas} · Kampusia</title></svelte:head>
<a class="text-teal-800" href="/akademik/kelas-kuliah">← Kelas Kuliah</a>
<h1 class="mt-3 text-3xl font-semibold">{data.kelas.mataKuliah.kode} — {data.kelas.mataKuliah.nama} / {data.kelas.namaKelas}</h1>
<section class={box}>
  <p>{data.kelas.semester.nama} · {data.kelas.programStudi.nama}</p>
  <p class="mt-2">Kapasitas: {data.kelas.kapasitas} · Mahasiswa (KRS disetujui, pilihan aktif): {data.kelas.jumlahMahasiswa}</p>
  <p class="mt-2 font-semibold">Status: {data.kelas.status}</p>
  <p class="mt-2">Koordinator: {data.kelas.dosen.find(row => row.isKoordinator)?.dosen.nama ?? 'Belum ditunjuk (opsional)'}</p>
  <a class="mt-3 inline-block text-teal-800" href={`/akademik/kelas-kuliah?edit=${data.kelas.id}#kelas-form`}>Edit informasi kelas</a>
  <p class="mt-3 text-sm text-amber-900">{data.kelas.jumlahJadwal === 0 ? 'Jadwal belum dikonfigurasi. Kelas tidak dapat dibuka tanpa jadwal valid dan dosen aktif.' : 'Kelas memiliki jadwal. Penambahan dosen dan pembukaan kembali menunggu validasi konflik modul Jadwal.'}</p>
</section>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
{#if saving}<p role="status" class="mt-3">Menyimpan…</p>{/if}
<section class={box}>
  <h2 class="font-semibold">Dosen Pengajar</h2><p class="mt-2 text-sm text-slate-500">Koordinator opsional, maksimal satu. Lepaskan koordinator lama sebelum menunjuk dosen lain. Homebase tidak membatasi penugasan.</p>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm"><thead class="border-b text-slate-500"><tr><th class="p-3">Kode Dosen</th><th class="p-3">Nama</th><th class="p-3">Koordinator</th><th class="p-3">Tindakan</th></tr></thead>
    <tbody>{#each data.assignments.data as row}<tr class="border-b border-slate-100"><td class="p-3">{row.dosen.kodeDosen}</td><td class="p-3">{row.dosen.nama}{row.dosen.isActive ? '' : ' (Nonaktif)'}</td><td class="p-3">{row.isKoordinator ? 'Ya' : 'Tidak'}</td><td class="p-3">
      <form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="update" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="is_koordinator" value={String(!row.isKoordinator)} /><button class={button} disabled={saving}>{row.isKoordinator ? 'Lepaskan koordinator' : 'Jadikan koordinator'}</button></form>
      <details class="mt-3"><summary class="cursor-pointer text-red-700">Hapus penugasan</summary><p class="my-2">Hapus penugasan {row.dosen.nama}? Kelas dibuka harus tetap memiliki dosen aktif.</p><form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="remove" /><input type="hidden" name="assignment_id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, hapus penugasan</button></form></details>
    </td></tr>{:else}<tr><td colspan="4" class="p-8 text-center text-slate-500">Belum ada dosen pengajar.</td></tr>{/each}</tbody>
  </table></div><Pagination {...data.assignments.meta} {href} />
</section>
<AcademicOptions prefix="lecturer_" label="Dosen Aktif" meta={data.lecturers.meta} />
<section class={box}><h2 class="font-semibold">Tambah Dosen Pengajar</h2>
  {#key JSON.stringify(form)}<form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
    <input type="hidden" name="mode" value="add" />
    <AcademicFields values={form?.values?.mode === 'add' ? form.values : {}} fields={[
      { name: 'dosen_id', label: 'Dosen', options: data.lecturers.data.map(row => ({ value: row.id, label: row.kodeDosen + ' — ' + row.nama })) },
      { name: 'is_koordinator', label: 'Koordinator', value: 'false', options: [{ value: 'false', label: 'Tidak' }, { value: 'true', label: 'Ya' }] },
    ]} />
    <div><button class={button} disabled={saving || data.kelas.jumlahJadwal > 0}>Tambah dosen</button></div>
  </form>{/key}
</section>
