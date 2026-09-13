/**
 * Employees' State Insurance, under Chapter IV of the Code on Social Security 2020 (in force
 * 21 November 2025). Rates from esic.gov.in/contribution (effective 1 July 2019); coverage ceiling
 * from esic.gov.in/coverage (effective 1 January 2017).
 *
 * Since 21 November 2025 both the ceiling test and the contribution base use Labour Code "wages"
 * (ESIC HQ circular P-11/12/MinistryMol&E/2024-RevII, 11.12.2025), not gross salary. ESIC expects
 * this to bring many previously exempt employees back into coverage.
 */

export const ESI = {
  /** Covered when monthly wages do not exceed this. */
  wageCeiling: 21_000,
  /** Ceiling for persons with disabilities. */
  wageCeilingDisabled: 25_000,
  employeeRate: 0.0075,
  employerRate: 0.0325,
} as const;

export interface EsiResult {
  applicable: boolean;
  ceiling: number;
  employee: number;
  employer: number;
}

/**
 * Steady-state ESI for a full year at a constant wage. A calculator cannot model the
 * contribution-period rule (an employee who crosses the ceiling mid-period stays covered until
 * April or October), so the UI explains that separately.
 */
export function computeEsi(monthlyWages: number, disabled = false): EsiResult {
  const wages = Math.max(0, monthlyWages);
  const ceiling = disabled ? ESI.wageCeilingDisabled : ESI.wageCeiling;
  const applicable = wages > 0 && wages <= ceiling;
  return {
    applicable,
    ceiling,
    employee: applicable ? wages * ESI.employeeRate : 0,
    employer: applicable ? wages * ESI.employerRate : 0,
  };
}
