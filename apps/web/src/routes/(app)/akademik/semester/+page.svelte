<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import Pagination from '$lib/components/Pagination.svelte';
  import AcademicFields from '$lib/components/AcademicFields.svelte';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let saving = $state(false);
  const box = 'mt-6 rounded-xl border border-slate-200 bg-white p-5';
  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
  const button = 'rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50';
  function href(changes: Record<string, string | number>) { const p = new URLSearchParams(page.url.searchParams); for (const [key, value] of Object.entries(changes)) { if (value === '') p.delete(key); else p.set(key, String(value)); } return '?' + p; }
  const submit = () => { saving = true; return async ({ update }: { update: (options: { reset: boolean }) => Promise<void> }) => { try { await update({ reset: false }); } finally { saving = false; } }; };
</script>
<svelte:head><title>Semester · Kampusia</title></svelte:head>
<h1 class="text-3xl font-semibold">Semester</h1>
<p class="mt-2 text-sm text-slate-600">Semester akademik aktif dipilih secara eksplisit, bukan berdasarkan tanggal. Aktivasi menggantikan semester aktif sebelumnya. Riwayat akademik tetap tersimpan.</p>
{#if form?.message}<p class={box} role={form.saved ? 'status' : 'alert'}>{form.message}</p>{/if}
{#if saving}<p role="status" class="mt-3">Menyimpan…</p>{/if}
<form method="GET" class={box + ' grid gap-4 sm:grid-cols-4'}>
  <label class="text-sm">Cari kode atau nama<input class={input} name="search" value={data.filters.search} maxlength="150" /></label>
  <label class="text-sm">Jenis<select class={input} name="jenis" value={data.filters.jenis ?? ''}><option value="">Semua</option><option>GANJIL</option><option>GENAP</option></select></label>
  <label class="text-sm">Tahun mulai<input class={input} type="number" min="1900" max="9998" name="tahun_mulai" value={data.filters.tahun_mulai ?? ''} /></label>
  <label class="text-sm">Semester akademik aktif<select class={input} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua</option><option value="true">Sedang aktif</option><option value="false">Tidak dipilih</option></select></label>
  <div><button class={button}>Terapkan</button> <a href={page.url.pathname}>Reset</a></div>
</form>
<section class={box}>
  <div class="flex justify-between"><h2 class="font-semibold">Daftar Semester</h2><a class="text-teal-800" href={href({ edit: '' }) + '#semester-form'}>Tambah Semester</a></div>
  <div class="mt-4 overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="border-b text-slate-500"><tr>{#each ['Kode', 'Nama', 'Tahun Akademik', 'Jenis', 'Tanggal Mulai', 'Tanggal Selesai', 'Status Aktif', 'Tindakan'] as label}<th class="p-3">{label}</th>{/each}</tr></thead>
    <tbody>{#each data.records.data as row}<tr class="border-b border-slate-100">
      <td class="p-3">{row.kode}</td><td class="p-3">{row.nama}</td><td class="p-3">{row.tahunMulai}/{row.tahunMulai + 1}</td><td class="p-3">{row.jenis}</td><td class="p-3 whitespace-nowrap">{row.tanggalMulai}</td><td class="p-3 whitespace-nowrap">{row.tanggalSelesai}</td>
      <td class="p-3"><span class={row.isActive ? 'font-semibold text-teal-800' : 'text-slate-500'}>{row.isActive ? 'Semester akademik aktif' : 'Tidak dipilih'}</span></td>
      <td class="p-3"><a class="text-teal-800" href={href({ edit: row.id }) + '#semester-form'}>Edit</a>
        {#if !row.isActive}<details class="mt-2"><summary class="cursor-pointer text-teal-800">Aktifkan</summary><p class="my-2">Ganti semester aktif menjadi {row.nama}?</p><form method="POST" use:enhance={submit}><input type="hidden" name="mode" value="activate" /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="confirm" value="yes" /><button class={button} disabled={saving}>Ya, aktifkan semester</button></form></details>{/if}
      </td></tr>{:else}<tr><td colspan="8" class="p-8 text-center text-slate-500">Tidak ada semester yang cocok.</td></tr>{/each}</tbody>
  </table></div>
  <Pagination {...data.records.meta} href={number => href({ page: number })} />
</section>
<section id="semester-form" class={box}>
  <h2 class="font-semibold">{data.edit ? 'Edit' : 'Tambah'} Semester</h2>
  <p class="mt-2 text-sm text-slate-500">Kode: tahun mulai diikuti 1 untuk Ganjil atau 2 untuk Genap. Identitas dan tanggal dengan riwayat KRS disetujui atau jadwal dipertahankan.</p>
  {#key data.edit?.id + JSON.stringify(form)}
  <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
    <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
    <AcademicFields values={form?.values?.mode === 'save' ? form.values : {}} fields={[
      { name: 'kode', label: 'Kode', value: data.edit?.kode, maxlength: 5 }, { name: 'nama', label: 'Nama', value: data.edit?.nama, maxlength: 100 },
      { name: 'tahun_mulai', label: 'Tahun mulai', type: 'number', min: 1900, max: 9998, value: data.edit?.tahunMulai },
      { name: 'jenis', label: 'Jenis', value: data.edit?.jenis ?? 'GANJIL', options: ['GANJIL', 'GENAP'].map(value => ({ value, label: value })) },
      { name: 'tanggal_mulai', label: 'Tanggal Mulai', type: 'date', value: data.edit?.tanggalMulai }, { name: 'tanggal_selesai', label: 'Tanggal Selesai', type: 'date', value: data.edit?.tanggalSelesai },
    ]} />
    <div><button class={button} disabled={saving}>Simpan</button> {#if data.edit}<a href={href({ edit: '' })}>Batal edit</a>{/if}</div>
  </form>{/key}
</section>
