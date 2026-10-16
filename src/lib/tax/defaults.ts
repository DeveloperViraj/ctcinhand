import type { CalculatorInput } from './calculate';
import { NO_DEDUCTIONS } from './deductions';

/**
 * Quick-mode defaults: a structure that satisfies the Labour Code wage test on its own (Basic at
 * half of CTC), PF capped at the statutory ceiling as most employers do, and gratuity and employer
 * PF counted inside CTC, which is the common Indian offer-letter convention.
 */
export const DEFAULT_INPUT: CalculatorInput = {
  ctc: 12_00_000,
  joiningBonus: 0,
  basic: { unit: 'percent', value: 50 },
  hra: { unit: 'percent', value: 50 },
  lta: { unit: 'percent', value: 0 },
  variable: { unit: 'percent', value: 0 },
  employerNps: { unit: 'percent', value: 0 },
  specialAllowance: 'balance',

  pfMode: 'ceiling',
  employerPfInCtc: true,
  employerEsiInCtc: true,
  gratuityInCtc: true,
  specialAllowanceAsWages: false,

  age: 30,
  resident: true,
  employerType: 'other',
  employmentType: 'permanent',
  yearsOfService: 5,
  disabled: false,

  stateCode: 'KA',
  city: 'Bengaluru',
  monthlyRent: 0,
  ptCategory: 'men',
  ptOverrideMonthly: null,

  deductions: { ...NO_DEDUCTIONS },
};
