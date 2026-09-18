import { MasterDataError } from '../../utils/master-data';

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Convert an Asia/Jakarta datetime-local value without consulting the host timezone. */
export function jakartaDateTimeToInstant(value: string): Date {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) throw new MasterDataError(400, 'Waktu periode KRS harus berformat tanggal dan jam lokal Asia/Jakarta.');
  const [, year, month, day, hour, minute, second = '00'] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, s] = parts as [number, number, number, number, number, number];
  const localAsUtc = Date.UTC(y, m - 1, d, h, min, s);
  const check = new Date(localAsUtc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d
    || check.getUTCHours() !== h || check.getUTCMinutes() !== min || check.getUTCSeconds() !== s) {
    throw new MasterDataError(400, 'Waktu periode KRS tidak valid.');
  }
  return new Date(localAsUtc - JAKARTA_OFFSET_MS);
}

/** Format an instant for an HTML datetime-local control in Asia/Jakarta. */
export function instantToJakartaDateTime(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new MasterDataError(400, 'Waktu periode KRS tidak valid.');
  const local = new Date(instant.getTime() + JAKARTA_OFFSET_MS);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
