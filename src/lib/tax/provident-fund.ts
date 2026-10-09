/**
 * Employees' Provident Fund, under the Employees' Provident Funds Scheme 2026 (G.S.R. 525(E),
 * 29 June 2026) made under the Code on Social Security 2020. Rates are unchanged from the 1952
 * scheme, but contributions are now computed on Labour Code "wages" (see labour-code-wages.ts),
 * not strictly on basic + DA.
 *
 * The statutory wage ceiling changed in the middle of this tax year. S.O. 2702(E) of 29 May 2026
 * re-notified it at Rs 15,000; S.O. 5109(E) of 17 September 2026 superseded that with Rs 25,000
 * from the date of publication, for EPF, EPS and EDLI alike. So for Tax Year 2026-27:
 *   April to August       Rs 15,000
 *   September             split by days: 16 days at Rs 15,000 and 14 at Rs 25,000
 *   October to March      Rs 25,000
 * September's contribution base is the day-weighted average of the capped wage in each part,
 * (16 x min(wages, 15,000) + 14 x min(wages, 25,000)) / 30, not wages capped at a blended ceiling:
 * the two differ for wages between the ceilings.
 * From Tax Year 2027-28 every month is Rs 25,000: replace WAGE_MONTHS accordingly.
 */

export const EPF = {
  /** The ceiling in force now (S.O. 5109(E), 17 September 2026). */
  wageCeiling: 25_000,
  /** The ceiling until 16 September 2026 (S.O. 2702(E), 29 May 2026). */
  previousWageCeiling: 15_000,
  /** Employee and employer rates (EPF Scheme 2026 para 18(2)). */
  employeeRate: 0.12,
  employerRate: 0.12,
  /** Part of the employer's 12% diverted to the Employees' Pension Scheme, on wages up to the ceiling. */
  epsRate: 0.0833,
} as const;

const SEPTEMBER_DAYS = 30;
const DAYS_AT_OLD_CEILING = 16;

/** One stretch of a wage month at a single ceiling, as a share of the month's days. */
interface CeilingPart {
  ceiling: number;
  share: number;
}

/** Each wage month of Tax Year 2026-27, April to March, as the ceilings in force during it. */
const WAGE_MONTHS: readonly (readonly CeilingPart[])[] = [
  ...Array.from({ length: 5 }, () => [{ ceiling: EPF.previousWageCeiling, share: 1 }]),
  [
    { ceiling: EPF.previousWageCeiling, share: DAYS_AT_OLD_CEILING / SEPTEMBER_DAYS },
    { ceiling: EPF.wageCeiling, share: (SEPTEMBER_DAYS - DAYS_AT_OLD_CEILING) / SEPTEMBER_DAYS },
  ],
  ...Array.from({ length: 6 }, () => [{ ceiling: EPF.wageCeiling, share: 1 }]),
];

/** Wages counted for a month: the capped wage in each part of it, weighted by days. */
const cappedWages = (wages: number, month: readonly CeilingPart[]) =>
  month.reduce((sum, part) => sum + part.share * Math.min(wages, part.ceiling), 0);

/** The day-weighted ceiling for each wage month, for display (September is Rs 19,666.67). */
export const CEILING_BY_MONTH: readonly number[] = WAGE_MONTHS.map((month) =>
  month.reduce((sum, part) => sum + part.share * part.ceiling, 0),
);

/**
 * How the contribution base is set. This is the single most commonly confused point on salary
 * calculators, so it is an explicit user choice rather than an assumption.
 *
 * - 'ceiling': both shares on min(wages, the month's ceiling). Most employers do this.
 * - 'actual':  both shares on full wages. Above the ceiling this is voluntary (para 19) but common.
 * - 'none':    not a PF member (e.g. an establishment not covered, or an excluded employee).
 */
export type PfMode = 'ceiling' | 'actual' | 'none';

export interface PfResult {
  /**
   * Monthly figures are averages over the tax year, because the ceiling changed mid-year; times
   * twelve they give the exact annual amounts.
   */
  /** Wages the contributions were calculated on, per month (average). */
  contributionWage: number;
  employee: number;
  employerTotal: number;
  /** Employer share going to the pension scheme (capped at the ceiling). */
  employerEps: number;
  /** Employer share credited to the PF account. */
  employerEpf: number;
  /** The employee's contribution in each wage month, April to March. */
  employeeByMonth: number[];
}

const average = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function computeProvidentFund(monthlyWages: number, mode: PfMode): PfResult {
  const wages = Math.max(0, monthlyWages);
  if (mode === 'none') {
    return {
      contributionWage: 0,
      employee: 0,
      employerTotal: 0,
      employerEps: 0,
      employerEpf: 0,
      employeeByMonth: CEILING_BY_MONTH.map(() => 0),
    };
  }
  const pensionBase = WAGE_MONTHS.map((month) => cappedWages(wages, month));
  const base = mode === 'ceiling' ? pensionBase : WAGE_MONTHS.map(() => wages);
  const contributionWage = average(base);
  const employee = contributionWage * EPF.employeeRate;
  const employerTotal = contributionWage * EPF.employerRate;
  const employerEps = average(pensionBase) * EPF.epsRate;
  return {
    contributionWage,
    employee,
    employerTotal,
    employerEps,
    employerEpf: employerTotal - employerEps,
    employeeByMonth: base.map((b) => b * EPF.employeeRate),
  };
}
