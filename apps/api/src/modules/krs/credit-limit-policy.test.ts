import { expect, test } from 'bun:test';
import { developmentCreditLimitPolicy, getMaximumCreditsFromIps } from './credit-limit-policy';

test('development KRS credit policy maps every IPS band and exact boundary deterministically', () => {
  expect(developmentCreditLimitPolicy.map(band => [band.minimumIpsHundredths, band.maximumCredits])).toEqual([
    [300n, 24],
    [250n, 21],
    [200n, 18],
    [150n, 15],
    [0n, 12],
  ]);
  for (const [ips, expected] of [
    ['4.00', 24], ['3.00', 24], ['2.99', 21], ['2.50', 21],
    ['2.49', 18], ['2.00', 18], ['1.99', 15], ['1.50', 15],
    ['1.49', 12], ['0.00', 12],
  ] as const) expect(getMaximumCreditsFromIps(ips)).toBe(expected);
});

test('development KRS credit policy compares decimal strings without binary floating point', () => {
  expect(getMaximumCreditsFromIps('2.5')).toBe(21);
  expect(getMaximumCreditsFromIps('2.05')).toBe(18);
  expect(() => getMaximumCreditsFromIps('2.501')).toThrow('IPS semester sebelumnya tidak valid');
});
