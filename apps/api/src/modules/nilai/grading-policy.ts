import { MasterDataError } from '../../utils/master-data';

export type GradeAward = { nilaiHuruf: string; nilaiIndeks: string };
type Band = GradeAward & { minimumHundredths: bigint };

// Kampusia development default. It is deliberately isolated so an institution can replace it.
const bands: readonly Band[] = [
  { minimumHundredths: 8500n, nilaiHuruf: 'A', nilaiIndeks: '4.00' },
  { minimumHundredths: 8000n, nilaiHuruf: 'A-', nilaiIndeks: '3.70' },
  { minimumHundredths: 7500n, nilaiHuruf: 'B+', nilaiIndeks: '3.30' },
  { minimumHundredths: 7000n, nilaiHuruf: 'B', nilaiIndeks: '3.00' },
  { minimumHundredths: 6500n, nilaiHuruf: 'B-', nilaiIndeks: '2.70' },
  { minimumHundredths: 6000n, nilaiHuruf: 'C+', nilaiIndeks: '2.30' },
  { minimumHundredths: 5500n, nilaiHuruf: 'C', nilaiIndeks: '2.00' },
  { minimumHundredths: 4500n, nilaiHuruf: 'D', nilaiIndeks: '1.00' },
  { minimumHundredths: 0n, nilaiHuruf: 'E', nilaiIndeks: '0.00' },
] as const;

function validatePolicy(policy: readonly Band[]) {
  if (!policy.length || policy.at(-1)?.minimumHundredths !== 0n) throw new Error('Grading policy must cover 0.00.');
  for (let index = 0; index < policy.length; index++) {
    const band = policy[index]!;
    if (band.minimumHundredths < 0n || band.minimumHundredths > 10000n || (index > 0 && band.minimumHundredths >= policy[index - 1]!.minimumHundredths)) throw new Error('Grading policy thresholds must be strictly descending within 0.00–100.00.');
    if (!band.nilaiHuruf.trim() || band.nilaiHuruf !== band.nilaiHuruf.trim().toUpperCase()) throw new Error('Grading policy letters must be canonical.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(band.nilaiIndeks)) throw new Error('Grading policy indexes must be nonnegative decimals.');
  }
  return policy;
}

const validatedBands = validatePolicy(bands);

export function decimalHundredths(value: string, label: string, minimum: bigint, maximum: bigint) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new MasterDataError(400, `${label} harus berupa angka dengan maksimal dua angka desimal.`);
  const [whole = '0', fraction = ''] = value.split('.');
  const result = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (result < minimum || result > maximum) throw new MasterDataError(400, `${label} harus berada pada rentang ${formatHundredths(minimum)} sampai ${formatHundredths(maximum)}.`);
  return result;
}

export function formatHundredths(value: bigint) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Exact weighted total, rounded half-up once after the complete sum. */
export function weightedFinal(scores: readonly { nilai: string; bobot: string }[]) {
  const numerator = scores.reduce((sum, item) => sum + decimalHundredths(item.nilai, 'Nilai', 0n, 10000n) * decimalHundredths(item.bobot, 'Bobot', 1n, 10000n), 0n);
  return formatHundredths((numerator + 5000n) / 10000n);
}

export function awardGrade(nilaiAngka: string): GradeAward {
  const value = decimalHundredths(nilaiAngka, 'Nilai akhir', 0n, 10000n);
  const band = validatedBands.find(item => value >= item.minimumHundredths);
  if (!band) throw new MasterDataError(503, 'Kebijakan nilai tidak mencakup nilai akhir ini.');
  return { nilaiHuruf: band.nilaiHuruf, nilaiIndeks: band.nilaiIndeks };
}

export const developmentGradingPolicy = validatedBands;
