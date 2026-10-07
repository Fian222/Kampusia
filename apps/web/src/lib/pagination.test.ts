import { expect, test } from 'bun:test';
import { paginationRange } from './navigation/pagination';

test('pagination ranges cover empty, partial, and full pages', () => {
  expect(paginationRange(1, 20, 0)).toMatchObject({ start: 0, end: 0, pages: 1, outOfRange: false });
  expect(paginationRange(2, 20, 21)).toMatchObject({ start: 21, end: 21, pages: 2, outOfRange: false });
  expect(paginationRange(1, 20, 20)).toMatchObject({ start: 1, end: 20, pages: 1 });
});

test('a stale or manually supplied page returns directly to the last valid page', () => {
  expect(paginationRange(999999, 20, 21)).toEqual({ start: 0, end: 0, pages: 2, outOfRange: true, previous: 2 });
  expect(paginationRange(2, 20, 0)).toMatchObject({ start: 0, end: 0, pages: 1, previous: 1, outOfRange: true });
});
