import { MasterDataError } from '../../utils/master-data';

type CreditLimitBand = {
  minimumIpsHundredths: bigint;
  maximumCredits: number;
};

// Kampusia development default. Replace this centralized mapping with the
// university's validated policy when its official ranges are available.
const developmentBands: readonly CreditLimitBand[] = [
  { minimumIpsHundredths: 300n, maximumCredits: 24 },
  { minimumIpsHundredths: 250n, maximumCredits: 21 },
  { minimumIpsHundredths: 200n, maximumCredits: 18 },
  { minimumIpsHundredths: 150n, maximumCredits: 15 },
  { minimumIpsHundredths: 0n, maximumCredits: 12 },
] as const;

function parseIpsHundredths(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new MasterDataError(503, 'IPS semester sebelumnya tidak valid.');
  }
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

function validatePolicy(bands: readonly CreditLimitBand[]) {
  if (!bands.length || bands.at(-1)?.minimumIpsHundredths !== 0n) {
    throw new Error('KRS credit-limit policy must cover IPS from 0.00.');
  }
  for (let index = 0; index < bands.length; index++) {
    const band = bands[index]!;
    if (band.minimumIpsHundredths < 0n || (index > 0 && band.minimumIpsHundredths >= bands[index - 1]!.minimumIpsHundredths)) {
      throw new Error('KRS credit-limit policy thresholds must be strictly descending and nonnegative.');
    }
    if (!Number.isInteger(band.maximumCredits) || band.maximumCredits < 1 || band.maximumCredits > 32767) {
      throw new Error('KRS credit limits must be positive PostgreSQL smallints.');
    }
  }
  return bands;
}

const validatedDevelopmentBands = validatePolicy(developmentBands);

export function getMaximumCreditsFromIps(ips: string) {
  const value = parseIpsHundredths(ips);
  const band = validatedDevelopmentBands.find(item => value >= item.minimumIpsHundredths);
  if (!band) throw new MasterDataError(503, 'Kebijakan batas SKS tidak mencakup IPS semester sebelumnya.');
  return band.maximumCredits;
}

export const developmentCreditLimitPolicy = validatedDevelopmentBands;
