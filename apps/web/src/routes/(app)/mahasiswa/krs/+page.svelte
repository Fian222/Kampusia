<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import KrsAction from '$lib/components/KrsAction.svelte';
  import KrsCourseList from '$lib/components/KrsCourseList.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ListPending from '$lib/components/ui/ListPending.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { hasActiveQuery, resetQueryHref } from '$lib/navigation/query';

  let { data, form } = $props();
  let creating = $state(false);

  const plan = $derived(data.selected?.krs);
  const adviser = $derived(plan?.dosenPa ?? data.selected?.dosenPa);
  const activeDetails = $derived(plan?.details.filter(item => item.status === 'AKTIF') ?? []);
  const cancelledDetails = $derived(plan?.details.filter(item => item.status === 'DIBATALKAN') ?? []);
  const selectedItems = $derived(activeDetails.map(item => ({ kelas: item.kelas, detailId: item.id })));
  const availableItems = $derived(data.available?.data.map(kelas => ({ kelas })) ?? []);
  const cancelledItems = $derived(cancelledDetails.map(item => ({ kelas: item.kelas, detailId: item.id })));
  const editable = $derived(Boolean(plan?.status === 'DRAFT' && data.selected?.semester.isActive && data.period?.open));
  const percentage = $derived(plan ? Math.min(100, plan.batasSks > 0 ? (plan.totalSks / plan.batasSks) * 100 : 0) : 0);
  const formMode = $derived(form?.values?.mode ?? '');
  const discoveryFeedback = $derived(formMode === 'add' ? form : null);
  const selectedFeedback = $derived(['remove', 'clear'].includes(formMode) ? form : null);
  const generalFeedback = $derived(!['add', 'remove', 'clear'].includes(formMode) ? form : null);

  function href(key: string, value: string | number) {
    const params = new URLSearchParams(page.url.searchParams);
    params.set(key, String(value));
    return `?${params}`;
  }

  function dateTime(value: Date | string) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value)).replace('.', ':');
  }

  function statusTone(status: string | undefined) {
    if (status === 'DISETUJUI') return 'success' as const;
    if (status === 'DIAJUKAN') return 'warning' as const;
    if (status === 'DITOLAK' || status === 'DIBATALKAN') return 'danger' as const;
    return 'neutral' as const;
  }

  function periodTone(code: string | undefined) {
    if (code === 'OPEN') return 'success' as const;
    if (code === 'UPCOMING') return 'info' as const;
    if (code === 'CLOSED') return 'warning' as const;
    return 'neutral' as const;
  }

  const createSubmit: NonNullable<Parameters<typeof enhance>[1]> = () => {
    creating = true;
    return async ({ update }) => {
      try {
        await update({ reset: false, invalidateAll: true });
      } finally {
        creating = false;
      }
    };
  };
</script>

<svelte:head><title>KRS · Kampusia</title></svelte:head>

<PageHeader
  eyebrow="Mahasiswa / Akademik"
  title="Kartu Rencana Studi"
  description="Susun mata kuliah semester ini, periksa jumlah SKS, lalu ajukan kepada Dosen PA."
/>

{#if data.selected}
  <section class="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel" aria-labelledby="academic-context-title">
    <div class="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <p class="eyebrow">Periode akademik</p>
        <h2 id="academic-context-title" class="mt-1.5 text-xl font-bold sm:text-2xl">KRS Semester {data.selected.semester.nama}</h2>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span class="inline-flex items-center gap-1.5"><Icon name="calendar" size={16} class="text-slate-400" />{data.selected.semester.krsMulaiAt && data.selected.semester.krsSelesaiAt ? `${dateTime(data.selected.semester.krsMulaiAt)} – ${dateTime(data.selected.semester.krsSelesaiAt)} WIB` : 'Periode KRS belum dijadwalkan'}</span>
          <Badge tone={periodTone(data.period?.code)}>{data.period?.label ?? 'Tidak tersedia'}</Badge>
        </div>
      </div>
      <div class="grid shrink-0 gap-3 sm:grid-cols-2 lg:min-w-[21rem]">
        <div class="rounded-lg bg-slate-50 px-3.5 py-3">
          <p class="text-xs font-medium text-slate-500">Dosen PA</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">{adviser?.nama ?? 'Belum ditetapkan'}</p>
          {#if adviser}<p class="mt-0.5 text-xs text-slate-500">{adviser.kodeDosen}</p>{/if}
        </div>
        <div class="rounded-lg bg-slate-50 px-3.5 py-3">
          <p class="text-xs font-medium text-slate-500">Status KRS</p>
          <div class="mt-1.5"><Badge tone={statusTone(plan?.status)}>{plan?.status ?? 'BELUM DIBUAT'}</Badge></div>
        </div>
      </div>
    </div>
  </section>

  {#if generalFeedback?.message}
    <p class={`mt-4 rounded-xl border p-3.5 text-sm ${generalFeedback.saved ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-red-200 bg-red-50 text-red-800'}`} role={generalFeedback.saved ? 'status' : 'alert'}>{generalFeedback.message}</p>
  {/if}

  {#if data.period && !data.period.open}
    <div class="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Icon name="info" size={17} class="mt-0.5 shrink-0" />
      <p><strong>Periode KRS {data.period.label.toLowerCase()}.</strong> Informasi tetap dapat dilihat, tetapi perubahan tidak tersedia.</p>
    </div>
  {/if}

  {#if plan}
    {#if plan.status === 'DIAJUKAN'}
      <section class="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="submitted-title">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><Icon name="clock" size={18} /></span>
        <div><h2 id="submitted-title" class="text-base font-bold text-amber-950">Menunggu persetujuan Dosen PA</h2><p class="mt-1 text-sm leading-6 text-amber-900">Pengajuan sedang menunggu peninjauan {plan.dosenPa?.nama ?? 'Dosen PA'}. Pilihan mata kuliah tidak dapat diubah.</p></div>
      </section>
    {:else if plan.status === 'DITOLAK'}
      <section class="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" aria-labelledby="rejected-title">
        <div class="flex items-start gap-3"><span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700"><Icon name="alert" size={18} /></span><div><h2 id="rejected-title" class="text-base font-bold text-red-950">KRS perlu diperbaiki</h2><p class="mt-1 text-sm font-medium text-red-900">Alasan penolakan</p><p class="mt-1 text-sm leading-6 text-red-800">{plan.alasanPenolakan ?? 'Tidak ada alasan yang tersimpan.'}</p></div></div>
        {#if data.period?.open}<div class="mt-4 pl-0 sm:pl-12"><KrsAction id={plan.id} mode="reopen" label="Perbaiki KRS" explanation="Kembalikan KRS ke DRAFT agar pilihan mata kuliah dapat diperbaiki dan diajukan ulang." /></div>{/if}
      </section>
    {:else if plan.status === 'DISETUJUI'}
      <section class="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-labelledby="approved-title">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Icon name="check" size={18} /></span>
        <div><h2 id="approved-title" class="text-base font-bold text-emerald-950">KRS telah disetujui</h2><p class="mt-1 text-sm leading-6 text-emerald-800">Rencana studi sudah disetujui dan bersifat baca-saja.{plan.disetujuiAt ? ` Disetujui ${dateTime(plan.disetujuiAt)} WIB.` : ''}</p></div>
      </section>
    {:else if plan.status === 'DIBATALKAN'}
      <section class="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-100 p-4" aria-labelledby="cancelled-title">
        <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600"><Icon name="info" size={18} /></span>
        <div><h2 id="cancelled-title" class="text-base font-bold text-slate-900">KRS dibatalkan secara administratif</h2><p class="mt-1 text-sm leading-6 text-slate-600">Riwayat tetap disimpan dan KRS semester ini tidak dapat diedit kembali.</p>{#if plan.alasanPembatalan}<p class="mt-2 text-sm text-slate-700"><strong>Alasan:</strong> {plan.alasanPembatalan}</p>{/if}</div>
      </section>
    {/if}

    <section class="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="credit-summary-title">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="eyebrow">Ringkasan SKS</p>
          <h2 id="credit-summary-title" class="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">{plan.totalSks} <span class="text-lg font-semibold text-slate-400">/ {plan.batasSks} SKS</span></h2>
          <p class="mt-1 text-sm text-slate-500">Batas SKS tersimpan saat DRAFT KRS dibuat.</p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center sm:min-w-[20rem]">
          <div><p class="text-xs text-slate-500">SKS dipilih</p><p class="mt-1 text-lg font-bold text-brand-800">{plan.totalSks}</p></div>
          <div class="border-x border-slate-200"><p class="text-xs text-slate-500">Batas SKS maksimum</p><p class="mt-1 text-lg font-bold text-slate-900">{plan.batasSks}</p></div>
          <div><p class="text-xs text-slate-500">Sisa SKS</p><p class="mt-1 text-lg font-bold text-slate-900">{plan.remainingSks}</p></div>
        </div>
      </div>
      <div class="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Pemakaian batas SKS" aria-valuemin="0" aria-valuemax={plan.batasSks} aria-valuenow={plan.totalSks} aria-valuetext={`${plan.totalSks} dari ${plan.batasSks} SKS dipilih`}>
        <div class="h-full rounded-full bg-brand-600 transition-[width]" style={`width: ${percentage}%`}></div>
      </div>
    </section>

    <section class="mt-8" aria-labelledby="selected-courses-title">
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="eyebrow">Pilihan Anda</p><h2 id="selected-courses-title" class="mt-1 text-xl font-bold">Mata Kuliah Terpilih</h2><p class="mt-1 text-sm text-slate-500">{activeDetails.length} kelas · {plan.totalSks} SKS</p></div>
        {#if editable && activeDetails.length}
          <KrsAction id={plan.id} mode="clear" label="Kosongkan KRS" explanation="Semua mata kuliah yang dipilih akan dikeluarkan dari KRS. Anda masih dapat memilih kembali selama periode KRS masih dibuka." />
        {/if}
      </div>
      {#if selectedFeedback?.message}<p class={`mb-3 rounded-lg border p-3 text-sm ${selectedFeedback.saved ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-red-200 bg-red-50 text-red-800'}`} role={selectedFeedback.saved ? 'status' : 'alert'}>{selectedFeedback.message}</p>{/if}
      <KrsCourseList
        items={selectedItems}
        mode="selected"
        krsId={plan.id}
        actionsEnabled={editable}
        emptyTitle="Belum ada mata kuliah dipilih."
        emptyDescription={editable ? 'Cari mata kuliah di bawah untuk mulai menyusun KRS.' : 'Tidak ada pilihan aktif pada KRS ini.'}
      />
    </section>

    {#if cancelledItems.length}
      <details class="group mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <summary class="flex list-none items-center justify-between text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">Riwayat pilihan yang dikeluarkan <Icon name="chevron-down" size={17} class="transition-transform group-open:rotate-180" /></summary>
        <div class="mt-4"><KrsCourseList items={cancelledItems} mode="history" emptyTitle="Tidak ada riwayat pilihan" emptyDescription="" /></div>
      </details>
    {/if}
  {:else if data.selected.semester.isActive && data.period?.open}
    <section class="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-5 sm:flex-row sm:items-center sm:p-6">
      <div><p class="font-bold text-slate-950">Mulai susun KRS semester ini</p><p class="mt-1 text-sm leading-6 text-slate-600">Buat DRAFT untuk melihat batas SKS dan mulai memilih mata kuliah.</p></div>
      <form method="POST" use:enhance={createSubmit}>
        <input type="hidden" name="mode" value="create" /><input type="hidden" name="id" value={data.selected.semester.id} />
        <button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70" disabled={creating}>{creating ? 'Membuat DRAFT…' : 'Buat DRAFT KRS'}</button>
      </form>
    </section>
  {:else}
    <p class="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Tidak ada KRS pada semester ini.</p>
  {/if}

  {#if data.availabilityMessage}
    <p role="alert" class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{data.availabilityMessage}</p>
  {/if}

  {#if data.available && plan}
    <section class="mt-10" aria-labelledby="course-discovery-title">
      <div><p class="eyebrow">Katalog semester</p><h2 id="course-discovery-title" class="mt-1 text-xl font-bold">Cari Mata Kuliah</h2><p class="mt-1 text-sm text-slate-500">Temukan kelas berdasarkan kode, nama mata kuliah, atau nama kelas.</p></div>
      <div class="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <ListPending />
        <form method="GET" class="flex flex-col gap-3 sm:flex-row sm:items-center" use:seamlessFilter>
          <input type="hidden" name="semester_id" value={data.selected.semester.id} />
          <label class="relative min-w-0 flex-1">
            <span class="sr-only">Cari mata kuliah atau kelas</span>
            <Icon name="search" size={17} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Cari mata kuliah atau kelas" type="search" name="search" value={data.query.search} placeholder="Cari kode, mata kuliah, atau kelas" class="control-base pl-9" />
          </label>
          <noscript><button class="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Cari mata kuliah</button></noscript>
          {#if hasActiveQuery(page.url, ['search'])}<a class="self-center text-sm font-semibold text-slate-600 hover:text-slate-900" href={resetQueryHref(page.url, ['search'])} data-sveltekit-noscroll>Reset pencarian</a>{/if}
        </form>
      </div>
      {#if discoveryFeedback?.message}<p class={`mt-3 rounded-lg border p-3 text-sm ${discoveryFeedback.saved ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-red-200 bg-red-50 text-red-800'}`} role={discoveryFeedback.saved ? 'status' : 'alert'}>{discoveryFeedback.message}</p>{/if}
      <div class="mt-4">
        <KrsCourseList
          items={availableItems}
          mode="available"
          krsId={plan.id}
          actionsEnabled={editable}
          emptyTitle="Tidak ada kelas yang cocok"
          emptyDescription="Coba ubah kata pencarian atau periksa kembali nanti."
        />
      </div>
      <Pagination {...data.available.meta} href={value => href('page', value)} />
    </section>
  {/if}

  {#if plan?.status === 'DRAFT' && editable}
    <div class="sticky bottom-3 z-20 mt-8 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_35px_rgba(15,23,42,0.16)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
      <p class="mb-3 text-sm text-slate-600 sm:mb-0"><strong class="text-slate-950">{plan.totalSks} SKS dipilih</strong><span class="hidden sm:inline"> · </span><span class="block sm:inline">Sisa {plan.remainingSks} dari batas {plan.batasSks} SKS</span></p>
      <div class="[&>button]:w-full sm:[&>button]:w-auto"><KrsAction id={plan.id} mode="submit" label="Ajukan KRS ke Dosen PA" explanation="Pilihan mata kuliah akan dikunci dan dikirim kepada Dosen PA untuk ditinjau. Kapasitas dan seluruh aturan akademik akan divalidasi kembali oleh sistem." disabled={activeDetails.length === 0} /></div>
    </div>
  {/if}
{:else}
  <section class="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-panel">
    <span class="mx-auto inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon name="calendar" size={20} /></span>
    <h2 class="mt-3 text-base font-bold">Semester aktif belum ditetapkan</h2>
    <p class="mt-1 text-sm text-slate-500">KRS dapat disusun setelah pengelola menetapkan semester aktif.</p>
  </section>
{/if}

<details class="group mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
  <summary class="flex list-none items-center justify-between font-bold text-slate-900 [&::-webkit-details-marker]:hidden">Riwayat KRS <Icon name="chevron-down" size={18} class="transition-transform group-open:rotate-180" /></summary>
  <ul class="mt-4 divide-y divide-slate-100">
    {#each data.history.data as item}
      <li><a class="flex items-center justify-between gap-3 py-3 text-sm font-medium text-slate-700 hover:text-brand-700" href={`?semester_id=${item.semesterId}`}><span>{item.semester.nama}</span><Badge tone={statusTone(item.status)}>{item.status}</Badge></a></li>
    {:else}
      <li class="py-4 text-sm text-slate-500">Belum ada riwayat KRS.</li>
    {/each}
  </ul>
  <Pagination {...data.history.meta} href={value => href('history_page', value)} />
</details>
