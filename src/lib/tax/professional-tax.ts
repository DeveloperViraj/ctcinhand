/**
 * Professional tax (tax on employment, Constitution Art. 276(2), capped at Rs 2,500 a year).
 *
 * Amounts are computed month by month, April to March, because Indian schedules are not uniform
 * across the year: Maharashtra and Karnataka charge more in February, West Bengal changes its
 * entire schedule mid-year on 1 October 2026, Bihar takes the whole year's tax from September's
 * salary, Jharkhand collects quarterly, and Kerala and Chennai collect half-yearly.
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
const JUNE = 2;
const SEPTEMBER = 5;
const OCTOBER = 6;
const DECEMBER = 8;
const FEBRUARY = 10;
const MARCH = 11;

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
  /**
   * The city the person lives in. Used only where professional tax is set by the local body rather
   * than the state (Tamil Nadu), and only for cities whose rates we have verified.
   */
  city?: string;
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

/**
 * For states that charge a fixed amount a year but deduct it in instalments. The instalments land
 * in the given months, and any remainder that does not divide evenly goes into the last one.
 */
const spread = (annual: number, months: readonly number[]) => (monthIndex: number) => {
  const i = months.indexOf(monthIndex);
  if (i === -1) return 0;
  const each = Math.floor(annual / months.length);
  return i === months.length - 1 ? annual - each * (months.length - 1) : each;
};

/** Half-yearly schedules (Kerala, Chennai) charge each half-year's tax once in that half. */
const HALVES = [SEPTEMBER] as const;
const SECOND_HALF = [MARCH] as const;
const halfYearly = (charge: (halfYear: number) => number) => (halfYear: number, m: number) =>
  spread(charge(halfYear), HALVES)(m) + spread(charge(halfYear), SECOND_HALF)(m);

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
  GJ: {
    // Gujarat PT Act 1976, Schedule Entry 1, rates effective 1 April 2022 (Commercial Tax
    // Department rate schedule, updated 27 June 2024). No February variation.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) => (salary > 12_000 ? 200 : 0),
    source: 'Gujarat PT Act 1976, Schedule Entry 1 (rates from 1 April 2022)',
  },
  MP: {
    // Madhya Pradesh Vritti Kar Adhiniyam 1995, Schedule Entry 1. The slabs are on ANNUAL salary;
    // the schedule spreads the tax over the year with a slightly larger twelfth instalment.
    salaryBasis: (i) => i.monthlyGross * 12,
    monthly: (annual, m) => {
      if (annual <= 2_25_000) return 0;
      if (annual <= 3_00_000) return 125;
      if (annual <= 4_00_000) return m === MARCH ? 174 : 166;
      return m === MARCH ? 212 : 208;
    },
    source: 'Madhya Pradesh Vritti Kar Adhiniyam 1995, Schedule Entry 1',
    caveat:
      'Madhya Pradesh sets its slabs on annual salary. We use your regular salary for the year, without variable pay.',
  },
  AS: {
    // Assam PT Act 1947, Schedule Entry 1 as substituted by notification eCF No. 169350/124 of
    // 1 April 2025 (Assam Gazette Extraordinary No. 139, 2 April 2025).
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary, _m, input) => {
      // Notification FTX.76/2006/2: people above 60 are exempt if gross income is at most Rs 5 lakh.
      if (input.age >= 60 && input.monthlyGross * 12 + input.annualBonus <= 5_00_000) return 0;
      if (salary <= 15_000) return 0;
      if (salary < 25_000) return 180;
      return 208;
    },
    source: 'Assam PT Act 1947, Schedule Entry 1 (revised 1 April 2025)',
  },
  BR: {
    // Bihar Tax on Professions, Trades, Callings and Employments Act 2011, Schedule; rule 5 of the
    // 2011 Rules has the employer deduct the whole year's tax from the salary for September.
    salaryBasis: (i) => i.monthlyGross * 12,
    monthly: (annual, m) =>
      spread(
        band([
          [3_00_000, 0],
          [5_00_000, 1_000],
          [10_00_000, 2_000],
          [Infinity, 2_500],
        ])(annual),
        [SEPTEMBER],
      )(m),
    source: 'Bihar Professions Tax Act 2011, Schedule; deducted from September salary (rule 5)',
    caveat:
      "Bihar's Act tests your income for the year. We use your regular salary; other income or a large bonus could move you to a higher slab.",
  },
  JH: {
    // Jharkhand Tax on Professions, Trades, Callings and Employments Act 2011, Schedule Entry 1.
    // s.2(p): salary excludes bonus in any form. Rule 15: deducted every quarter.
    salaryBasis: (i) => i.monthlyGross * 12,
    monthly: (annual, m) =>
      spread(
        band([
          [3_00_000, 0],
          [5_00_000, 1_200],
          [8_00_000, 1_800],
          [10_00_000, 2_100],
          [Infinity, 2_500],
        ])(annual),
        [JUNE, SEPTEMBER, DECEMBER, MARCH],
      )(m),
    source: 'Jharkhand Professions Tax Act 2011, Schedule Entry 1; deducted quarterly (rule 15)',
    caveat:
      "Jharkhand's rules require the tax to be deducted every quarter but let employers choose the month, so we show each quarter's share at the end of the quarter.",
  },
  KL: {
    // Kerala Municipality Act 1994 and Kerala Panchayat Raj Act 1994: one statewide table, revised by
    // G.O.(Rt) No. 1149/2024/LSGD from 1 October 2024. Charged on each half-year's income.
    salaryBasis: (i) => i.monthlyGross * 6,
    monthly: halfYearly(
      band([
        [11_999, 0],
        [17_999, 320],
        [29_999, 450],
        [44_999, 600],
        [99_999, 750],
        [1_24_999, 1_000],
        [Infinity, 1_250],
      ]),
    ),
    source: 'Kerala Municipality and Panchayat Raj Acts, rates revised by G.O. 1149/2024/LSGD',
    caveat:
      "Kerala charges professional tax for each half-year. Employers choose the month they deduct it in, so we show each half-year's tax in September and March.",
  },
  TR: {
    // Tripura PT Act 1997, Schedule Sl. 1 as revised by notification F.II-1(7)-TAX/99(P-I) of
    // 25 July 2018 (Tripura Gazette No. 443) and its corrigendum of 30 October 2018 (No. 1031).
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) =>
      band([
        [7_500, 0],
        [15_000, 150],
        [Infinity, 208],
      ])(salary),
    source: 'Tripura PT Act 1997, Schedule Sl. 1 (revised July 2018)',
  },
  SK: {
    // Sikkim Tax on Professions, Trades, Callings and Employments Act 2006, Schedule Entry 1.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) =>
      band([
        [20_000, 0],
        [30_000, 125],
        [40_000, 150],
        [Infinity, 200],
      ])(salary),
    source: 'Sikkim Tax on Professions Act 2006, Schedule Entry 1',
    caveat:
      "We confirmed Sikkim's slabs in the 2006 Act and found no later amendment, but could not reach the state's own rate page to check it is still current.",
  },
  MN: {
    // Manipur PT Act 1981, Schedule Entry A as substituted by the Eighth Amendment Act 2012
    // (Manipur Gazette Extraordinary No. 199, 31 August 2012). Slabs on annual gross income.
    salaryBasis: (i) => i.monthlyGross * 12,
    monthly: (annual, m) =>
      spread(
        band([
          [50_000, 0],
          [75_000, 1_200],
          [1_00_000, 2_000],
          [1_25_000, 2_400],
          [Infinity, 2_500],
        ])(annual),
        FY_MONTHS.map((_, i) => i),
      )(m),
    source: 'Manipur PT Act 1981, Schedule Entry A (Eighth Amendment Act 2012)',
    caveat:
      'Manipur sets an annual amount and its Act does not fix the instalments, so we spread it evenly over the year with the remainder in March.',
  },
  MZ: {
    // Mizoram PT Act 1995, Schedule Sl. 1 as modified by notification J.17011/1/2017-TAX of
    // 11 July 2024, which added the Rs 195 band. The top band may instead be paid as Rs 2,500 a year.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) =>
      band([
        [5_000, 0],
        [8_000, 75],
        [10_000, 120],
        [12_000, 150],
        [15_000, 180],
        [20_000, 195],
        [Infinity, 208],
      ])(salary),
    source: 'Mizoram PT Act 1995, Schedule Sl. 1 (notification of 11 July 2024)',
  },
  NL: {
    // Nagaland PT Act 1968, Schedule Sl. 1, as published by the Nagaland Taxes Department. The
    // schedule says "more than X but less than Y"; an exact boundary is put in the higher band.
    salaryBasis: (i) => i.monthlyGross,
    monthly: (salary) => {
      if (salary < 4_000) return 0;
      if (salary < 5_000) return 35;
      if (salary < 7_000) return 75;
      if (salary < 9_000) return 110;
      if (salary < 12_000) return 180;
      return 208;
    },
    source: 'Nagaland PT Act 1968, Schedule Sl. 1 (Taxes Department schedule)',
    caveat:
      "Nagaland's published schedule is undated. We found no later revision, but check your payslip.",
  },
  PY: {
    // Puducherry Municipalities Act 1973 and Village and Commune Panchayats Act 1973, as amended in
    // 2017: minimum half-yearly rates, per Finance Department G.O.Ms.No.24/F3/2017 of 4 July 2017.
    salaryBasis: (i) => i.monthlyGross * 6,
    monthly: halfYearly(
      band([
        [99_999, 0],
        [2_00_000, 250],
        [3_00_000, 500],
        [4_00_000, 750],
        [5_00_000, 1_000],
        [Infinity, 1_250],
      ]),
    ),
    source: 'Puducherry Municipalities and Panchayats Acts (amended 2017), G.O.Ms.No.24/F3/2017',
    caveat:
      "These are the minimum half-yearly rates set by Puducherry's 2017 amendments; a local body may charge more. Government employees have the tax recovered quarterly; we show each half-year's tax in September and March.",
  },
};

/**
 * Professional tax set by a local body rather than the state. Tamil Nadu has no statewide table:
 * each corporation, municipality and panchayat fixes its own, so only cities whose rates we have
 * confirmed are calculated. Keyed by state code, then by city as used in the HRA city list.
 */
const LOCAL_SCHEDULES: Record<string, Record<string, Schedule>> = {
  TN: {
    Chennai: {
      // Tamil Nadu Urban Local Bodies Act 1998 (amended 2022), s.117-B. Greater Chennai Corporation
      // rates from the second half of 2024-25 (notice R.D.(HQ).C.No.PT/SPL/2024, 6 March 2025).
      salaryBasis: (i) => i.monthlyGross * 6,
      monthly: halfYearly(
        band([
          [21_000, 0],
          [30_000, 180],
          [45_000, 425],
          [60_000, 930],
          [75_000, 1_025],
          [Infinity, 1_250],
        ]),
      ),
      source: 'Greater Chennai Corporation, Tamil Nadu Urban Local Bodies Act 1998 s.117-B',
      caveat:
        "Chennai charges professional tax for each half-year, and employers choose the month they deduct it in, so we show each half-year's tax in September and March. Other Tamil Nadu towns set their own rates.",
    },
  },
};

export interface StateInfo {
  code: string;
  name: string;
  pt: 'verified' | 'not-levied' | 'unverified';
  /** Replaces the standard explanation where a state needs its own. */
  note?: string;
}

/** Every state and union territory, so the dropdown is complete. */
export const STATES: readonly StateInfo[] = [
  { code: 'AN', name: 'Andaman & Nicobar Islands', pt: 'not-levied' },
  { code: 'AP', name: 'Andhra Pradesh', pt: 'verified' },
  { code: 'AR', name: 'Arunachal Pradesh', pt: 'not-levied' },
  { code: 'AS', name: 'Assam', pt: 'verified' },
  { code: 'BR', name: 'Bihar', pt: 'verified' },
  { code: 'CH', name: 'Chandigarh', pt: 'not-levied' },
  { code: 'CT', name: 'Chhattisgarh', pt: 'not-levied' },
  { code: 'DH', name: 'Dadra & Nagar Haveli and Daman & Diu', pt: 'not-levied' },
  { code: 'DL', name: 'Delhi', pt: 'not-levied' },
  { code: 'GA', name: 'Goa', pt: 'not-levied' },
  { code: 'GJ', name: 'Gujarat', pt: 'verified' },
  { code: 'HR', name: 'Haryana', pt: 'not-levied' },
  { code: 'HP', name: 'Himachal Pradesh', pt: 'not-levied' },
  { code: 'JK', name: 'Jammu & Kashmir', pt: 'not-levied' },
  { code: 'JH', name: 'Jharkhand', pt: 'verified' },
  { code: 'KA', name: 'Karnataka', pt: 'verified' },
  { code: 'KL', name: 'Kerala', pt: 'verified' },
  { code: 'LA', name: 'Ladakh', pt: 'not-levied' },
  { code: 'LD', name: 'Lakshadweep', pt: 'not-levied' },
  { code: 'MP', name: 'Madhya Pradesh', pt: 'verified' },
  { code: 'MH', name: 'Maharashtra', pt: 'verified' },
  { code: 'MN', name: 'Manipur', pt: 'verified' },
  {
    code: 'ML',
    name: 'Meghalaya',
    pt: 'unverified',
    note: 'Meghalaya moved its professional tax rates out of its Act in 2022 and now sets them by notification, which we could not find on an official site. Take-home is shown before professional tax; enter the amount from your payslip for an exact figure (it can never exceed Rs 2,500 a year).',
  },
  { code: 'MZ', name: 'Mizoram', pt: 'verified' },
  { code: 'NL', name: 'Nagaland', pt: 'verified' },
  {
    code: 'OR',
    name: 'Odisha',
    pt: 'not-levied',
    note: 'Odisha abolished professional tax from 1 April 2026: the Repeal Ordinance, 2026 (Odisha Gazette, 21 April 2026) repealed its Professions Tax Act, so nothing is deducted this year.',
  },
  { code: 'PY', name: 'Puducherry', pt: 'verified' },
  { code: 'PB', name: 'Punjab', pt: 'verified' },
  { code: 'RJ', name: 'Rajasthan', pt: 'not-levied' },
  { code: 'SK', name: 'Sikkim', pt: 'verified' },
  {
    code: 'TN',
    name: 'Tamil Nadu',
    pt: 'unverified',
    note: 'In Tamil Nadu each town sets its own professional tax. We calculate Greater Chennai Corporation rates when you choose Chennai as your city; elsewhere, take-home is shown before it, so enter the amount from your payslip for an exact figure.',
  },
  { code: 'TS', name: 'Telangana', pt: 'verified' },
  { code: 'TR', name: 'Tripura', pt: 'verified' },
  { code: 'UP', name: 'Uttar Pradesh', pt: 'not-levied' },
  { code: 'UK', name: 'Uttarakhand', pt: 'not-levied' },
  { code: 'WB', name: 'West Bengal', pt: 'verified' },
];

const byCode = new Map(STATES.map((s) => [s.code, s]));
const zeros = () => Array.from({ length: 12 }, () => 0);

export function computeProfessionalTax(stateCode: string, input: PtInput): PtResult {
  const state = byCode.get(stateCode);
  const schedule =
    SCHEDULES[stateCode] ?? (input.city ? LOCAL_SCHEDULES[stateCode]?.[input.city] : undefined);
  const label = schedule?.label ?? 'Professional tax';

  // Checked before the schedule lookup: states that levy nothing deliberately have no schedule.
  if (state?.pt === 'not-levied') {
    return {
      status: 'not-levied',
      monthly: zeros(),
      annual: 0,
      label,
      note: state.note ?? `${state.name} does not levy professional tax on salaried employees.`,
      // A state that stopped levying recently (Odisha) explains itself, so payslip readers know why.
      caveat: state.note,
    };
  }
  if (!state || !schedule) {
    return {
      status: 'unverified',
      monthly: zeros(),
      annual: 0,
      label,
      note:
        state?.note ??
        `${state?.name ?? 'This state'} levies professional tax, but we have not verified its slabs, so take-home is shown before it. Enter the amount from your payslip for an exact figure (it can never exceed Rs 2,500 a year).`,
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
