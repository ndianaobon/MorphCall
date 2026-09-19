/** Country → data region for sensitive data (docs/01 §7, D2). Unlisted countries use 'global'. */
const EU_EEA = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
]);

export type DataRegion = 'global' | 'eu' | 'us' | 'ng' | 'uk';

export function dataRegionFor(countryCode: string): DataRegion {
  if (countryCode === 'NG') return 'ng';
  if (countryCode === 'GB') return 'uk';
  if (countryCode === 'US') return 'us';
  if (EU_EEA.has(countryCode)) return 'eu';
  return 'global';
}
