/**
 * Top-level calculation: CTC in, both tax regimes out.
 *
 * Everything here is a pure function of the input, so the same code runs in the browser, in tests
 * and in the PDF/Excel exports.
 */

import {
  applyCap,
  DEDUCTION_CAPS,
  EMPLOYER_CONTRIBUTION_PERQUISITE_LIMIT,
  employerNpsDeductionRate,
  type CappedDeduction,
  type DeductionInputs,
} from './deductions';
import { computeHraExemption, type HraExemptionResult } from './hra';
import {
  computeIncomeTax,
  standardDeduction,
  type IncomeTaxResult,
  type TaxpayerProfile,
} from './income-tax';
import { estimateGratuity, type EmploymentType, type GratuityEstimate } from './gratuity';
import { computeProfessionalTax, type PtCategory, type PtResult } from './professional-tax';
import { type PfMode } from './provident-fund';
import { resolveStructure, type ResolvedStructure } from './structure';
import type { Regime } from './rates';

/** A component the user can express either as a percentage of some base or as a rupee amount. */
export interface ComponentValue {
  unit: 'percent' | 'rupees';
  value: number;
}

export interface CalculatorInput {
  /** Annual cost to company. */
  ctc: number;
  /** Basic + DA, as a percent of CTC or a rupee amount per year. */
  basic: ComponentValue;
  /** HRA, as a percent of basic or a rupee amount per year. */
  hra: ComponentValue;
  /** Leave travel allowance, percent of basic or rupees per year. */
  lta: ComponentValue;
  /** Variable pay / performance bonus, percent of CTC or rupees per year. */
  variable: ComponentValue;
  /** Employer NPS contribution, percent of basic or rupees per year. */
  employerNps: ComponentValue;
  /** Special allowance. 'balance' makes it absorb the remaining CTC. */
  specialAllowance: ComponentValue | 'balance';

  pfMode: PfMode;
  employerPfInCtc: boolean;
  employerEsiInCtc: boolean;
  gratuityInCtc: boolean;
  /** Opt into the statute's literal reading, where general allowances are wages in full. */
  specialAllowanceAsWages: boolean;

  age: number;
  resident: boolean;
  /** 'government' means Central or State Government only; PSUs count as 'other'. */
  employerType: 'government' | 'other';
  employmentType: EmploymentType;
  /** Service length used for the gratuity projection, in years. */
  yearsOfService: number;
  /** Person with a disability: raises the ESI wage ceiling to Rs 25,000. */
  disabled: boolean;

  stateCode: string;
  city: string;
  monthlyRent: number;
  ptCategory: PtCategory;
  /** Overrides the calculated professional tax when the state's slabs are not verified. */
  ptOverrideMonthly: number | null;

  deductions: DeductionInputs;
}

export interface RegimeBreakdown {
  regime: Regime;
  /** Salary chargeable to tax, before exemptions and deductions. */
  grossSalary: number;
  hraExemption: HraExemptionResult | null;
  standardDeduction: number;
  professionalTaxDeduction: number;
  employerNpsDeduction: number;
  sec80C: CappedDeduction | null;
  nps80CCD1B: CappedDeduction | null;
  healthInsurance: CappedDeduction | null;
  selfOccupiedInterest: CappedDeduction | null;
  /** Employer PF above the Rs 7.5 lakh aggregate limit, taxed as a perquisite. */
  employerContributionPerquisite: number;
  totalExemptionsAndDeductions: number;
  taxableIncome: number;
  tax: IncomeTaxResult;
  /** Annual pay actually received: fixed + variable, less employee PF/ESI, PT and tax. */
  annualTakeHome: number;
  /** A typical month's in-hand, excluding variable pay and excluding February's PT difference. */
  monthlyTakeHome: number;
}

export interface CalculationResult {
  input: CalculatorInput;
  structure: ResolvedStructure;
  professionalTax: PtResult;
  gratuityProjection: GratuityEstimate;
  regimes: Record<Regime, RegimeBreakdown>;
  /** The regime with the lower total tax. */
  better: Regime;
  /** Annual tax saved by choosing `better` over the other regime. */
  savingByChoosingBetter: number;
  /** Blocking problems (e.g. components exceed CTC). Results are not meaningful while non-empty. */
  errors: string[];
  /** Things the user should know but which do not invalidate the result. */
  notices: string[];
}

const resolve = (v: ComponentValue, base: number): number =>
  v.unit === 'percent' ? (base * v.value) / 100 : v.value;

export function calculate(input: CalculatorInput): CalculationResult {
  const errors: string[] = [];
  const notices: string[] = [];

  const ctc = Math.max(0, input.ctc);
  const basicAnnual = Math.max(0, resolve(input.basic, ctc));
  const hraAnnual = Math.max(0, resolve(input.hra, basicAnnual));
  const ltaAnnual = Math.max(0, resolve(input.lta, basicAnnual));
  const variableAnnual = Math.max(0, resolve(input.variable, ctc));
  const employerNpsAnnual = Math.max(0, resolve(input.employerNps, basicAnnual));

  const structure = resolveStructure({
    ctcAnnual: ctc,
    basicAnnual,
    hraAnnual,
    ltaAnnual,
    variableAnnual,
    employerNpsAnnual,
    specialAllowanceAnnual:
      input.specialAllowance === 'balance'
        ? 'balance'
        : Math.max(0, resolve(input.specialAllowance, ctc)),
    pfMode: input.pfMode,
    employerPfInCtc: input.employerPfInCtc,
    employerEsiInCtc: input.employerEsiInCtc,
    gratuityInCtc: input.gratuityInCtc,
    specialAllowanceAsWages: input.specialAllowanceAsWages,
    disabled: input.disabled,
  });

  if (structure.annual.special < -1) {
    errors.push(
      'The components you entered add up to more than your CTC. Reduce one of them, or let special allowance absorb the balance.',
    );
  } else if (Math.abs(structure.unallocated) > 1) {
    errors.push(
      `The components add up to ${formatShort(structure.annual.ctcComponents)}, which does not match your CTC of ${formatShort(ctc)}. ${structure.unallocated > 0 ? 'Assign the remaining' : 'Remove the excess'} ${formatShort(Math.abs(structure.unallocated))}.`,
    );
  }
  if (!structure.converged) {
    notices.push(
      'Your salary sits exactly on the ESI wage ceiling, where a small change in structure flips ESI on or off. Treat the ESI line as approximate.',
    );
  }

  // Professional tax. The threshold is tested on monthly gross, not on Basic.
  const ptCalculated = computeProfessionalTax(input.stateCode, {
    monthlyGross: structure.annual.grossFixed / 12,
    annualBonus: variableAnnual,
    age: input.age,
    category: input.ptCategory,
    // Punjab charges its development tax only to income-tax payers. The basic exemption limit is
    // the lowest threshold at which anyone becomes liable, so it is the safest test to apply.
    liableToIncomeTax: structure.annual.grossFixed + variableAnnual > 2_50_000,
  });
  const professionalTax: PtResult =
    input.ptOverrideMonthly !== null && input.ptOverrideMonthly >= 0
      ? {
          status: 'calculated',
          monthly: Array.from({ length: 12 }, () => input.ptOverrideMonthly as number),
          annual: (input.ptOverrideMonthly as number) * 12,
          label: ptCalculated.label,
          note: 'Using the monthly amount you entered.',
        }
      : ptCalculated;

  if (professionalTax.status === 'unverified' && input.ptOverrideMonthly === null) {
    notices.push(professionalTax.note);
  }
  if (professionalTax.caveat && input.ptOverrideMonthly === null) {
    notices.push(professionalTax.caveat);
  }
  if (structure.wages.addBack > 0) {
    notices.push(
      'Allowances make up more than half your pay, so the excess is counted as wages for PF, gratuity and ESI under the Labour Codes, even though it is still paid to you as an allowance.',
    );
  }
  if (structure.esi.applicable && structure.annual.grossFixed / 12 > structure.esi.ceiling) {
    notices.push(
      `ESI applies even though your gross pay is above ${formatShort(structure.esi.ceiling)} a month, because since November 2025 the ceiling is tested on Labour Code wages rather than gross pay. Check with your employer.`,
    );
  }

  const profile: TaxpayerProfile = { age: input.age, resident: input.resident };
  const gratuityProjection = estimateGratuity(
    structure.wages.wages,
    input.yearsOfService,
    input.employmentType,
  );

  const regimes = {
    new: buildRegime('new', input, structure, professionalTax.annual, profile),
    old: buildRegime('old', input, structure, professionalTax.annual, profile),
  };
  const better: Regime = regimes.new.tax.totalTax <= regimes.old.tax.totalTax ? 'new' : 'old';
  const savingByChoosingBetter = Math.abs(regimes.new.tax.totalTax - regimes.old.tax.totalTax);

  return {
    input,
    structure,
    professionalTax,
    gratuityProjection,
    regimes,
    better,
    savingByChoosingBetter,
    errors,
    notices,
  };
}

function buildRegime(
  regime: Regime,
  input: CalculatorInput,
  structure: ResolvedStructure,
  professionalTaxAnnual: number,
  profile: TaxpayerProfile,
): RegimeBreakdown {
  const a = structure.annual;
  const isOld = regime === 'old';

  // Employer NPS is part of salary and then deducted under s.124. Employer PF is otherwise exempt,
  // but the aggregate of employer PF + NPS above Rs 7.5 lakh is a perquisite (s.17(1)(h)). Only the
  // part attributable to PF is added here, because the NPS part is already inside gross salary.
  const aggregateExcess = Math.max(
    0,
    a.employerPf + a.employerNps - EMPLOYER_CONTRIBUTION_PERQUISITE_LIMIT,
  );
  const employerContributionPerquisite = Math.min(aggregateExcess, a.employerPf);

  const grossSalary = a.grossFixed + a.variable + a.employerNps + employerContributionPerquisite;

  const hraExemption =
    isOld && a.hra > 0 && input.monthlyRent > 0
      ? computeHraExemption(a.hra, input.monthlyRent * 12, a.basic, input.city)
      : null;

  const stdDeduction = standardDeduction(regime, grossSalary);
  const npsRate = employerNpsDeductionRate(regime, input.employerType);
  const employerNpsDeduction = Math.min(a.employerNps, npsRate * a.basic);

  // Employee PF counts toward the s.123 (80C) limit alongside the user's other investments.
  const employeePfAnnual = structure.pf.employee * 12;
  const sec80C = isOld
    ? applyCap(input.deductions.sec80C + employeePfAnnual, DEDUCTION_CAPS.sec80C)
    : null;
  const nps80CCD1B = isOld
    ? applyCap(input.deductions.nps80CCD1B, DEDUCTION_CAPS.nps80CCD1B)
    : null;
  const healthInsurance = isOld
    ? applyCap(
        input.deductions.healthInsurance,
        (input.age >= 60
          ? DEDUCTION_CAPS.healthInsuranceSelfSenior
          : DEDUCTION_CAPS.healthInsuranceSelf) + DEDUCTION_CAPS.healthInsuranceParents,
      )
    : null;
  const selfOccupiedInterest = isOld
    ? applyCap(input.deductions.selfOccupiedInterest, DEDUCTION_CAPS.selfOccupiedInterest)
    : null;

  const professionalTaxDeduction = isOld ? professionalTaxAnnual : 0;

  const totalExemptionsAndDeductions =
    (hraExemption?.exemption ?? 0) +
    stdDeduction +
    professionalTaxDeduction +
    employerNpsDeduction +
    (sec80C?.allowed ?? 0) +
    (nps80CCD1B?.allowed ?? 0) +
    (healthInsurance?.allowed ?? 0) +
    (selfOccupiedInterest?.allowed ?? 0);

  const taxableIncome = Math.max(0, grossSalary - totalExemptionsAndDeductions);
  const tax = computeIncomeTax(regime, taxableIncome, profile);

  const annualTakeHome =
    a.grossFixed +
    a.variable -
    employeePfAnnual -
    structure.esi.employee * 12 -
    professionalTaxAnnual -
    tax.totalTax;

  return {
    regime,
    grossSalary,
    hraExemption,
    standardDeduction: stdDeduction,
    professionalTaxDeduction,
    employerNpsDeduction,
    sec80C,
    nps80CCD1B,
    healthInsurance,
    selfOccupiedInterest,
    employerContributionPerquisite,
    totalExemptionsAndDeductions,
    taxableIncome,
    tax,
    annualTakeHome,
    monthlyTakeHome: (annualTakeHome - a.variable) / 12,
  };
}

function formatShort(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}
