/**
 * Professional tax (tax on employment, Constitution Art. 276(2), capped at Rs 2,500/year).
 *
 * Only states whose current slab schedule was verified against the state Act or the state
 * commercial-tax department are implemented with slabs. Every other levying state returns
 * status 'unverified' so the UI can show Rs 0 with a warning and let the user enter their
 * payslip figure, instead of this module guessing.
 *
 * Deductibility for income tax: old regime only. Income-tax Act 2025 s.202(2)(a)(iv) denies the
 * s.19(1) Table Sl.1 deduction under the new regime.
 */

/** Months in financial-year order. February is index 10. */
export const FY_MONTHS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const;
const FEBRUARY = 10;

/** Maharashtra's Act has separate "men" and "women" schedules and no other category. */
export type PtCategory = 'men' | 'women';

export interface PtInput {
  /** Regular monthly gross: basic, DA, allowances, perquisites. Excludes bonus and gratuity. */
  monthlyGross: number;
  /** Annual bonus / variable pay. Some states count it as salary, spread across the year. */
  annualBonus: number;
  age: number;
  category: PtCategory;
}

export type PtStatus =
  /** Slabs verified and applied. */
  | 'calculated'
  /** State levies PT but this person is exempt (e.g. by age). */
  | 'exempt'
  /** State or UT does not levy PT on salaried employees. */
  | 'not-levied'
  /** State levies PT but its schedule is not verified here. */
  | 'unverified';

export interface PtResult {
  status: PtStatus;
  /** Twelve amounts, April to March. All zero unless status is 'calculated'. */
  monthly: number[];
  annual: number;
  /** Plain-language explanation for the UI. */
  note: string;
}

interface VerifiedSchedule {
  /** Monthly deduction for the given month, from the salary figure the state tests against. */
  monthly: (salary: number, monthIndex: number, input: PtInput) => number;
  /** How the state defines the salary compared with the slabs. */
  salaryBasis: (input: PtInput) => number;
  exemptAge: number;
  source: string;
}

const withFebruary = (normal: number, february: number) => (monthIndex: number) =>
  monthIndex === FEBRUARY ? february : normal;

const SCHEDULES: Record<string, VerifiedSchedule> = {
  MH: {
    // Maharashtra State Tax on Professions, Trades, Callings and Employments Act 1975,
    // Schedule I Entry 1 as amended by Mah. Act XIX of 2023 (women's threshold Rs 25,000 from 1 Apr 2023).
    // s.2(h): salary includes DA and perquisites but EXCLUDES bonus of any kind and gratuity.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary, m, input) => {
      if (input.category === 'women') return salary > 25_000 ? withFebruary(200, 300)(m) : 0;
      if (salary <= 7_500) return 0;
      if (salary <= 10_000) return 175; // No February adjustment in this slab.
      return withFebruary(200, 300)(m);
    },
    exemptAge: 65, // s.27A(f)
    source: 'Maharashtra PT Act 1975, Schedule I Entry 1 (amended 2023)',
  },
  KA: {
    // Karnataka Tax on Professions, Trades, Callings and Employments Act 1976, Schedule Sl. 1:
    // threshold Rs 25,000 from Karnataka Act 14 of 2023; Rs 300 in February from Karnataka Act 33 of 2025.
    // s.2(j): salary includes bonus by whatever name called, spread over the months it relates to.
    salaryBasis: (i) => i.monthlyGross + i.annualBonus / 12,
    monthly: (salary, m) => (salary >= 25_000 ? withFebruary(200, 300)(m) : 0),
    exemptAge: 60, // s.3 proviso
    source: 'Karnataka PT Act 1976, Schedule Sl. 1 (amended 2023 and 2025)',
  },
};

export interface StateInfo {
  code: string;
  name: string;
  pt: 'verified' | 'not-levied' | 'unverified';
}

/** States and UTs offered in the calculator. */
export const STATES: readonly StateInfo[] = [
  { code: 'KA', name: 'Karnataka', pt: 'verified' },
  { code: 'MH', name: 'Maharashtra', pt: 'verified' },
];

const byCode = new Map(STATES.map((s) => [s.code, s]));

export function computeProfessionalTax(stateCode: string, input: PtInput): PtResult {
  const zero = Array.from({ length: 12 }, () => 0);
  const state = byCode.get(stateCode);
  const schedule = SCHEDULES[stateCode];

  if (!state || state.pt === 'unverified' || !schedule) {
    return {
      status: 'unverified',
      monthly: zero,
      annual: 0,
      note: `${state?.name ?? 'This state'} levies professional tax, but its slabs are not verified here. Take-home is shown before PT. Enter the amount from your payslip for an exact figure (it cannot exceed Rs 2,500 a year).`,
    };
  }
  if (state.pt === 'not-levied') {
    return {
      status: 'not-levied',
      monthly: zero,
      annual: 0,
      note: `${state.name} does not levy professional tax on salaried employees.`,
    };
  }
  if (input.age >= schedule.exemptAge) {
    return {
      status: 'exempt',
      monthly: zero,
      annual: 0,
      note: `People aged ${schedule.exemptAge} or over are exempt from professional tax in ${state.name}.`,
    };
  }

  const salary = schedule.salaryBasis(input);
  const monthly = FY_MONTHS.map((_, m) => schedule.monthly(salary, m, input));
  const annual = monthly.reduce((a, b) => a + b, 0);
  return {
    status: 'calculated',
    monthly,
    annual,
    note:
      annual === 0
        ? `Your salary is below the ${state.name} professional tax threshold.`
        : schedule.source,
  };
}
