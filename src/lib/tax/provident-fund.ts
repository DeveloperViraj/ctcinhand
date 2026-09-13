/**
 * Employees' Provident Fund, under the Employees' Provident Funds Scheme 2026 (G.S.R. 525(E),
 * 29 June 2026) made under the Code on Social Security 2020. Rates are unchanged from the 1952
 * scheme, but contributions are now computed on Labour Code "wages" (see labour-code-wages.ts),
 * not strictly on basic + DA.
 *
 * The Rs 15,000 wage ceiling was re-notified unchanged on 29 May 2026. A rise to Rs 25,000 has been
 * reported as cleared by the Finance Ministry but is NOT notified as of September 2026: change
 * EPF.wageCeiling only when a gazette notification exists.
 */

export const EPF = {
  /** Statutory wage ceiling per month (CoSS s.2(89) notification, 29 May 2026). */
  wageCeiling: 15_000,
  /** Employee and employer rates (EPF Scheme 2026 para 18(2)). */
  employeeRate: 0.12,
  employerRate: 0.12,
  /** Part of the employer's 12% diverted to the Employees' Pension Scheme, on wages up to the ceiling. */
  epsRate: 0.0833,
} as const;

/**
 * How the contribution base is set. This is the single most commonly confused point on salary
 * calculators, so it is an explicit user choice rather than an assumption.
 *
 * - 'ceiling': both shares on min(wages, Rs 15,000). Most employers do this; max Rs 1,800 each.
 * - 'actual':  both shares on full wages. Above the ceiling this is voluntary (para 19) but common.
 * - 'none':    not a PF member (e.g. an establishment not covered, or an excluded employee).
 */
export type PfMode = 'ceiling' | 'actual' | 'none';

export interface PfResult {
  /** Wages the contributions were calculated on, per month. */
  contributionWage: number;
  employee: number;
  employerTotal: number;
  /** Employer share going to the pension scheme (capped at the ceiling). */
  employerEps: number;
  /** Employer share credited to the PF account. */
  employerEpf: number;
}

export function computeProvidentFund(monthlyWages: number, mode: PfMode): PfResult {
  const wages = Math.max(0, monthlyWages);
  if (mode === 'none') {
    return { contributionWage: 0, employee: 0, employerTotal: 0, employerEps: 0, employerEpf: 0 };
  }
  const contributionWage = mode === 'ceiling' ? Math.min(wages, EPF.wageCeiling) : wages;
  const employee = contributionWage * EPF.employeeRate;
  const employerTotal = contributionWage * EPF.employerRate;
  const employerEps = Math.min(wages, EPF.wageCeiling) * EPF.epsRate;
  return {
    contributionWage,
    employee,
    employerTotal,
    employerEps,
    employerEpf: employerTotal - employerEps,
  };
}
