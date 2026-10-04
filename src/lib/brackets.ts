/**
 * The "N LPA in-hand salary" pages: which salaries get a page, and everything computed for each.
 *
 * Every figure on those pages comes from the calculator engine at build time, so a page can never
 * drift from the calculator. What earns each page its place is the part no template can fake: the
 * state-by-state table, the exact old/new break-even, the rent at which HRA tips it, and what PF on
 * full Basic would cost.
 */

import { breakEven, rentToBreakEven, type BreakEven, type RentBreakEven } from './tax/break-even';
import { calculate, type CalculationResult, type CalculatorInput } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { computeIncomeTax } from './tax/income-tax';
import { STATES } from './tax/professional-tax';

/** Salaries with a page, in lakh a year. Dense where people actually search, sparse above 30. */
export const LPA_BRACKETS = [
  3, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 35, 40, 45, 50, 60, 75, 100,
] as const;

export type Lpa = (typeof LPA_BRACKETS)[number];

export const bracketSlug = (lpa: number) => `${String(lpa).replace('.', '-')}-lpa`;
export const bracketPath = (lpa: number) => `/in-hand-salary/${bracketSlug(lpa)}`;
export const bracketLabel = (lpa: number) => `${lpa} LPA`;
export const lakhs = (lpa: number) => Math.round(lpa * 1_00_000);

/** The calculator's quick-mode defaults at this CTC. */
export const bracketInput = (lpa: number, overrides: Partial<CalculatorInput> = {}) => ({
  ...DEFAULT_INPUT,
  ...overrides,
  ctc: lakhs(lpa),
});

/** One city per state for the comparison table; the capital or the main salaried hub. */
const STATE_ROWS: { code: string; city: string }[] = [
  { code: 'KA', city: 'Bengaluru' },
  { code: 'MH', city: 'Mumbai' },
  { code: 'TS', city: 'Hyderabad' },
  { code: 'WB', city: 'Kolkata' },
  { code: 'DL', city: 'Delhi' },
  { code: 'HR', city: 'Other' },
  { code: 'UP', city: 'Other' },
  { code: 'AP', city: 'Other' },
  { code: 'PB', city: 'Other' },
];

export interface StateRow {
  code: string;
  name: string;
  professionalTax: number;
  monthly: number;
  better: 'new' | 'old';
}

export interface BracketData {
  lpa: number;
  result: CalculationResult;
  states: StateRow[];
  breakEven: BreakEven;
  /** Rent at which the old regime wins (Bengaluru, a 50% HRA city), usual capped deductions filled. */
  metroRent: RentBreakEven;
  /**
   * Tax, cess included, per rupee of the next Rs 100 of taxable income under the cheaper regime.
   * A small step, so a salary near the edge of a band does not average across it.
   */
  marginalRate: number;
  /** Monthly in-hand if the employer contributes PF on full Basic rather than the ceiling. */
  fullPf: { monthly: number; employeePfYear: number };
  /** Share of CTC paid as income tax under the cheaper regime. */
  effectiveRate: number;
}

export function bracketData(lpa: number): BracketData {
  const input = bracketInput(lpa);
  const result = calculate(input);
  const names = new Map(STATES.map((s) => [s.code, s.name]));

  const states = STATE_ROWS.map(({ code, city }) => {
    const r = calculate({ ...input, stateCode: code, city });
    return {
      code,
      name: names.get(code) ?? code,
      professionalTax: r.professionalTax.annual,
      monthly: r.regimes[r.better].monthlyTakeHome,
      better: r.better,
    };
  });

  const full = calculate({ ...input, pfMode: 'actual' });
  const best = result.regimes[result.better];
  const profile = { age: input.age, resident: input.resident };
  const nextHundred =
    computeIncomeTax(result.better, best.taxableIncome + 100, profile).totalTax -
    computeIncomeTax(result.better, best.taxableIncome, profile).totalTax;

  return {
    lpa,
    result,
    states,
    breakEven: breakEven(input),
    metroRent: rentToBreakEven(input),
    marginalRate: nextHundred / 100,
    fullPf: {
      monthly: full.regimes[full.better].monthlyTakeHome,
      employeePfYear: full.structure.pf.employee * 12,
    },
    effectiveRate: best.tax.totalTax / lakhs(lpa),
  };
}

/** Neighbouring pages, for the "nearby salaries" links. */
export function neighbours(lpa: number, each = 3): number[] {
  const list: readonly number[] = LPA_BRACKETS;
  const i = list.indexOf(lpa);
  return list.slice(Math.max(0, i - each), i).concat(list.slice(i + 1, i + 1 + each));
}
