/**
 * "Wages" under the Labour Codes, in force nationwide from 21 November 2025.
 *
 * Code on Wages 2019 s.2(y) and Code on Social Security 2020 s.2(88) share one definition. Wages
 * include basic pay, dearness allowance and retaining allowance, and exclude a list of payments:
 * (a) statutory bonus, (b) amenities, (c) employer PF/pension contributions, (d) conveyance and
 * travel concessions, (e) special-expense reimbursements, (f) HRA, (g) awards, (h) overtime,
 * (i) commission, (j) gratuity, (k) retrenchment and retirement benefits.
 *
 * First proviso (the "50% rule"): if the payments under (a) to (i) exceed one-half of all
 * remuneration, the excess is deemed wages. This is a computation rule, NOT a legal floor on Basic.
 * The excess is still paid as an allowance; it is only counted as wages for PF, ESI and gratuity.
 *
 * Interpretation choices (see /how-it-works for the full reasoning):
 *
 * 1. What "all remuneration" includes follows the Ministry of Labour's Additional FAQs of
 *    16.03.2026, Q1: employer PF and pension contributions and statutory bonus are included;
 *    gratuity, ESI and other retirement benefits are not. The earlier FAQ of 30.12.2025 put
 *    gratuity inside the total in its worked example; the later, more specific answer is used.
 *
 * 2. General allowances such as "special allowance" are not named in either list. The Ministry
 *    treats every payment other than Basic, DA and retaining allowance as subject to the 50% test
 *    (FAQ 30.12.2025 Q3), and says unlisted components are not considered for gratuity
 *    (FAQ 16.03.2026 Q13). That is the default here. The statute's literal text can also be read
 *    as making such allowances wages in full, so callers can opt into that reading.
 *
 * 3. Performance incentives, ESOPs, variable pay and reimbursements are not wages and are not part
 *    of the remuneration total (FAQ 30.12.2025 Q3; FAQ 16.03.2026 Q4).
 */

export interface WageComponents {
  /** Basic pay + dearness allowance + retaining allowance, per month. */
  basicDa: number;
  /**
   * Allowances counted toward the 50% test: HRA, conveyance, LTA, and (by default) special and
   * other general allowances. Per month.
   */
  testedAllowances: number;
  /** Allowances the caller has chosen to treat as wages in full (statute's literal reading). */
  allowancesAsWages: number;
  /** Employer PF + pension (EPS) contribution per month. Part of both the test and the total. */
  employerPf: number;
}

export interface CodeWages {
  /** Statutory wages for PF, ESI and gratuity, per month. */
  wages: number;
  /** Amount added to wages because excluded payments exceeded half of remuneration. */
  addBack: number;
  /** "All remuneration" used as the base of the 50% test. */
  remuneration: number;
  /** Payments under clauses (a) to (i) in this model. */
  excludedPayments: number;
  /** excludedPayments / remuneration, for display. */
  excludedShare: number;
}

export const WAGE_RULE_THRESHOLD = 0.5;

export function computeCodeWages(c: WageComponents): CodeWages {
  const inWages = c.basicDa + c.allowancesAsWages;
  const excludedPayments = c.testedAllowances + c.employerPf;
  const remuneration = inWages + excludedPayments;
  const addBack = Math.max(0, excludedPayments - WAGE_RULE_THRESHOLD * remuneration);
  return {
    wages: inWages + addBack,
    addBack,
    remuneration,
    excludedPayments,
    excludedShare: remuneration > 0 ? excludedPayments / remuneration : 0,
  };
}
