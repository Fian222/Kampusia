<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { loadKelasDetail } from '$lib/server/academic-offerings';
  import AcademicFields from './AcademicFields.svelte';
  type Detail = Awaited<ReturnType<typeof loadKelasDetail>>;
  let { rooms, slot, values, saving, submit }: { rooms: Detail['rooms']['data']; slot?: Detail['schedules']['data'][number]; values?: Record<string, string>; saving: boolean; submit: SubmitFunction } = $props();
  const options = $derived(slot && !rooms.some(room => room.id === slot.ruanganId) ? [slot.ruangan, ...rooms] : rooms);
  const failed = $derived(values?.mode === 'schedule-save' && (values.jadwal_id ?? '') === (slot?.id ?? '') ? values : {});
</script>
{#key JSON.stringify(failed) + slot?.updatedAt}
<form method="POST" class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
  <input type="hidden" name="mode" value="schedule-save" /><input type="hidden" name="jadwal_id" value={slot?.id ?? ''} />
  <AcademicFields values={failed} fields={[
    { name: 'hari', label: 'Hari', value: slot?.hari, options: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((label, i) => ({ value: String(i + 1), label })) },
    { name: 'ruangan_id', label: 'Ruangan', value: slot?.ruanganId, options: options.map(row => ({ value: row.id, label: `${row.kode} — ${row.nama} (${row.kapasitas})${row.isActive ? '' : ' — Nonaktif'}` })) },
    { name: 'jam_mulai', label: 'Jam Mulai', type: 'time', value: slot?.jamMulai, step: 'any' },
    { name: 'jam_selesai', label: 'Jam Selesai', type: 'time', value: slot?.jamSelesai, step: 'any' },
  ]} />
  <div><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50" disabled={saving}>Simpan jadwal</button></div>
</form>
{/key}
