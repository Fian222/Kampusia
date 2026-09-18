import { afterAll, expect, test } from 'bun:test';
import { instantToJakartaDateTime, jakartaDateTimeToInstant } from './semester-time';

const originalTimezone = process.env.TZ;
afterAll(() => { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; });

test('Asia/Jakarta datetime-local converts to the intended absolute instant', () => {
  expect(jakartaDateTimeToInstant('2026-09-18T13:45').toISOString()).toBe('2026-09-18T06:45:00.000Z');
  expect(instantToJakartaDateTime('2026-09-18T06:45:00.000Z')).toBe('2026-09-18T13:45');
});

test('KRS datetime conversion is independent from the server process timezone', () => {
  const values = ['UTC', 'America/New_York', 'Asia/Tokyo'].map(timezone => {
    process.env.TZ = timezone;
    return jakartaDateTimeToInstant('2026-12-31T23:59').toISOString();
  });
  expect(new Set(values)).toEqual(new Set(['2026-12-31T16:59:00.000Z']));
});

test('invalid local calendar values are rejected', () => {
  expect(() => jakartaDateTimeToInstant('2026-02-30T08:00')).toThrow('tidak valid');
  expect(() => jakartaDateTimeToInstant('2026-09-18 08:00')).toThrow('format');
});
