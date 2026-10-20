<script lang="ts">
  import { seamlessFilter } from '$lib/actions/seamless-filter';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import SelectField from '$lib/components/ui/SelectField.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  let { data } = $props();

  const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const plan = $derived(data.selected?.krs ?? null);
  const classes = $derived(plan?.details.filter(item => item.status === 'AKTIF').map(item => item.kelas) ?? []);
  const scheduled = $derived(classes.filter(kelas => kelas.jadwal[0]).sort((a, b) => a.jadwal[0]!.hari - b.jadwal[0]!.hari || a.jadwal[0]!.jamMulai.localeCompare(b.jadwal[0]!.jamMulai)));
  const byDay = $derived(days.slice(1).map((label, index) => ({ label, classes: scheduled.filter(kelas => kelas.jadwal[0]!.hari === index + 1) })).filter(day => day.classes.length));
  const unscheduled = $derived(classes.filter(kelas => !kelas.jadwal[0]));
  const totalSks = $derived(classes.reduce((sum, kelas) => sum + kelas.mataKuliah.sks, 0));
  const time = (value: string) => value.slice(0, 5).replace(':', '.');
</script>

<svelte:head><title>Jadwal Kuliah · Kampusia</title></svelte:head>

<PageHeader eyebrow="Akademik" title="Jadwal Kuliah" description="Jadwal mingguan dari kelas yang Anda ambil pada KRS. Waktu dalam WIB." />

{#if data.history.data.length > 1}
  <form method="GET" class="mt-6 max-w-sm" use:seamlessFilter>
    <SelectField name="semester_id" label="Semester" value={data.semesterId ?? ''} options={data.history.data.map(item => ({ value: item.semesterId, label: item.semester.nama }))} />
    <noscript><button class="mt-3 min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white">Tampilkan</button></noscript>
  </form>
{/if}

{#if !data.selected}
  <section class="surface-panel mt-6"><EmptyState title="Semester aktif belum ditetapkan" description="Jadwal tersedia setelah bagian Akademik menetapkan semester aktif." icon="calendar" compact /></section>
{:else if !plan}
  <section class="surface-panel mt-6"><EmptyState title="Belum ada KRS pada semester ini" description="Susun KRS terlebih dahulu untuk melihat jadwal kuliah." icon="calendar" compact /><div class="pb-6 text-center"><a class="action-primary" href="/mahasiswa/krs">Buka KRS</a></div></section>
{:else}
  <div class="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
    <span class="font-semibold text-slate-900">{data.selected.semester.nama}</span>
    <Badge tone={plan.status === 'DISETUJUI' ? 'success' : plan.status === 'DIAJUKAN' ? 'warning' : plan.status === 'DITOLAK' || plan.status === 'DIBATALKAN' ? 'danger' : 'neutral'}>KRS {plan.status}</Badge>
    <span>{classes.length} kelas · {totalSks} SKS</span>
  </div>
  {#if plan.status !== 'DISETUJUI' && classes.length}
    <p class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Icon name="info" size={16} class="mt-0.5 shrink-0" /> KRS belum disetujui. Jadwal ini masih berupa rencana dan dapat berubah.</p>
  {/if}

  {#if byDay.length}
    <div class="mt-5 grid gap-4 lg:grid-cols-2">
      {#each byDay as day}
        <section class="surface-panel p-5" aria-label={`Jadwal hari ${day.label}`}>
          <h2 class="font-bold text-slate-950">{day.label}</h2>
          <ul class="mt-3 divide-y divide-slate-100">
            {#each day.classes as kelas}
              {@const slot = kelas.jadwal[0]!}
              <li class="flex gap-4 py-3 first:pt-0 last:pb-0">
                <p class="w-24 shrink-0 text-sm font-semibold text-brand-800">{time(slot.jamMulai)}–{time(slot.jamSelesai)}</p>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900">{kelas.mataKuliah.nama} <span class="font-normal text-slate-500">· Kelas {kelas.namaKelas}</span></p>
                  <p class="mt-0.5 text-xs text-slate-500">{kelas.mataKuliah.kode} · {kelas.mataKuliah.sks} SKS · {slot.ruangan.kode} {slot.ruangan.nama}</p>
                  <p class="mt-0.5 text-xs text-slate-500">{kelas.dosen.map(item => item.dosen.nama).join(', ') || 'Dosen belum ditugaskan'}</p>
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {:else if !classes.length}
    <section class="surface-panel mt-5"><EmptyState title="Belum ada kelas pada KRS ini" description="Kelas yang dipilih pada KRS akan muncul di sini." icon="book" compact /></section>
  {/if}

  {#if unscheduled.length}
    <section class="surface-panel mt-4 p-5" aria-labelledby="unscheduled-title">
      <h2 id="unscheduled-title" class="font-bold text-slate-950">Belum dijadwalkan</h2>
      <ul class="mt-3 space-y-1 text-sm text-slate-600">{#each unscheduled as kelas}<li>{kelas.mataKuliah.kode} · {kelas.mataKuliah.nama} · Kelas {kelas.namaKelas}</li>{/each}</ul>
    </section>
  {/if}
{/if}
