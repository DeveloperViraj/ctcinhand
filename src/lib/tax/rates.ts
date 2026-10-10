/**
 * Statutory figures for Tax Year 2026-27 (FY 2026-27, 1 April 2026 to 31 March 2027).
 *
 * Every constant cites the provision it comes from. All figures were checked on 2026-09-13
 * against primary sources: the Income-tax Act, 2025 (Act 30 of 2025, gazette ID 265620),
 * Finance Act 2026 (Act 4 of 2026, gazette ID 271439), the Income-tax Rules 2026
 * (G.S.R. 198(E), 20 Mar 2026) and state professional-tax Acts.
 *
 * RE-VERIFY EVERYTHING HERE after Union Budget 2027 before reusing it for Tax Year 2027-28.
 */

export type Regime = 'new' | 'old';

/** An upper bound of Infinity marks the open-ended top slab. Rates are fractions. */
export interface Slab {
  readonly upTo: number;
  readonly rate: number;
}

export const TAX_YEAR = '2026-27';

/** New regime, Income-tax Act 2025 s.202(1) Table. Same for every age. Unchanged by Finance Act 2026. */
export const NEW_REGIME_SLABS: readonly Slab[] = [
  { upTo: 4_00_000, rate: 0 },
  { upTo: 8_00_000, rate: 0.05 },
  { upTo: 12_00_000, rate: 0.1 },
  { upTo: 16_00_000, rate: 0.15 },
  { upTo: 20_00_000, rate: 0.2 },
  { upTo: 24_00_000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

/** Old regime, Finance Act 2026 First Schedule Part I-B Paragraph A. */
export const OLD_REGIME_SLABS = {
  /** Resident below 60, and every non-resident regardless of age. */
  below60: [
    { upTo: 2_50_000, rate: 0 },
    { upTo: 5_00_000, rate: 0.05 },
    { upTo: 10_00_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
  /** Resident senior citizen, 60 to 79. */
  senior: [
    { upTo: 3_00_000, rate: 0 },
    { upTo: 5_00_000, rate: 0.05 },
    { upTo: 10_00_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
  /** Resident super senior citizen, 80 and above. */
  superSenior: [
    { upTo: 5_00_000, rate: 0 },
    { upTo: 10_00_000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ],
} as const satisfies Record<string, readonly Slab[]>;

// Standard deduction: Income-tax Act 2025 s.19(1) Table Sl. 2, capped at the salary itself

export const STANDARD_DEDUCTION: Record<Regime, number> = {
  new: 75_000, // Sl. 2(a): where tax is computed under s.202(1)
  old: 50_000, // Sl. 2(b): any other case
};

// Rebate: Income-tax Act 2025 s.156 (formerly s.87A). Resident individuals only.

export interface RebateRule {
  /** Full rebate applies when total income does not exceed this. */
  readonly incomeLimit: number;
  readonly maxRebate: number;
  /**
   * s.156(2)(b), new regime only: above the limit, tax payable may not exceed the income in
   * excess of the limit. The old regime has no such taper (a hard cliff at Rs 5,00,000).
   */
  readonly marginalRelief: boolean;
}

export const REBATE: Record<Regime, RebateRule> = {
  new: { incomeLimit: 12_00_000, maxRebate: 60_000, marginalRelief: true }, // s.156(2)
  old: { incomeLimit: 5_00_000, maxRebate: 12_500, marginalRelief: false }, // s.156(1)
};

// Surcharge on income-tax, with marginal relief at every threshold.
// Old regime: Finance Act 2026 Part I-B Para F. New regime: Finance Act 2026 s.3(4)(b) Table Sl.10.
// A tier applies when total income EXCEEDS its threshold (exactly Rs 50L carries no surcharge).

export interface SurchargeTier {
  readonly above: number;
  readonly rate: number;
}

export const SURCHARGE: Record<Regime, readonly SurchargeTier[]> = {
  new: [
    { above: 50_00_000, rate: 0.1 },
    { above: 1_00_00_000, rate: 0.15 },
    // No 37% tier for s.202 taxpayers: 25% applies to everything above Rs 2 crore.
    { above: 2_00_00_000, rate: 0.25 },
  ],
  old: [
    { above: 50_00_000, rate: 0.1 },
    { above: 1_00_00_000, rate: 0.15 },
    { above: 2_00_00_000, rate: 0.25 },
    { above: 5_00_00_000, rate: 0.37 },
  ],
};

/** Health & Education Cess: Finance Act 2026 s.3(15). 4% of income-tax plus surcharge. */
export const CESS_RATE = 0.04;
