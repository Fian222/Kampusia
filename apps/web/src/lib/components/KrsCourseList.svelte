<script lang="ts">
  import { enhance } from '$app/forms';
  import type { KrsDetailData } from '$lib/server/krs';
  import Badge from './ui/Badge.svelte';
  import EmptyState from './ui/EmptyState.svelte';
  import Icon from './ui/Icon.svelte';

  type KrsClass = KrsDetailData['details'][number]['kelas'];
  type CourseItem = { kelas: KrsClass; detailId?: string };

  let {
    items,
    mode,
    krsId,
    actionsEnabled = false,
    emptyTitle,
    emptyDescription,
  }: {
    items: CourseItem[];
    mode: 'selected' | 'available' | 'history';
    krsId?: string;
    actionsEnabled?: boolean;
    emptyTitle: string;
    emptyDescription: string;
  } = $props();

  const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  let pendingId = $state<string | null>(null);

  const submit: NonNullable<Parameters<typeof enhance>[1]> = ({ formData }) => {
    pendingId = String(formData.get('kelas_id') ?? formData.get('detail_id') ?? '');
    return async ({ update }) => {
      try {
        await update({ reset: false, invalidateAll: true });
      } finally {
        pendingId = null;
      }
    };
  };
</script>

{#if items.length}
  <ul class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-panel">
    {#each items as item (item.kelas.id)}
      {@const kelas = item.kelas}
      <li class="border-b border-slate-100 last:border-b-0">
        <article class="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.85fr)_auto] lg:items-center">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-md bg-brand-50 px-2 py-1 text-xs font-bold tracking-wide text-brand-800">{kelas.mataKuliah.kode}</span>
              <Badge tone={kelas.status === 'DIBUKA' ? 'success' : 'neutral'}>{kelas.status}</Badge>
            </div>
            <h3 class="mt-2 text-base font-bold leading-6 text-slate-950 sm:text-lg">{kelas.mataKuliah.nama}</h3>
            <p class="mt-1 text-sm text-slate-600">
              Kelas <strong class="font-semibold text-slate-800">{kelas.namaKelas}</strong>
              <span aria-hidden="true"> · </span>
              <strong class="font-semibold text-slate-900">{kelas.mataKuliah.sks} SKS</strong>
            </p>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-slate-500">
              <span>
                {kelas.dosen.map(assignment => assignment.dosen.nama).join(', ') || 'Dosen belum ditugaskan'}
              </span>
              {#if kelas.dosen.length}
                <span class="text-slate-400">{kelas.dosen.map(assignment => assignment.dosen.kodeDosen).join(', ')}</span>
              {/if}
            </div>
          </div>

          <div class="rounded-lg bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
            {#each kelas.jadwal as slot}
              <div class="mb-2 flex items-start gap-2 last:mb-0">
                <Icon name="clock" size={15} class="mt-0.5 shrink-0 text-slate-400" />
                <p>
                  <span class="font-semibold text-slate-800">{days[slot.hari]}, {slot.jamMulai.slice(0, 5)}–{slot.jamSelesai.slice(0, 5)}</span>
                  <span class="mt-0.5 block text-xs text-slate-500">{slot.ruangan.kode} · {slot.ruangan.nama}</span>
                </p>
              </div>
            {:else}
              <p class="text-slate-500">Jadwal belum tersedia</p>
            {/each}
            {#if mode === 'available'}
              <p class="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                <strong class="font-semibold text-slate-700">{kelas.jumlahMahasiswa}/{kelas.kapasitas}</strong> kursi terisi
                <span aria-hidden="true"> · </span>Sisa {kelas.sisaKapasitas}
              </p>
            {/if}
          </div>

          {#if mode === 'available' && actionsEnabled && krsId}
            <form method="POST" use:enhance={submit} class="lg:justify-self-end">
              <input type="hidden" name="id" value={krsId} />
              <input type="hidden" name="mode" value="add" />
              <input type="hidden" name="kelas_id" value={kelas.id} />
              <button
                class="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                disabled={pendingId === kelas.id}
                aria-label={`Ambil ${kelas.mataKuliah.nama}, kelas ${kelas.namaKelas}`}
              >
                {#if pendingId === kelas.id}<span class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true"></span>{:else}<Icon name="plus" size={15} />{/if}
                Ambil
              </button>
            </form>
          {:else if mode === 'selected' && actionsEnabled && krsId && item.detailId}
            <form method="POST" use:enhance={submit} class="lg:justify-self-end">
              <input type="hidden" name="id" value={krsId} />
              <input type="hidden" name="mode" value="remove" />
              <input type="hidden" name="detail_id" value={item.detailId} />
              <button
                class="inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                disabled={pendingId === item.detailId}
                aria-label={`Keluarkan ${kelas.mataKuliah.nama}, kelas ${kelas.namaKelas} dari KRS`}
              >
                {pendingId === item.detailId ? 'Mengeluarkan…' : 'Keluarkan'}
              </button>
            </form>
          {/if}
        </article>
      </li>
    {/each}
  </ul>
{:else}
  <div class="rounded-xl border border-dashed border-slate-300 bg-white">
    <EmptyState title={emptyTitle} description={emptyDescription} icon={mode === 'available' ? 'search' : 'book'} compact />
  </div>
{/if}
