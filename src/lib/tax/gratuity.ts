/**
 * Gratuity under the Code on Social Security 2020, s.53 (in force 21 November 2025).
 *
 * Rate: 15 days' wages for every completed year of service, or part of a year above six months,
 * on the wages last drawn (Labour Code wages, including the 50% add-back). For monthly-paid
 * employees 15 days' wages is conventionally monthly wages x 15 / 26.
 *
 * Eligibility: 5 years' continuous service, except on death or disablement, and except for
 * fixed-term employees engaged directly by the employer, who qualify after 1 year and are paid pro
 * rata (IR Code s.2(o)(c); CoSS s.53; MoLE FAQ 16.03.2026 Q10, Q14). Contract labour engaged
 * through a contractor still needs 5 years (Q16).
 *
 * Maximum: Rs 20 lakh as currently notified (MoLE FAQ 30.12.2025 Q12).
 */

export const GRATUITY = {
  daysPerYear: 15,
  workingDaysPerMonth: 26,
  maximum: 20_00_000,
  eligibilityYears: { permanent: 5, fixedTerm: 1 },
} as const;

export type EmploymentType = 'permanent' | 'fixed-term';

/** Annual provision an employer typically builds into CTC: 15/26 of one month's wages. */
export function annualGratuityProvision(monthlyWages: number): number {
  return (Math.max(0, monthlyWages) * GRATUITY.daysPerYear) / GRATUITY.workingDaysPerMonth;
}

export interface GratuityEstimate {
  eligible: boolean;
  /** Years counted for the formula after rounding. */
  countedYears: number;
  amount: number;
  capped: boolean;
  minimumYears: number;
}

/**
 * Estimated gratuity on leaving after `yearsOfService` (decimal years) at the given wage.
 * Permanent employees: completed years, with a part-year above six months counted as a full year.
 * Fixed-term employees: paid pro rata on actual service once they have completed one year.
 */
export function estimateGratuity(
  monthlyWages: number,
  yearsOfService: number,
  employment: EmploymentType,
): GratuityEstimate {
  const years = Math.max(0, yearsOfService);
  const minimumYears =
    employment === 'fixed-term'
      ? GRATUITY.eligibilityYears.fixedTerm
      : GRATUITY.eligibilityYears.permanent;

  let countedYears: number;
  if (employment === 'fixed-term') {
    countedYears = years;
  } else {
    const whole = Math.floor(years);
    countedYears = years - whole > 0.5 ? whole + 1 : whole;
  }

  const eligible = years >= minimumYears;
  const raw = eligible ? annualGratuityProvision(monthlyWages) * countedYears : 0;
  return {
    eligible,
    countedYears,
    amount: Math.min(raw, GRATUITY.maximum),
    capped: raw > GRATUITY.maximum,
    minimumYears,
  };
}
