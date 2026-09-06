<script lang="ts">
  import { enhance } from '$app/forms';
  import { page, navigating } from '$app/state';
  import type { ProfileData } from '$lib/server/academic-profiles';
  import Pagination from './Pagination.svelte';
  import StatusBadge from './StatusBadge.svelte';

  let { data, form }: { data: ProfileData; form: { message: string; saved?: true; values?: Record<string, string> } | null } = $props();
  let saving = $state(false);
  let confirmation = $state<{ id: string; nama: string; isActive: boolean } | null>(null);
  let dialog: HTMLDialogElement;
  $effect(() => {
    if (confirmation && !dialog.open) dialog.showModal();
    else if (!confirmation && dialog.open) dialog.close();
  });
  const title = $derived(data.kind === 'mahasiswa' ? 'Mahasiswa' : 'Dosen');
  const student = $derived(data.kind === 'mahasiswa' ? data.edit : null);
  const lecturer = $derived(data.kind === 'dosen' ? data.edit : null);
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  const buttonClass = 'rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
  const panelClass = 'mt-6 rounded-xl border border-slate-200 bg-white p-5';
  function href(changes: Record<string, string | number | null>) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') params.delete(key); else params.set(key, String(value));
    }
    return '?' + params.toString();
  }
  function value(key: string, fallback = '') { return form?.values?.[key] ?? fallback; }
  const programs = $derived([...data.programs.data, ...[data.edit?.programStudi, data.selectedProgram].filter(item => item && !data.programs.data.some(row => row.id === item.id))]);
</script>

<svelte:head><title>{title} · Kampusia</title></svelte:head>
<p class="text-sm text-slate-500">Master Data / {title}</p>
<h1 class="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
<p class="mt-2 text-sm text-slate-600">Kelola profil akademik dan pertahankan riwayatnya. Akun login bersifat opsional.</p>
{#if navigating || saving}<p role="status" class="mt-4 text-sm text-teal-800">{saving ? 'Menyimpan perubahan…' : 'Memuat data…'}</p>{/if}
{#if form?.message}<p role={form.saved ? 'status' : 'alert'} class={panelClass}>{form.message}</p>{/if}

<section class={panelClass} aria-label="Filter data">
  <form method="GET" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each ['program_search', 'program_page', 'curriculum_search', 'curriculum_page', 'choice_program'] as key}
      {#if page.url.searchParams.has(key)}<input type="hidden" name={key} value={page.url.searchParams.get(key)} />{/if}
    {/each}
    <label class="text-sm font-medium">{data.kind === 'mahasiswa' ? 'Cari NIM atau nama' : 'Cari kode dosen, NIDN, atau nama'}<input class={inputClass} name="search" value={data.filters.search} maxlength="150" /></label>
    <label class="text-sm font-medium">Program Studi<select class={inputClass} name="program_studi_id" value={data.filters.program_studi_id ?? ''}><option value="">Semua program studi</option>{#each programs as item}{#if item}<option value={item.id}>{item.kode} — {item.nama}</option>{/if}{/each}</select></label>
    {#if data.kind === 'mahasiswa'}
      <label class="text-sm font-medium">Kurikulum<select class={inputClass} name="kurikulum_id" value={data.filters.kurikulum_id ?? ''}><option value="">Semua kurikulum</option>
        {#if data.filters.kurikulum_id && !data.curricula.data.some(item => item.id === data.filters.kurikulum_id)}<option value={data.filters.kurikulum_id}>Kurikulum terpilih ({data.filters.kurikulum_id})</option>{/if}
        {#each data.curricula.data as item}<option value={item.id}>{item.kode} — {item.nama}</option>{/each}
      </select></label>
      <label class="text-sm font-medium">Angkatan<input class={inputClass} name="angkatan" type="number" min="1900" max="9999" step="1" value={data.filters.angkatan ?? ''} /></label>
      <label class="text-sm font-medium">Status<select class={inputClass} name="status" value={data.filters.status ?? ''}><option value="">Semua status</option>{#each data.statuses as item}<option value={item}>{item}</option>{/each}</select></label>
    {:else}
      <label class="text-sm font-medium">Status<select class={inputClass} name="is_active" value={data.filters.is_active ?? ''}><option value="">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
    {/if}
    <div class="flex items-end gap-4"><button class={buttonClass}>Terapkan filter</button><a class="py-2 text-sm text-slate-600" href={page.url.pathname}>Reset</a></div>
  </form>
</section>

<section class={panelClass} aria-label="Daftar profil">
  <div class="overflow-x-auto"><table class="w-full whitespace-nowrap text-left text-sm">
    <thead class="border-b border-slate-200 text-slate-500"><tr>
      {#each data.kind === 'mahasiswa' ? ['NIM', 'Nama', 'Program Studi', 'Kurikulum', 'Angkatan', 'Status', 'Tindakan'] : ['Kode Dosen', 'NIDN', 'Nama', 'Homebase Program Studi', 'Status', 'Tindakan'] as column}<th class="px-3 py-3 font-medium">{column}</th>{/each}
    </tr></thead>
    <tbody class="divide-y divide-slate-100">
      {#if data.kind === 'mahasiswa'}
        {#each data.records as row}<tr>
          <td class="px-3 py-4 font-medium">{row.nim}</td><td class="px-3 py-4">{row.nama}</td><td class="px-3 py-4">{row.programStudi.nama}<span class="block text-xs text-slate-500">{row.fakultas.nama}</span></td><td class="px-3 py-4">{row.kurikulum.nama}</td><td class="px-3 py-4">{row.angkatan}</td><td class="px-3 py-4"><span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{row.status}</span></td><td class="px-3 py-4"><a class="text-teal-700" href={href({ edit: row.id }) + '#profile-form'}>Edit</a></td>
        </tr>{/each}
      {:else}
        {#each data.records as row}<tr>
          <td class="px-3 py-4 font-medium">{row.kodeDosen}</td><td class="px-3 py-4">{row.nidn ?? '—'}</td><td class="px-3 py-4">{row.nama}</td><td class="px-3 py-4">{row.programStudi?.nama ?? 'Tanpa homebase'}</td><td class="px-3 py-4"><StatusBadge active={row.isActive} /></td>
          <td class="px-3 py-4"><a class="mr-4 text-teal-700" href={href({ edit: row.id }) + '#profile-form'}>Edit</a><button class="text-slate-600" onclick={() => confirmation = row}>{row.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
        </tr>{/each}
      {/if}
    </tbody>
  </table></div>
  {#if !data.records.length}<p class="py-6 text-center text-sm text-slate-500">Data tidak ditemukan. Ubah filter atau tambahkan profil.</p>{/if}
  <Pagination {...data.meta} href={number => href({ page: number })} />
</section>

<section class={panelClass} aria-label="Pilihan program studi">
  <h2 class="font-semibold">Pilihan Program Studi</h2><p class="mt-1 text-sm text-slate-500">Cari pilihan untuk filter dan formulir. Pilihan nonaktif tetap tersedia untuk riwayat.</p>
  <form method="GET" class="mt-3 flex items-end gap-3">
    {#each [...page.url.searchParams].filter(([key]) => !['program_search', 'program_page'].includes(key)) as [key, entry]}<input type="hidden" name={key} value={entry} />{/each}
    <label class="grow text-sm">Kode atau nama program studi<input class={inputClass} name="program_search" value={data.programQuery.search} maxlength="150" /></label><button class={buttonClass}>Cari program studi</button>
  </form>
  <Pagination {...data.programs.meta} href={number => href({ program_page: number })} />
</section>
{#if data.kind === 'mahasiswa'}
  <section class={panelClass} aria-label="Pilihan kurikulum">
    <h2 class="font-semibold">Pilihan Kurikulum</h2><p class="mt-1 text-sm text-slate-500">Cari kurikulum pada program studi yang sesuai sebelum mengisi formulir.</p>
    <form method="GET" class="mt-3 grid items-end gap-3 sm:grid-cols-3">
      {#each [...page.url.searchParams].filter(([key]) => !['curriculum_search', 'curriculum_page', 'choice_program'].includes(key)) as [key, entry]}<input type="hidden" name={key} value={entry} />{/each}
      <label class="text-sm">Program Studi<select class={inputClass} name="choice_program" value={data.curriculumQuery.program_studi_id ?? ''}><option value="">Semua program studi</option>{#each programs as item}{#if item}<option value={item.id}>{item.kode} — {item.nama}</option>{/if}{/each}</select></label>
      <label class="text-sm">Kode atau nama kurikulum<input class={inputClass} name="curriculum_search" value={data.curriculumQuery.search} maxlength="150" /></label><button class={buttonClass}>Cari kurikulum</button>
    </form>
    {#if !data.curricula.data.length}<p class="mt-3 text-sm text-slate-500">Kurikulum tidak ditemukan. Ubah pencarian.</p>{/if}
    <Pagination {...data.curricula.meta} href={number => href({ curriculum_page: number })} />
  </section>
{/if}

<section id="profile-form" class={panelClass}>
  <h2 class="font-semibold">{data.edit ? 'Edit' : 'Tambah'} {title}</h2>
  {#key data.edit?.id + JSON.stringify(form)}
    <form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={() => {
      saving = true;
      return async ({ update }) => { try { await update({ reset: false }); } finally { saving = false; } };
    }}>
      <input type="hidden" name="mode" value="save" /><input type="hidden" name="id" value={data.edit?.id ?? ''} />
      {#if data.kind === 'mahasiswa'}
        <label class="text-sm font-medium">NIM<input class={inputClass} name="nim" value={value('nim', student?.nim)} required maxlength="30" pattern=".*\S.*" /><span class="text-xs font-normal text-slate-500">Unik; disimpan dalam huruf kapital.</span></label>
      {:else}
        <label class="text-sm font-medium">Kode Dosen<input class={inputClass} name="kode_dosen" value={value('kode_dosen', lecturer?.kodeDosen)} required maxlength="30" pattern=".*\S.*" /></label>
        <label class="text-sm font-medium">NIDN (opsional)<input class={inputClass} name="nidn" value={value('nidn', lecturer?.nidn ?? '')} maxlength="30" /></label>
      {/if}
      <label class="text-sm font-medium">Nama<input class={inputClass} name="nama" value={value('nama', data.edit?.nama)} required maxlength="150" pattern=".*\S.*" /></label>
      <label class="text-sm font-medium">{data.kind === 'mahasiswa' ? 'Program Studi' : 'Homebase Program Studi (opsional)'}<select class={inputClass} name="program_studi_id" required={data.kind === 'mahasiswa'} value={value('program_studi_id', data.edit?.programStudiId ?? '')}>
        <option value="">{data.kind === 'mahasiswa' ? 'Pilih program studi' : 'Tanpa homebase'}</option>
        {#each programs as item}{#if item}<option value={item.id} disabled={!item.isActive && item.id !== data.edit?.programStudiId}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/if}{/each}
      </select></label>
      {#if data.kind === 'mahasiswa'}
        <label class="text-sm font-medium">Kurikulum<select class={inputClass} name="kurikulum_id" required value={value('kurikulum_id', student?.kurikulumId)}><option value="" disabled>Pilih kurikulum</option>
          {#if student && !data.curricula.data.some(item => item.id === student.kurikulumId)}<option value={student.kurikulumId}>{student.kurikulum.kode} — {student.kurikulum.nama}</option>{/if}
          {#each data.curricula.data as item}<option value={item.id} disabled={!item.isActive && item.id !== student?.kurikulumId}>{item.kode} — {item.nama}{item.isActive ? '' : ' (Nonaktif)'}</option>{/each}
        </select></label>
        <label class="text-sm font-medium">Angkatan<input class={inputClass} name="angkatan" type="number" min="1900" max="9999" step="1" required value={value('angkatan', student ? String(student.angkatan) : '')} /></label>
        <label class="text-sm font-medium">Status<select class={inputClass} name="status" required value={value('status', student?.status ?? 'AKTIF')}>{#each data.statuses as item}<option value={item}>{item}</option>{/each}</select></label>
        <p class="text-sm text-slate-500 sm:col-span-2">Status akademik tidak menonaktifkan login. Perubahan program studi atau kurikulum memerlukan peninjauan akademik dan ditolak bila ada riwayat KRS disetujui.</p>
      {:else}<p class="text-sm text-slate-500">Homebase tidak membatasi program studi tempat dosen mengajar. Ubah status melalui tindakan pada tabel.</p>{/if}
      <label class="text-sm font-medium sm:col-span-2">ID akun pengguna (opsional)<input class={inputClass} name="user_id" value={value('user_id', data.edit?.userId ?? '')} placeholder="UUID akun pengguna" /><span class="text-xs font-normal text-slate-500">Gunakan akun berperan {data.kind === 'mahasiswa' ? 'MAHASISWA' : 'DOSEN'}. Kosongkan untuk profil tanpa akun login.</span></label>
      <div class="flex gap-4 sm:col-span-2"><button class={buttonClass} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>{#if data.edit}<a class="py-2 text-sm text-slate-600" href={href({ edit: null })}>Batal edit</a>{/if}</div>
    </form>
  {/key}
</section>

<dialog bind:this={dialog} onclose={() => confirmation = null} class="m-auto w-full max-w-md rounded-xl p-6 backdrop:bg-slate-900/40">
  {#if confirmation}
    <h2 class="text-lg font-semibold">{confirmation.isActive ? 'Nonaktifkan' : 'Aktifkan'} dosen?</h2><p class="mt-3 text-sm text-slate-600">{confirmation.nama}. Riwayat penugasan tetap tersimpan.</p>
    <form method="POST" class="mt-5 flex gap-3" use:enhance={() => {
      saving = true;
      return async ({ update }) => { try { await update(); } finally { saving = false; confirmation = null; } };
    }}>
      <input type="hidden" name="mode" value="status" /><input type="hidden" name="id" value={confirmation.id} /><input type="hidden" name="is_active" value={String(!confirmation.isActive)} />
      <button class={buttonClass} disabled={saving}>Ya, simpan</button><button type="button" class="px-4 py-2 text-sm" onclick={() => confirmation = null}>Batal</button>
    </form>
  {/if}
</dialog>
