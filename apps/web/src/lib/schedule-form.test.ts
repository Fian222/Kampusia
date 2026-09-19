import { expect, test } from 'bun:test';
import { resolveScheduleFormValues, scheduleTimeInputValue, type ScheduleFormSchedule } from './schedule-form';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();
const schedule: ScheduleFormSchedule = {
  id: 'schedule-a',
  ruanganId: 'room-101',
  hari: 1,
  jamMulai: '08:00:00',
  jamSelesai: '10:30:00',
};

test('first schedule edit initialization preloads every persisted value', () => {
  expect(resolveScheduleFormValues(schedule)).toEqual({
    ruangan_id: 'room-101',
    hari: '1',
    jam_mulai: '08:00',
    jam_selesai: '10:30',
  });
  expect(scheduleTimeInputValue('08:00')).toBe('08:00');
  expect(scheduleTimeInputValue('08:00:00')).toBe('08:00');
});

test('an unchanged edit submission retains the canonical day and class-scoped values', () => {
  const values = resolveScheduleFormValues(schedule);
  const submitted = new URLSearchParams(values);

  expect(submitted.get('hari')).toBe('1');
  expect(submitted.get('ruangan_id')).toBe('room-101');
  expect(submitted.get('jam_mulai')).toBe('08:00');
  expect(submitted.get('jam_selesai')).toBe('10:30');
  expect(submitted.has('kelas_kuliah_id')).toBe(false);
});

test('failed values stay with their matching edit and never leak between create or another schedule', () => {
  const failedEdit = {
    mode: 'schedule-save',
    jadwal_id: 'schedule-a',
    ruangan_id: 'room-202',
    hari: '2',
    jam_mulai: '09:00',
    jam_selesai: '11:00',
  };
  expect(resolveScheduleFormValues(schedule, failedEdit)).toEqual({
    ruangan_id: 'room-202',
    hari: '2',
    jam_mulai: '09:00',
    jam_selesai: '11:00',
  });
  expect(resolveScheduleFormValues(undefined, failedEdit)).toEqual({
    ruangan_id: '',
    hari: '',
    jam_mulai: '',
    jam_selesai: '',
  });
  expect(resolveScheduleFormValues({ ...schedule, id: 'schedule-b', hari: 3 }, failedEdit).hari).toBe('3');

  const failedCreate = { ...failedEdit, jadwal_id: '' };
  expect(resolveScheduleFormValues(undefined, failedCreate).hari).toBe('2');
});

test('schedule modal shows fixed class context and preserves human-readable room selection', async () => {
  const [component, fields, server] = await Promise.all([
    read('./components/ScheduleForm.svelte'),
    read('./components/AcademicFields.svelte'),
    read('./server/academic-offerings.ts'),
  ]);

  expect(component).toContain('{kelas.mataKuliah.nama} · Kelas {kelas.namaKelas}');
  expect(component).toContain('{kelas.mataKuliah.kode}');
  expect(component).toContain('selectedOption={schedule?.ruangan');
  expect(component).toContain('value={fieldValues.ruangan_id}');
  expect(component).not.toContain('name="kelas_kuliah_id"');
  expect(fields).toContain("value={String(values[field.name] ?? field.value ?? '')}");
  expect(server).toContain("client['kelas-kuliah']({ id: event.params.id! }).jadwal");
});
