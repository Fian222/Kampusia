<script lang="ts">
  import type { KrsDetailData } from '$lib/server/krs';
  import EmptyState from './ui/EmptyState.svelte';
  import Badge from './ui/Badge.svelte';
  let { classes }: { classes: KrsDetailData['details'][number]['kelas'][] } = $props();
  const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
</script>

<div class="table-shell">
  {#if classes.length}
    <div class="overflow-x-auto">
      <table class="min-w-[780px] w-full text-left text-sm">
        <thead><tr><th class="px-4 py-3.5">Mata kuliah / kelas</th><th class="px-4 py-3.5 text-center">SKS</th><th class="px-4 py-3.5">Dosen</th><th class="px-4 py-3.5">Jadwal & ruangan</th><th class="px-4 py-3.5">Kapasitas</th></tr></thead>
        <tbody class="divide-y divide-slate-100">{#each classes as kelas}{@const slot = kelas.jadwal[0]}<tr>
          <td class="px-4 py-4"><div class="flex items-start gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{kelas.namaKelas}</span><div><strong class="font-semibold text-slate-900">{kelas.mataKuliah.kode} · {kelas.mataKuliah.nama}</strong><div class="mt-1"><Badge tone={kelas.status === 'DIBUKA' ? 'success' : 'neutral'}>{kelas.status}</Badge></div></div></div></td>
          <td class="px-4 py-4 text-center font-semibold text-slate-900">{kelas.mataKuliah.sks}</td>
          <td class="px-4 py-4 leading-6">{kelas.dosen.map(item => item.dosen.nama).join(', ') || 'Belum ditugaskan'}</td>
          <td class="px-4 py-4">{#if slot}<p><span class="font-medium text-slate-800">{days[slot.hari]}, {slot.jamMulai.slice(0, 5)}–{slot.jamSelesai.slice(0, 5)}</span><span class="block text-xs text-slate-500">{slot.ruangan.kode} · {slot.ruangan.nama}</span></p>{:else}<span class="text-slate-400">Belum dijadwalkan</span>{/if}</td>
          <td class="px-4 py-4"><span class="font-semibold text-slate-900">{kelas.jumlahMahasiswa} / {kelas.kapasitas}</span><p class="mt-1 text-xs text-slate-500">Sisa {kelas.sisaKapasitas} kursi</p></td>
        </tr>{/each}</tbody>
      </table>
    </div>
  {:else}<EmptyState title="Belum ada kelas" description="Kelas yang dipilih akan muncul di sini." icon="book" compact />{/if}
</div>
