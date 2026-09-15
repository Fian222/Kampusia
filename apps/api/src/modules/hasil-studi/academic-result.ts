import { MasterDataError } from '../../utils/master-data';

export type AcademicResultInput = {
  sks: number;
  nilaiIndeks: string;
};

function decimalHundredths(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new MasterDataError(503, 'Nilai indeks hasil studi tidak valid.');
  }
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function formatHundredths(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

/** Rounds a nonnegative exact rational to an integer using round-half-up. */
function divideHalfUp(numerator: bigint, denominator: bigint) {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * Calculates exact credit-weighted grade points and a two-decimal displayed index.
 * Stored grade indexes are two-decimal PostgreSQL numeric values and SKS is integral,
 * so no binary floating-point values participate in the calculation.
 */
export function calculateAcademicIndex(results: readonly AcademicResultInput[]) {
  let totalSks = 0;
  let weightedHundredths = 0n;

  for (const result of results) {
    if (!Number.isSafeInteger(result.sks) || result.sks <= 0) {
      throw new MasterDataError(503, 'SKS mata kuliah hasil studi tidak valid.');
    }
    totalSks += result.sks;
    weightedHundredths += BigInt(result.sks) * decimalHundredths(result.nilaiIndeks);
  }

  return {
    totalSks,
    totalWeightedGradePoints: formatHundredths(weightedHundredths),
    index: totalSks === 0 ? null : formatHundredths(divideHalfUp(weightedHundredths, BigInt(totalSks))),
  };
}

export const academicResultDisplayPolicy = {
  decimalPlaces: 2,
  rounding: 'ROUND_HALF_UP',
  repeatedCourses: 'COUNT_ALL_FINALIZED_ATTEMPTS',
} as const;
