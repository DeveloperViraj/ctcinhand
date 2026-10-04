/**
 * The old-versus-new break-even: how much more someone would have to claim in old-regime
 * deductions and exemptions before the old regime costs less tax than the new one.
 *
 * "More" means on top of what the old regime already gives every salaried person in this
 * calculation: the Rs 50,000 standard deduction, professional tax, the employee PF that counts
 * towards section 123 (the old 80C), and an HRA exemption if the input carries rent.
 *
 * Old-regime tax only ever rises with taxable income (marginal relief included), so a binary search
 * finds the highest taxable income at which the old regime is still strictly cheaper; the gap to
 * the actual taxable income is the answer.
 */

import { calculate, type CalculatorInput } from './calculate';
import { DEDUCTION_CAPS } from './deductions';
import { computeIncomeTax } from './income-tax';

export type BreakEvenReason = 'needs-deductions' | 'already-cheaper' | 'new-is-tax-free';

export interface BreakEven {
  reason: BreakEvenReason;
  /** Extra deductions or exemptions needed, in whole rupees. Null when the new regime is tax-free. */
  extraNeeded: number | null;
  /**
   * The most the capped heads can add on top of PF without any HRA: the rest of section 123,
   * 80CCD(1B), health insurance for self and family, and self-occupied home loan interest.
   */
  cappedHeadroom: number;
  /** Whether extraNeeded fits inside cappedHeadroom, i.e. is possible without an HRA exemption. */
  reachableWithoutHra: boolean;
  newTax: number;
  oldTax: number;
}

export function breakEven(input: CalculatorInput): BreakEven {
  const result = calculate({
    ...input,
    deductions: { sec80C: 0, nps80CCD1B: 0, healthInsurance: 0, selfOccupiedInterest: 0 },
  });
  const newTax = result.regimes.new.tax.totalTax;
  const old = result.regimes.old;
  const profile = { age: input.age, resident: input.resident };

  const employeePf = result.structure.pf.employee * 12;
  const cappedHeadroom =
    Math.max(0, DEDUCTION_CAPS.sec80C - employeePf) +
    DEDUCTION_CAPS.nps80CCD1B +
    (input.age >= 60
      ? DEDUCTION_CAPS.healthInsuranceSelfSenior
      : DEDUCTION_CAPS.healthInsuranceSelf) +
    DEDUCTION_CAPS.selfOccupiedInterest;

  const summary = { cappedHeadroom, newTax, oldTax: old.tax.totalTax };

  if (old.tax.totalTax < newTax) {
    return { reason: 'already-cheaper', extraNeeded: 0, reachableWithoutHra: true, ...summary };
  }
  if (newTax <= 0) {
    return { reason: 'new-is-tax-free', extraNeeded: null, reachableWithoutHra: false, ...summary };
  }

  // Highest whole-rupee taxable income at which the old regime is strictly cheaper.
  const cheaper = (taxable: number) => computeIncomeTax('old', taxable, profile).totalTax < newTax;
  let low = 0;
  let high = Math.ceil(old.taxableIncome);
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (cheaper(mid)) low = mid;
    else high = mid;
  }
  const extraNeeded = Math.ceil(old.taxableIncome) - low;
  return {
    reason: 'needs-deductions',
    extraNeeded,
    reachableWithoutHra: extraNeeded <= cappedHeadroom,
    ...summary,
  };
}

export interface RentBreakEven {
  /** Lowest monthly rent (rounded up to Rs 500) at which the old regime wins. Null: no rent does. */
  monthlyRent: number | null;
  /** The deductions assumed alongside the rent. */
  assumed: { sec80C: number; nps80CCD1B: number; healthInsurance: number };
}

/**
 * The rent at which the old regime starts to win, for someone who also fills the usual capped
 * heads (section 123 on top of PF, 80CCD(1B), health insurance for self and family) but has no
 * home loan. Uses the input's city, so a metro gets the 50% HRA limit.
 *
 * Rent helps only until the exemption hits its first limit (the HRA received, or 50%/40% of
 * Basic), so the search stops there.
 */
export function rentToBreakEven(input: CalculatorInput): RentBreakEven {
  const base = calculate({ ...input, monthlyRent: 0 });
  const employeePf = base.structure.pf.employee * 12;
  const assumed = {
    sec80C: Math.max(0, DEDUCTION_CAPS.sec80C - employeePf),
    nps80CCD1B: DEDUCTION_CAPS.nps80CCD1B,
    healthInsurance:
      input.age >= 60
        ? DEDUCTION_CAPS.healthInsuranceSelfSenior
        : DEDUCTION_CAPS.healthInsuranceSelf,
  };
  const oldWins = (monthlyRent: number) => {
    const r = calculate({
      ...input,
      monthlyRent,
      deductions: { ...assumed, selfOccupiedInterest: 0 },
    });
    return r.regimes.old.tax.totalTax < r.regimes.new.tax.totalTax;
  };

  // Past HRA received plus 10% of Basic, more rent adds nothing to the exemption.
  const a = base.structure.annual;
  const ceiling = Math.ceil((a.hra + a.basic * 0.1) / 12);
  if (oldWins(0)) return { monthlyRent: 0, assumed };
  if (!oldWins(ceiling)) return { monthlyRent: null, assumed };

  let low = 0;
  let high = ceiling;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (oldWins(mid)) high = mid;
    else low = mid;
  }
  return { monthlyRent: Math.ceil(high / 500) * 500, assumed };
}
