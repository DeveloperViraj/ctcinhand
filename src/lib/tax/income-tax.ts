import {
  CESS_RATE,
  NEW_REGIME_SLABS,
  OLD_REGIME_SLABS,
  REBATE,
  STANDARD_DEDUCTION,
  SURCHARGE,
  type Regime,
  type Slab,
} from './rates';

export interface TaxpayerProfile {
  /** Age in completed years at any time during the tax year. Only changes old-regime slabs. */
  age: number;
  /** Rebate and the higher old-regime exemption limits apply to residents only. */
  resident: boolean;
}

export const DEFAULT_PROFILE: TaxpayerProfile = { age: 30, resident: true };

export interface SlabLine {
  from: number;
  to: number;
  rate: number;
  /** Portion of income that falls in this slab. */
  amount: number;
  tax: number;
}

export interface IncomeTaxResult {
  regime: Regime;
  taxableIncome: number;
  slabs: SlabLine[];
  /** Tax at slab rates before any rebate. */
  slabTax: number;
  /** s.156 rebate, including the new-regime marginal relief above Rs 12 lakh. */
  rebate: number;
  /** True when the rebate was the s.156(2)(b) taper rather than the full rebate. */
  rebateIsMarginalRelief: boolean;
  taxAfterRebate: number;
  surchargeRate: number;
  /** Surcharge actually payable, after marginal relief. */
  surcharge: number;
  /** Amount by which the threshold marginal relief reduced tax + surcharge. */
  surchargeMarginalRelief: number;
  cess: number;
  /** Income-tax + surcharge + cess. Unrounded; round only for display. */
  totalTax: number;
}

export function slabsFor(regime: Regime, profile: TaxpayerProfile): readonly Slab[] {
  if (regime === 'new') return NEW_REGIME_SLABS;
  // Senior and super-senior exemption limits are for resident individuals only.
  if (!profile.resident || profile.age < 60) return OLD_REGIME_SLABS.below60;
  return profile.age >= 80 ? OLD_REGIME_SLABS.superSenior : OLD_REGIME_SLABS.senior;
}

export function slabBreakdown(income: number, slabs: readonly Slab[]): SlabLine[] {
  const lines: SlabLine[] = [];
  let lower = 0;
  for (const { upTo, rate } of slabs) {
    if (income <= lower) break;
    const amount = Math.min(income, upTo) - lower;
    lines.push({ from: lower, to: upTo, rate, amount, tax: amount * rate });
    lower = upTo;
  }
  return lines;
}

export function slabTax(income: number, slabs: readonly Slab[]): number {
  return slabBreakdown(income, slabs).reduce((sum, line) => sum + line.tax, 0);
}

/** s.19(1) Table Sl. 2: the flat deduction, but never more than the salary itself. */
export function standardDeduction(regime: Regime, grossSalary: number): number {
  return Math.max(0, Math.min(STANDARD_DEDUCTION[regime], grossSalary));
}

function rebateFor(
  regime: Regime,
  income: number,
  tax: number,
  profile: TaxpayerProfile,
): { rebate: number; isMarginalRelief: boolean } {
  if (!profile.resident) return { rebate: 0, isMarginalRelief: false };
  const rule = REBATE[regime];
  if (income <= rule.incomeLimit) {
    return { rebate: Math.min(tax, rule.maxRebate), isMarginalRelief: false };
  }
  if (rule.marginalRelief) {
    const excess = income - rule.incomeLimit;
    if (tax > excess) return { rebate: tax - excess, isMarginalRelief: true };
  }
  return { rebate: 0, isMarginalRelief: false };
}

interface BeforeCess {
  slabTax: number;
  rebate: number;
  rebateIsMarginalRelief: boolean;
  taxAfterRebate: number;
  surchargeRate: number;
  surcharge: number;
  surchargeMarginalRelief: number;
}

function taxAndSurcharge(regime: Regime, income: number, profile: TaxpayerProfile): BeforeCess {
  const base = slabTax(income, slabsFor(regime, profile));
  const { rebate, isMarginalRelief } = rebateFor(regime, income, base, profile);
  const taxAfterRebate = base - rebate;

  const tier = SURCHARGE[regime].findLast((t) => income > t.above);
  if (!tier) {
    return {
      slabTax: base,
      rebate,
      rebateIsMarginalRelief: isMarginalRelief,
      taxAfterRebate,
      surchargeRate: 0,
      surcharge: 0,
      surchargeMarginalRelief: 0,
    };
  }

  // Marginal relief (Finance Act 2026 Part I-B Para F "Wn = Un + Vn"; s.3(5) "Tn = Rn + Sn"):
  // tax + surcharge may not exceed the tax + surcharge payable at the threshold itself
  // plus the income by which the threshold is exceeded. Computing the threshold amount
  // recursively keeps this correct for every age-dependent slab set.
  const uncapped = taxAfterRebate * (1 + tier.rate);
  const atThreshold = taxAndSurcharge(regime, tier.above, profile);
  const cap = atThreshold.taxAfterRebate + atThreshold.surcharge + (income - tier.above);
  const capped = Math.min(uncapped, cap);

  return {
    slabTax: base,
    rebate,
    rebateIsMarginalRelief: isMarginalRelief,
    taxAfterRebate,
    surchargeRate: tier.rate,
    surcharge: capped - taxAfterRebate,
    surchargeMarginalRelief: uncapped - capped,
  };
}

export function computeIncomeTax(
  regime: Regime,
  taxableIncome: number,
  profile: TaxpayerProfile = DEFAULT_PROFILE,
): IncomeTaxResult {
  const income = Math.max(0, taxableIncome);
  const parts = taxAndSurcharge(regime, income, profile);
  // Cess is charged on income-tax + surcharge after both the rebate and the surcharge relief.
  const cess = (parts.taxAfterRebate + parts.surcharge) * CESS_RATE;
  return {
    regime,
    taxableIncome: income,
    slabs: slabBreakdown(income, slabsFor(regime, profile)),
    ...parts,
    cess,
    totalTax: parts.taxAfterRebate + parts.surcharge + cess,
  };
}
