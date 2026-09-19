const academicDateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const jakartaDateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Preserve PostgreSQL DATE semantics without applying the browser's timezone. */
export function academicDateIso(value: Date | string): string {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatAcademicDate(value: Date | string): string {
  const iso = academicDateIso(value);
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  return academicDateFormatter.format(new Date(Date.UTC(year!, month! - 1, day!)));
}

export function formatAcademicDateRange(start: Date | string, end: Date | string): string {
  return `${formatAcademicDate(start)} – ${formatAcademicDate(end)}`;
}

export function formatJakartaDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : jakartaDateTimeFormatter.format(date);
}

export function formatJakartaDateTimeRange(start: Date | string, end: Date | string): string {
  return `${formatJakartaDateTime(start)} – ${formatJakartaDateTime(end)} WIB`;
}
