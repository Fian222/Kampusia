<script lang="ts">
  import type { KrsDetailData } from '$lib/server/krs';
  let { classes }: { classes: KrsDetailData['details'][number]['kelas'][] } = $props();
  const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
</script>
<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table class="w-full text-left text-sm">
    <thead class="bg-slate-50"><tr><th class="p-3">Mata kuliah / kelas</th><th class="p-3">SKS</th><th class="p-3">Dosen</th><th class="p-3">Jadwal & ruangan</th><th class="p-3">Disetujui / kapasitas</th></tr></thead>
    <tbody>{#each classes as kelas}<tr class="border-t border-slate-100">
      <td class="p-3"><strong>{kelas.mataKuliah.kode} / {kelas.namaKelas}</strong><p>{kelas.mataKuliah.nama}</p><p class="text-xs text-slate-500">{kelas.status}</p></td>
      <td class="p-3">{kelas.mataKuliah.sks}</td>
      <td class="p-3">{kelas.dosen.map(item => item.dosen.nama).join(', ') || 'Belum ditugaskan'}</td>
      <td class="p-3">{#each kelas.jadwal as slot}<p>{days[slot.hari]} {slot.jamMulai.slice(0, 5)}–{slot.jamSelesai.slice(0, 5)} · {slot.ruangan.kode} ({slot.ruangan.nama})</p>{/each}</td>
      <td class="p-3">{kelas.jumlahMahasiswa} / {kelas.kapasitas}<p class="text-xs text-slate-500">Sisa {kelas.sisaKapasitas}</p></td>
    </tr>{:else}<tr><td colspan="5" class="p-5 text-slate-500">Belum ada kelas.</td></tr>{/each}</tbody>
  </table>
</div>
