import { expect, test } from 'bun:test';
import { academicDateIso, formatAcademicDate, formatAcademicDateRange, formatJakartaDateTime, formatJakartaDateTimeRange } from './date-format';

test('academic DATE formatting preserves the calendar day without browser timezone conversion', () => {
  expect(academicDateIso('2026-08-24')).toBe('2026-08-24');
  expect(academicDateIso(new Date('2026-08-24T00:00:00.000Z'))).toBe('2026-08-24');
  expect(formatAcademicDate('2026-08-24')).toBe('24 Agu 2026');
  expect(formatAcademicDateRange(new Date('2026-08-24T00:00:00.000Z'), '2027-01-15')).toBe('24 Agu 2026 – 15 Jan 2027');
});

test('instant formatting always uses explicit Asia/Jakarta time', () => {
  expect(formatJakartaDateTime('2026-09-01T07:56:00.000Z')).toBe('1 Sep 2026, 14.56');
  expect(formatJakartaDateTimeRange('2026-09-01T07:56:00.000Z', '2026-09-26T07:56:00.000Z')).toBe('1 Sep 2026, 14.56 – 26 Sep 2026, 14.56 WIB');
});
