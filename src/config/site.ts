/**
 * Single source of truth for brand + domain. Rename the product by editing this file
 * and `SITE_URL` in astro.config.mjs (Astro config can't import TS at load time).
 */
export const SITE = {
  name: 'InHand',
  domain: 'inhand.in',
  url: 'https://inhand.in',
  tagline: 'CTC to in-hand salary calculator for India',
  /**
   * The Income-tax Act, 2025 (in force 1 April 2026) replaced "previous year" /
   * "assessment year" with "tax year". FY 2026-27 is legally Tax Year 2026-27.
   * "FY" is kept alongside because that is what people search for.
   */
  taxYearLabel: 'Tax Year 2026-27 (FY 2026-27)',
  shortYearLabel: 'FY 2026-27',
  /** Date the statutory figures in src/lib/tax/rates.ts were last verified. */
  ratesVerifiedOn: '2026-10-09',
  contactEmail: 'hello@inhand.in',
  /** Where readers can chip in to keep the site free. Linked from the footer, About and results. */
  support: {
    label: 'Buy me a coffee',
    url: 'https://buymeacoffee.com/developerviraj',
  },
  locale: 'en-IN',
} as const;
