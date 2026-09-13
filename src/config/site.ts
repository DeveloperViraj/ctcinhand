/**
 * Single source of truth for brand + domain. Rename the product by editing this file
 * and `site` in astro.config.mjs (Astro config can't import TS at load time).
 */
export const SITE = {
  name: 'InHand',
  domain: 'inhand.in',
  url: 'https://inhand.in',
  tagline: 'CTC to in-hand salary calculator for India',
  fiscalYear: 'FY 2026-27',
  assessmentYear: 'AY 2027-28',
  /** Date the statutory figures in src/lib/tax/rates.ts were last verified. */
  ratesVerifiedOn: '2026-09-13',
  contactEmail: 'hello@inhand.in',
  locale: 'en-IN',
} as const;
