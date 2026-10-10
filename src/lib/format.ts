/** Indian number formatting: lakh/crore grouping, and the compact forms people actually say. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1234567 -> "12,34,567" */
export function formatNumber(amount: number, paise = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return paise ? inrPaise.format(safe) : inr.format(Math.round(safe));
}

/** 1234567 -> "₹12,34,567" */
export function formatRupees(amount: number, paise = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}₹${formatNumber(Math.abs(safe), paise)}`;
}

/** 1250000 -> "₹12.5 L"; 12500000 -> "₹1.25 Cr". For headline summaries only. */
export function formatCompactRupees(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`;
  return formatRupees(safe);
}

function trim(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-10-09" -> "October 2026". Read from the string, so no time zone can move it a month. */
export function formatMonthYear(iso: string): string {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatPercent(fraction: number, decimals = 1): string {
  const safe = Number.isFinite(fraction) ? fraction : 0;
  return `${(safe * 100).toFixed(decimals).replace(/\.0$/, '')}%`;
}

/** Parses what people actually type: "12,00,000", "12L", "12.5 lpa", "1.2cr". Returns null if unusable. */
export function parseRupees(raw: string): number | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[₹,\s]/g, '');
  if (!text) return null;
  const match = /^(\d*\.?\d+)(l|lakh|lac|lpa|cr|crore|k)?$/.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  switch (match[2]) {
    case 'k':
      return value * 1_000;
    case 'l':
    case 'lakh':
    case 'lac':
    case 'lpa':
      return value * 1_00_000;
    case 'cr':
    case 'crore':
      return value * 1_00_00_000;
    default:
      return value;
  }
}
