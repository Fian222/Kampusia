export type ScheduleFormSchedule = {
  id: string;
  ruanganId: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
};

export type ScheduleFormValues = {
  ruangan_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
};

export function scheduleTimeInputValue(value: string | null | undefined) {
  return value?.slice(0, 5) ?? '';
}

export function resolveScheduleFormValues(
  schedule: ScheduleFormSchedule | undefined,
  attempted?: Record<string, string>,
): ScheduleFormValues {
  const initial = {
    ruangan_id: schedule?.ruanganId ?? '',
    hari: schedule ? String(schedule.hari) : '',
    jam_mulai: scheduleTimeInputValue(schedule?.jamMulai),
    jam_selesai: scheduleTimeInputValue(schedule?.jamSelesai),
  };
  const attemptedId = attempted?.jadwal_id ?? '';
  const currentId = schedule?.id ?? '';
  if (attempted?.mode !== 'schedule-save' || attemptedId !== currentId) return initial;
  return {
    ruangan_id: attempted.ruangan_id ?? initial.ruangan_id,
    hari: attempted.hari ?? initial.hari,
    jam_mulai: attempted.jam_mulai ?? initial.jam_mulai,
    jam_selesai: attempted.jam_selesai ?? initial.jam_selesai,
  };
}
