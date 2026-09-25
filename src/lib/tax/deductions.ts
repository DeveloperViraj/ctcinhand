/**
 * Chapter VIII deductions and the caps a salary calculator needs, for Tax Year 2026-27 under the
 * Income-tax Act, 2025. Section numbers changed when the 2025 Act replaced the 1961 Act on
 * 1 April 2026; the familiar old numbers are kept in comments because that is what people search for.
 *
 * Under the new regime (s.202(2)) none of these are available except the employer's NPS
 * contribution: no 80C, no HRA, no self-occupied home loan interest, no professional tax, and a
 * house property loss cannot be set off against salary at all.
 */

export const DEDUCTION_CAPS = {
  /** s.123 (formerly 80C). Employee PF, ELSS, life insurance, school fees, principal repayment... */
  sec80C: 1_50_000,
  /** s.124(3) (formerly 80CCD(1B)): additional NPS contribution by the employee. Old regime only. */
  nps80CCD1B: 50_000,
  /** s.126 (formerly 80D): self/family, doubled for senior citizens; parents are a separate limit. */
  healthInsuranceSelf: 25_000,
  healthInsuranceSelfSenior: 50_000,
  healthInsuranceParents: 25_000,
  healthInsuranceParentsSenior: 50_000,
  /** s.22(2) (formerly 24(b)): interest on a self-occupied house, where the loan conditions are met. */
  selfOccupiedInterest: 2_00_000,
  /** s.109 (formerly 71(3A)): house property loss set off against other heads, old regime only. */
  housePropertyLossSetOff: 2_00_000,
} as const;

/** s.17(1)(h): employer contributions to PF + NPS + superannuation above this are a perquisite. */
export const EMPLOYER_CONTRIBUTION_PERQUISITE_LIMIT = 7_50_000;

/**
 * s.124(1)/(2) (formerly 80CCD(2)): employer NPS contribution deduction, as a share of salary
 * (basic + DA). 14% for Central/State Government employers; for everyone else 14% in the new regime
 * and 10% in the old. PSUs and public sector banks count as "other", not government.
 */
export function employerNpsDeductionRate(
  regime: 'new' | 'old',
  employerType: 'government' | 'other',
): number {
  if (employerType === 'government') return 0.14;
  return regime === 'new' ? 0.14 : 0.1;
}

export interface DeductionInputs {
  /** 80C-eligible investments other than employee PF, which the calculator adds automatically. */
  sec80C: number;
  /** s.124(3), old regime only. */
  nps80CCD1B: number;
  /** s.126 health insurance premium, total for self and parents. */
  healthInsurance: number;
  /** Interest paid on a loan for a self-occupied house. */
  selfOccupiedInterest: number;
}

export const NO_DEDUCTIONS: DeductionInputs = {
  sec80C: 0,
  nps80CCD1B: 0,
  healthInsurance: 0,
  selfOccupiedInterest: 0,
};

export interface CappedDeduction {
  claimed: number;
  allowed: number;
  cap: number;
  /** True when the claim was reduced by the cap, so the UI can warn rather than silently trim. */
  capped: boolean;
}

export function applyCap(claimed: number, cap: number): CappedDeduction {
  const value = Math.max(0, claimed);
  return { claimed: value, allowed: Math.min(value, cap), cap, capped: value > cap };
}
