/**
 * Single source of truth for brand + domain. Rename the product by editing this file
 * and `SITE_URL` in astro.config.mjs (Astro config can't import TS at load time).
 */
export const SITE = {
  name: 'CTC Salary Calculator',
  /** For the home-screen label, which has room for about twelve characters. */
  shortName: 'CTC Salary',
  domain: 'ctcinhand.pages.dev',
  url: 'https://ctcinhand.pages.dev',
  tagline: 'CTC to in-hand salary calculator for India',
  /**
   * The Income-tax Act, 2025 (in force 1 April 2026) replaced "previous year" /
   * "assessment year" with "tax year". FY 2026-27 is legally Tax Year 2026-27.
   * "FY" is kept alongside because that is what people search for.
   */
  taxYearLabel: 'Tax Year 2026-27 (FY 2026-27)',
  shortYearLabel: 'FY 2026-27',
  /**
   * Date the statutory figures were last verified against their sources. Pages show only the month
   * ("October 2026"); re-verify at the start of each month, then move this date.
   */
  ratesVerifiedOn: '2026-10-09',
  contactEmail: 'workwithvirajjadhav@gmail.com',
  /** Where readers can chip in to keep the site free. Linked from the footer, About and results. */
  support: {
    label: 'Buy me a coffee',
    url: 'https://buymeacoffee.com/developerviraj',
  },
  /**
   * Google Search Console's HTML-tag verification code (the content="..." value). Empty until the
   * property is added; the tag is only emitted when this is set.
   */
  googleVerification: '',
  locale: 'en-IN',
} as const;
