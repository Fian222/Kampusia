<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { loadKelasDetail } from '$lib/server/academic-offerings';
  import { resolveScheduleFormValues } from '$lib/schedule-form';
  import AcademicFields from './AcademicFields.svelte';
  import ReferenceCombobox from './ReferenceCombobox.svelte';
  type Detail = Awaited<ReturnType<typeof loadKelasDetail>>;
  let { action, kelas, rooms, roomMeta, schedule, values, saving, submit }: { action: string; kelas: Detail['kelas']; rooms: Detail['rooms']['data']; roomMeta: Detail['rooms']['meta']; schedule?: Detail['schedules']['data'][number]; values?: Record<string, string>; saving: boolean; submit: SubmitFunction } = $props();
  const options = $derived(schedule && !rooms.some(room => room.id === schedule.ruanganId) ? [schedule.ruangan, ...rooms] : rooms);
  const roomOptions = $derived(options.map(row => ({ value: row.id, label: row.nama, description: `${row.kode} · Kapasitas ${row.kapasitas}`, disabled: !row.isActive && row.id !== schedule?.ruanganId })));
  const fieldValues = $derived(resolveScheduleFormValues(schedule, values));
</script>
{#key `${schedule?.id ?? 'create'}:${JSON.stringify(fieldValues)}`}
<form method="POST" {action} class="mt-4 grid gap-4 sm:grid-cols-2" use:enhance={submit}>
  <input type="hidden" name="mode" value="schedule-save" /><input type="hidden" name="jadwal_id" value={schedule?.id ?? ''} />
  <div class="rounded-lg bg-slate-50 px-3 py-2.5 sm:col-span-2"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Kelas</p><p class="mt-1 text-sm font-semibold text-slate-900">{kelas.mataKuliah.nama} · Kelas {kelas.namaKelas}</p><p class="mt-0.5 font-mono text-xs text-slate-500">{kelas.mataKuliah.kode}</p></div>
  <ReferenceCombobox name="ruangan_id" label="Ruangan" value={fieldValues.ruangan_id} options={roomOptions} selectedOption={schedule?.ruangan ? { value: schedule.ruangan.id, label: schedule.ruangan.nama, description: `${schedule.ruangan.kode} · Kapasitas ${schedule.ruangan.kapasitas}`, disabled: !schedule.ruangan.isActive } : null} meta={roomMeta} searchParam="room_search" pageParam="room_page" placeholder="Pilih ruangan" searchPlaceholder="Cari ruangan…" required />
  <AcademicFields values={fieldValues} fields={[
    { name: 'hari', label: 'Hari', options: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map((label, i) => ({ value: String(i + 1), label })) },
    { name: 'jam_mulai', label: 'Jam Mulai', type: 'time' },
    { name: 'jam_selesai', label: 'Jam Selesai', type: 'time' },
  ]} />
  <div><button class="min-h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-50" disabled={saving}>Simpan jadwal</button></div>
</form>
{/key}
