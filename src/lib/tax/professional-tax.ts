/**
 * Professional tax (tax on employment, Constitution Art. 276(2), capped at Rs 2,500 a year).
 *
 * Amounts are computed month by month, April to March, because Indian schedules are not uniform
 * across the year: Maharashtra and Karnataka charge more in February, and West Bengal changes its
 * entire schedule mid-year on 1 October 2026.
 *
 * Only states whose current schedule was verified are calculated. Every other levying state returns
 * status 'unverified' so the UI can show Rs 0 with a warning and offer a manual override, rather
 * than this module inventing a number.
 *
 * Income tax treatment: deductible in the OLD regime only (Income-tax Act 2025 s.19(1) Table Sl. 1;
 * s.202(2)(a)(iv) denies it under the new regime).
 */

/** Months in financial-year order. February is index 10; October is index 6. */
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
const OCTOBER = 6;

/** Maharashtra's schedule has separate "men" and "women" entries and no other category. */
export type PtCategory = 'men' | 'women';

export interface PtInput {
  /** Regular monthly gross: basic, DA, allowances. Excludes bonus and gratuity. */
  monthlyGross: number;
  /** Annual bonus / variable pay. Karnataka counts it as salary, spread across the year. */
  annualBonus: number;
  age: number;
  category: PtCategory;
  /**
   * Whether the person is liable to income tax. Punjab's levy applies only to income-tax payers.
   * Everywhere else this is ignored.
   */
  liableToIncomeTax: boolean;
}

export type PtStatus = 'calculated' | 'exempt' | 'not-levied' | 'unverified';

export interface PtResult {
  status: PtStatus;
  /** Twelve amounts, April to March. All zero unless status is 'calculated'. */
  monthly: number[];
  annual: number;
  /** What this levy is called where it is not named "professional tax". */
  label: string;
  /** Plain-language explanation for the UI. */
  note: string;
  /** Shown when the figure rests on sources we could not confirm against a gazette. */
  caveat?: string;
}

interface Schedule {
  /** Deduction for the given month index, from the salary figure the state tests against. */
  monthly: (salary: number, monthIndex: number, input: PtInput) => number;
  /** How the state defines the salary it compares with the slabs. */
  salaryBasis: (input: PtInput) => number;
  /** Age at which the state exempts the employee. Only set where verified. */
  exemptAge?: number;
  label?: string;
  source: string;
  caveat?: string;
}

const febRate = (normal: number, february: number) => (monthIndex: number) =>
  monthIndex === FEBRUARY ? february : normal;

/** Picks the first band whose upper bound the salary does not exceed. */
const band = (bands: readonly (readonly [upTo: number, amount: number])[]) => (salary: number) =>
  bands.find(([upTo]) => salary <= upTo)?.[1] ?? 0;

const SCHEDULES: Record<string, Schedule> = {
  MH: {
    // Maharashtra PT Act 1975, Schedule I Entry 1, as amended by Mah. Act XIX of 2023.
    // s.2(h): salary includes DA and perquisites but EXCLUDES bonus of any kind and gratuity.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary, m, input) => {
      if (input.category === 'women') return salary > 25_000 ? febRate(200, 300)(m) : 0;
      if (salary <= 7_500) return 0;
      if (salary <= 10_000) return 175; // No February adjustment in this band.
      return febRate(200, 300)(m);
    },
    exemptAge: 65, // s.27A(f)
    source: 'Maharashtra PT Act 1975, Schedule I Entry 1 (amended 2023)',
  },
  KA: {
    // Karnataka PT Act 1976, Schedule Sl. 1: threshold Rs 25,000 (Karnataka Act 14 of 2023);
    // Rs 300 in February (Karnataka Act 33 of 2025). s.2(j): salary includes bonus, spread monthly.
    salaryBasis: (i) => i.monthlyGross + i.annualBonus / 12,
    monthly: (salary, m) => (salary >= 25_000 ? febRate(200, 300)(m) : 0),
    exemptAge: 60, // s.3 proviso
    source: 'Karnataka PT Act 1976, Schedule Sl. 1 (amended 2023 and 2025)',
  },
  TS: {
    // Telangana PT Act 1987, First Schedule (tgct.gov.in). No February variation.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) =>
      band([
        [15_000, 0],
        [20_000, 150],
        [Infinity, 200],
      ])(salary),
    source: 'Telangana PT Act 1987, First Schedule',
  },
  AP: {
    // Andhra Pradesh still runs the undivided-AP 1987 Act table, identical to Telangana's.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) =>
      band([
        [15_000, 0],
        [20_000, 150],
        [Infinity, 200],
      ])(salary),
    source: 'Andhra Pradesh PT Act 1987, First Schedule',
    caveat:
      'Andhra Pradesh publishes the same table as Telangana, but we could not load the state portal to confirm it directly.',
  },
  WB: {
    // West Bengal replaces its whole schedule from 1 October 2026, mid-way through this tax year:
    // April-September uses the old table, October-March the new one.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary, m) =>
      m < OCTOBER
        ? band([
            [10_000, 0],
            [15_000, 110],
            [25_000, 130],
            [40_000, 150],
            [Infinity, 200],
          ])(salary)
        : band([
            [20_000, 0],
            [30_000, 100],
            [50_000, 140],
            [1_00_000, 170],
            [Infinity, 208],
          ])(salary),
    source: 'West Bengal PT Act 1979, Schedule (revised with effect from 1 October 2026)',
    caveat:
      'West Bengal replaced its professional tax slabs from 1 October 2026, so April-September and October-March are charged differently. The new rates come from compliance advisories; we could not open a West Bengal gazette to confirm them.',
  },
  PB: {
    // Punjab State Development Tax Act 2018: a flat Rs 200/month deducted by the employer from
    // employees liable to income tax. Legally an Art. 276 employment tax despite the name.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (_salary, _m, input) => (input.liableToIncomeTax ? 200 : 0),
    label: 'Punjab State Development Tax',
    source: 'Punjab State Development Tax Act 2018 (Punjab Act 11 of 2018)',
    caveat:
      'Punjab charges this only to employees liable to income tax. We apply it above the basic exemption limit; the state has not published a readable clarification of the threshold under the Income-tax Act, 2025.',
  },
};

export interface StateInfo {
  code: string;
  name: string;
  pt: 'verified' | 'not-levied' | 'unverified';
}

/** Every state and union territory, so the dropdown is complete. */
export const STATES: readonly StateInfo[] = [
  { code: 'AN', name: 'Andaman & Nicobar Islands', pt: 'not-levied' },
  { code: 'AP', name: 'Andhra Pradesh', pt: 'verified' },
  { code: 'AR', name: 'Arunachal Pradesh', pt: 'not-levied' },
  { code: 'AS', name: 'Assam', pt: 'unverified' },
  { code: 'BR', name: 'Bihar', pt: 'unverified' },
  { code: 'CH', name: 'Chandigarh', pt: 'not-levied' },
  { code: 'CT', name: 'Chhattisgarh', pt: 'not-levied' },
  { code: 'DH', name: 'Dadra & Nagar Haveli and Daman & Diu', pt: 'not-levied' },
  { code: 'DL', name: 'Delhi', pt: 'not-levied' },
  { code: 'GA', name: 'Goa', pt: 'not-levied' },
  { code: 'GJ', name: 'Gujarat', pt: 'unverified' },
  { code: 'HR', name: 'Haryana', pt: 'not-levied' },
  { code: 'HP', name: 'Himachal Pradesh', pt: 'not-levied' },
  { code: 'JK', name: 'Jammu & Kashmir', pt: 'not-levied' },
  { code: 'JH', name: 'Jharkhand', pt: 'unverified' },
  { code: 'KA', name: 'Karnataka', pt: 'verified' },
  { code: 'KL', name: 'Kerala', pt: 'unverified' },
  { code: 'LA', name: 'Ladakh', pt: 'not-levied' },
  { code: 'LD', name: 'Lakshadweep', pt: 'not-levied' },
  { code: 'MP', name: 'Madhya Pradesh', pt: 'unverified' },
  { code: 'MH', name: 'Maharashtra', pt: 'verified' },
  { code: 'MN', name: 'Manipur', pt: 'unverified' },
  { code: 'ML', name: 'Meghalaya', pt: 'unverified' },
  { code: 'MZ', name: 'Mizoram', pt: 'unverified' },
  { code: 'NL', name: 'Nagaland', pt: 'unverified' },
  { code: 'OR', name: 'Odisha', pt: 'unverified' },
  { code: 'PY', name: 'Puducherry', pt: 'unverified' },
  { code: 'PB', name: 'Punjab', pt: 'verified' },
  { code: 'RJ', name: 'Rajasthan', pt: 'not-levied' },
  { code: 'SK', name: 'Sikkim', pt: 'unverified' },
  { code: 'TN', name: 'Tamil Nadu', pt: 'unverified' },
  { code: 'TS', name: 'Telangana', pt: 'verified' },
  { code: 'TR', name: 'Tripura', pt: 'unverified' },
  { code: 'UP', name: 'Uttar Pradesh', pt: 'not-levied' },
  { code: 'UK', name: 'Uttarakhand', pt: 'not-levied' },
  { code: 'WB', name: 'West Bengal', pt: 'verified' },
];

const byCode = new Map(STATES.map((s) => [s.code, s]));
const zeros = () => Array.from({ length: 12 }, () => 0);

export function computeProfessionalTax(stateCode: string, input: PtInput): PtResult {
  const state = byCode.get(stateCode);
  const schedule = SCHEDULES[stateCode];
  const label = schedule?.label ?? 'Professional tax';

  // Checked before the schedule lookup: states that levy nothing deliberately have no schedule.
  if (state?.pt === 'not-levied') {
    return {
      status: 'not-levied',
      monthly: zeros(),
      annual: 0,
      label,
      note: `${state.name} does not levy professional tax on salaried employees.`,
    };
  }
  if (!state || state.pt === 'unverified' || !schedule) {
    return {
      status: 'unverified',
      monthly: zeros(),
      annual: 0,
      label,
      note: `${state?.name ?? 'This state'} levies professional tax, but we have not verified its slabs, so take-home is shown before it. Enter the amount from your payslip for an exact figure (it can never exceed Rs 2,500 a year).`,
    };
  }
  if (schedule.exemptAge !== undefined && input.age >= schedule.exemptAge) {
    return {
      status: 'exempt',
      monthly: zeros(),
      annual: 0,
      label,
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
    label,
    note:
      annual === 0
        ? `Your salary is below the ${state.name} ${label.toLowerCase()} threshold.`
        : schedule.source,
    caveat: schedule.caveat,
  };
}
