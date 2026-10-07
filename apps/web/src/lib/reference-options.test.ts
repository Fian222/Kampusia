import { expect, test } from 'bun:test';
import { nextEnabledOption } from './navigation/reference-options';

test('empty and entirely disabled reference results have no keyboard target', () => {
  expect(nextEnabledOption([], -1, 1)).toBe(-1);
  for (const cursor of [-1, 0, 1, 99]) {
    expect(nextEnabledOption([{ disabled: true }, { disabled: true }], cursor, 1)).toBe(-1);
    expect(nextEnabledOption([{ disabled: true }, { disabled: true }], cursor, -1)).toBe(-1);
  }
});

test('reference keyboard cursor skips disabled items, wraps, and starts at either end', () => {
  const options = [{ disabled: true }, {}, { disabled: true }, {}];
  expect(nextEnabledOption(options, -1, 1)).toBe(1);
  expect(nextEnabledOption(options, -1, -1)).toBe(3);
  expect(nextEnabledOption(options, 1, 1)).toBe(3);
  expect(nextEnabledOption(options, 3, 1)).toBe(1);
  expect(nextEnabledOption(options, 1, -1)).toBe(3);
  expect(nextEnabledOption(options, 99, 1)).toBe(1);
});
