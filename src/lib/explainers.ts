/**
 * Data for the three explainers on Labour Code wages, provident fund and gratuity. Every figure
 * comes from the calculator engine at build time, so the guides cannot drift from the calculator.
 *
 * These are the areas where most salary calculators are still wrong in Tax Year 2026-27: they
 * compute PF and gratuity on Basic alone, ignore the 50% wage rule, test ESI on gross pay, and
 * still use the Rs 15,000 PF ceiling after it rose to Rs 25,000 in September 2026.
 */

import { lakhs } from './brackets';
import { calculate, type CalculationResult, type CalculatorInput } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { annualGratuityProvision, estimateGratuity, GRATUITY } from './tax/gratuity';
import { CEILING_BY_MONTH, computeProvidentFund, EPF } from './tax/provident-fund';

const at = (lpa: number, overrides: Partial<CalculatorInput> = {}): CalculationResult =>
  calculate({ ...DEFAULT_INPUT, ...overrides, ctc: lakhs(lpa) });

const basicShare = (percent: number): Partial<CalculatorInput> => ({
  basic: { unit: 'percent', value: percent },
});

const takeHome = (r: CalculationResult) => r.regimes[r.better].monthlyTakeHome;

/**
 * Highest CTC, to the rupee, at which `test` still holds: `test(low)` must hold and `test(high)`
 * must not. Pages say "up to" or "above" this figure, so it must be the last passing value, not the
 * first failing one.
 */
function lastPassing(test: (ctc: number) => boolean, low: number, high: number): number {
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (test(mid)) low = mid;
    else high = mid;
  }
  return low;
}

// ---------------------------------------------------------------------------------------------
// Labour Code wages
// ---------------------------------------------------------------------------------------------

export interface WageRow {
  basicPercent: number;
  basicMonthly: number;
  /** "All remuneration" and the excluded payments within it, a month. */
  remuneration: number;
  excludedPayments: number;
  /** Excluded payments as a share of total remuneration. */
  excludedShare: number;
  addBack: number;
  wages: number;
  gratuityYearly: number;
  /** Employee PF a month when the employer contributes on full wages. */
  fullPfMonthly: number;
  /** Best-regime in-hand a month with PF at the ceiling. */
  takeHome: number;
}

export interface GratuityShiftRow {
  lpa: number;
  basicMonthly: number;
  wages: number;
  /** One year's gratuity on Basic alone, as most calculators still compute it. */
  onBasic: number;
  /** One year's gratuity on Labour Code wages. */
  onWages: number;
}

export interface EsiRow {
  lpa: number;
  grossMonthly: number;
  wages: number;
  covered: boolean;
  employeeMonthly: number;
}

export interface LabourCodeData {
  exampleLpa: number;
  rows: WageRow[];
  gratuityShift: GratuityShiftRow[];
  lowBasicPercent: number;
  esi: EsiRow[];
  /** Highest CTC at which ESI still applies, with Basic at half of CTC. */
  esiUpTo: number;
  esiCeiling: number;
}

export const WAGE_EXAMPLE_LPA = 12;
export const BASIC_SHARES = [25, 30, 40, 50] as const;
export const LOW_BASIC_PERCENT = 30;

export function labourCodeData(): LabourCodeData {
  const rows = BASIC_SHARES.map((basicPercent): WageRow => {
    const r = at(WAGE_EXAMPLE_LPA, basicShare(basicPercent));
    const full = at(WAGE_EXAMPLE_LPA, { ...basicShare(basicPercent), pfMode: 'actual' });
    const s = r.structure;
    return {
      basicPercent,
      basicMonthly: s.annual.basic / 12,
      remuneration: s.wages.remuneration,
      excludedPayments: s.wages.excludedPayments,
      excludedShare: s.wages.excludedShare,
      addBack: s.wages.addBack,
      wages: s.wages.wages,
      gratuityYearly: s.annual.gratuity,
      fullPfMonthly: full.structure.pf.employee,
      takeHome: takeHome(r),
    };
  });

  const gratuityShift = [6, 12, 20, 30].map((lpa): GratuityShiftRow => {
    const s = at(lpa, basicShare(LOW_BASIC_PERCENT)).structure;
    return {
      lpa,
      basicMonthly: s.annual.basic / 12,
      wages: s.wages.wages,
      onBasic: annualGratuityProvision(s.annual.basic / 12),
      onWages: annualGratuityProvision(s.wages.wages),
    };
  });

  // Every salary here has its own page, which the table links to.
  const esi = [3, 4, 5, 6].map((lpa): EsiRow => {
    const s = at(lpa).structure;
    return {
      lpa,
      grossMonthly: s.annual.grossFixed / 12,
      wages: s.wages.wages,
      covered: s.esi.applicable,
      employeeMonthly: s.esi.employee,
    };
  });

  return {
    exampleLpa: WAGE_EXAMPLE_LPA,
    rows,
    gratuityShift,
    lowBasicPercent: LOW_BASIC_PERCENT,
    esi,
    esiUpTo: lastPassing(
      (ctc) => calculate({ ...DEFAULT_INPUT, ctc }).structure.esi.applicable,
      3_00_000,
      8_00_000,
    ),
    esiCeiling: at(3).structure.esi.ceiling,
  };
}

// ---------------------------------------------------------------------------------------------
// Provident fund
// ---------------------------------------------------------------------------------------------

export interface PfWageRow {
  wages: number;
  /** Employee PF a month, April to August, in September, and October to March. */
  beforeChange: number;
  september: number;
  afterChange: number;
  thisYear: number;
  /** Every month at the new ceiling, as from Tax Year 2027-28. */
  nextYear: number;
}

export interface PfModeRow {
  lpa: number;
  takeHomeAtCeiling: number;
  takeHomeOnFull: number;
  /** Employee and employer PF together, a year. */
  pfAtCeiling: number;
  pfOnFull: number;
  /** The employee's own share on full wages, a year. */
  ownOnFull: number;
}

export interface PfGuideData {
  previousCeiling: number;
  ceiling: number;
  septemberCeiling: number;
  wageRows: PfWageRow[];
  /** Employer's monthly pension share at the old and new ceilings. */
  epsBefore: number;
  epsAfter: number;
  modeRows: PfModeRow[];
  /** Interest on the employee's own contributions above this, in a year, is taxable. */
  interestThreshold: number;
  /** CTC above which full-wage PF takes the employee's own share past that threshold. */
  interestAbove: number;
}

export const PF_WAGES = [12_000, 15_000, 18_000, 20_000, 25_000, 40_000] as const;
export const PF_MODE_LPA = [6, 10, 15, 20, 30, 50] as const;
const PF_INTEREST_THRESHOLD = 2_50_000;

export function pfGuideData(): PfGuideData {
  const wageRows = PF_WAGES.map((wages): PfWageRow => {
    const months = computeProvidentFund(wages, 'ceiling').employeeByMonth;
    return {
      wages,
      beforeChange: months[0],
      september: months[5],
      afterChange: months[11],
      thisYear: months.reduce((a, b) => a + b, 0),
      nextYear: Math.min(wages, EPF.wageCeiling) * EPF.employeeRate * 12,
    };
  });

  const modeRows = PF_MODE_LPA.map((lpa): PfModeRow => {
    const ceiling = at(lpa);
    const full = at(lpa, { pfMode: 'actual' });
    const yearly = (r: CalculationResult) =>
      r.structure.pf.employee * 12 + r.structure.annual.employerPf;
    return {
      lpa,
      takeHomeAtCeiling: takeHome(ceiling),
      takeHomeOnFull: takeHome(full),
      pfAtCeiling: yearly(ceiling),
      pfOnFull: yearly(full),
      ownOnFull: full.structure.pf.employee * 12,
    };
  });

  return {
    previousCeiling: EPF.previousWageCeiling,
    ceiling: EPF.wageCeiling,
    septemberCeiling: CEILING_BY_MONTH[5],
    wageRows,
    epsBefore: EPF.previousWageCeiling * EPF.epsRate,
    epsAfter: EPF.wageCeiling * EPF.epsRate,
    modeRows,
    interestThreshold: PF_INTEREST_THRESHOLD,
    interestAbove: lastPassing(
      (ctc) =>
        calculate({ ...DEFAULT_INPUT, ctc, pfMode: 'actual' }).structure.pf.employee * 12 <=
        PF_INTEREST_THRESHOLD,
      10_00_000,
      1_00_00_000,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// Gratuity
// ---------------------------------------------------------------------------------------------

export interface GratuityRow {
  lpa: number;
  wages: number;
  /** What the employer sets aside inside CTC each year. */
  provision: number;
  byYears: { years: number; amount: number; capped: boolean }[];
}

export interface ServiceRow {
  /** Years of service, as a decimal. */
  years: number;
  label: string;
  permanent: number;
  fixedTerm: number;
}

export interface GratuityData {
  rows: GratuityRow[];
  years: readonly number[];
  /** The wage used for the service table: the calculator's default 12 LPA structure. */
  serviceWages: number;
  serviceLpa: number;
  service: ServiceRow[];
  /** Permanent employee's gratuity at 5 years 6 months and at 5 years 7 months. */
  rounding: { atSixMonths: number; atSevenMonths: number };
  maximum: number;
  /** Highest CTC at which 20 years of service stays under the maximum, with Basic at half of CTC. */
  capAbove: number;
}

export const GRATUITY_LPA = [6, 10, 15, 20, 30, 50] as const;
export const GRATUITY_YEARS = [5, 10, 15, 20, 25] as const;
export const SERVICE_LPA = 12;

const SERVICE_POINTS: { years: number; label: string }[] = [
  { years: 0.75, label: '9 months' },
  { years: 1, label: '1 year' },
  { years: 2.5, label: '2 years 6 months' },
  { years: 4, label: '4 years' },
  { years: 5, label: '5 years' },
];

/** A permanent employee's part year counts as a full year only when it is more than six months. */
export const ROUNDING_POINTS = [5.5, 5 + 7 / 12] as const;

export function gratuityData(): GratuityData {
  const rows = GRATUITY_LPA.map((lpa): GratuityRow => {
    const s = at(lpa).structure;
    return {
      lpa,
      wages: s.wages.wages,
      provision: s.annual.gratuity,
      byYears: GRATUITY_YEARS.map((years) => {
        const g = estimateGratuity(s.wages.wages, years, 'permanent');
        return { years, amount: g.amount, capped: g.capped };
      }),
    };
  });

  const serviceWages = at(SERVICE_LPA).structure.wages.wages;
  const service = SERVICE_POINTS.map(({ years, label }): ServiceRow => ({
    years,
    label,
    permanent: estimateGratuity(serviceWages, years, 'permanent').amount,
    fixedTerm: estimateGratuity(serviceWages, years, 'fixed-term').amount,
  }));

  return {
    rows,
    years: GRATUITY_YEARS,
    serviceWages,
    serviceLpa: SERVICE_LPA,
    service,
    rounding: {
      atSixMonths: estimateGratuity(serviceWages, ROUNDING_POINTS[0], 'permanent').amount,
      atSevenMonths: estimateGratuity(serviceWages, ROUNDING_POINTS[1], 'permanent').amount,
    },
    maximum: GRATUITY.maximum,
    capAbove: lastPassing(
      (ctc) =>
        !estimateGratuity(
          calculate({ ...DEFAULT_INPUT, ctc }).structure.wages.wages,
          20,
          'permanent',
        ).capped,
      10_00_000,
      1_00_00_000,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// CTC, gross and in-hand
// ---------------------------------------------------------------------------------------------

export interface WaterfallStep {
  label: string;
  /** A year. Negative for amounts taken away. */
  amount: number;
  note?: string;
  kind: 'start' | 'minus' | 'subtotal' | 'total';
}

export interface CtcRow {
  lpa: number;
  grossMonthly: number;
  /** Employee PF, ESI, professional tax and income tax, a month. */
  deductionsMonthly: number;
  takeHomeMonthly: number;
  /** Share of CTC that reaches the bank over the year. */
  share: number;
}

export interface CtcData {
  exampleLpa: number;
  steps: WaterfallStep[];
  takeHomeMonthly: number;
  rows: CtcRow[];
  variable: {
    lpa: number;
    percent: number;
    variableAnnual: number;
    monthlyWithout: number;
    monthlyWith: number;
    annualWithout: number;
    annualWith: number;
  };
}

export const CTC_EXAMPLE_LPA = 12;
export const CTC_LPA = [5, 8, 12, 15, 20, 30, 50] as const;
export const VARIABLE_EXAMPLE = { lpa: 15, percent: 10 } as const;

export function ctcData(): CtcData {
  const r = at(CTC_EXAMPLE_LPA);
  const s = r.structure;
  const a = s.annual;
  const best = r.regimes[r.better];
  const minus = (label: string, amount: number, note?: string): WaterfallStep[] =>
    amount > 0 ? [{ label, amount: -amount, note, kind: 'minus' }] : [];

  const steps: WaterfallStep[] = [
    { label: 'CTC', amount: r.input.ctc, kind: 'start' },
    ...minus(
      'Employer PF',
      r.input.employerPfInCtc ? a.employerPf : 0,
      'Into your PF account and pension',
    ),
    ...minus(
      'Gratuity provision',
      r.input.gratuityInCtc ? a.gratuity : 0,
      'Paid only if you leave after qualifying',
    ),
    ...minus(
      'Employer ESI',
      r.input.employerEsiInCtc ? a.employerEsi : 0,
      'Buys ESI medical cover',
    ),
    ...minus('Employer NPS', a.employerNps, 'Into your NPS account'),
    ...minus('Variable pay', a.variable, 'Paid separately, if earned'),
    { label: 'Gross salary', amount: a.grossFixed, kind: 'subtotal' },
    ...minus('Your PF', s.pf.employee * 12),
    ...minus('Your ESI', s.esi.employee * 12),
    ...minus('Professional tax', r.professionalTax.annual),
    ...(best.tax.totalTax > 0
      ? minus('Income tax', best.tax.totalTax)
      : [
          {
            label: 'Income tax',
            amount: 0,
            note: 'None: within the ₹12 lakh rebate',
            kind: 'minus' as const,
          },
        ]),
    { label: 'In hand', amount: best.annualTakeHome - a.variable, kind: 'total' },
  ];

  const rows = CTC_LPA.map((lpa): CtcRow => {
    const row = at(lpa);
    const b = row.regimes[row.better];
    const gross = row.structure.annual.grossFixed / 12;
    return {
      lpa,
      grossMonthly: gross,
      deductionsMonthly: gross - b.monthlyTakeHome,
      takeHomeMonthly: b.monthlyTakeHome,
      share: b.annualTakeHome / row.input.ctc,
    };
  });

  const without = at(VARIABLE_EXAMPLE.lpa);
  const withVariable = at(VARIABLE_EXAMPLE.lpa, {
    variable: { unit: 'percent', value: VARIABLE_EXAMPLE.percent },
  });
  return {
    exampleLpa: CTC_EXAMPLE_LPA,
    steps,
    takeHomeMonthly: best.monthlyTakeHome,
    rows,
    variable: {
      ...VARIABLE_EXAMPLE,
      variableAnnual: withVariable.structure.annual.variable,
      monthlyWithout: takeHome(without),
      monthlyWith: takeHome(withVariable),
      annualWithout: without.regimes[without.better].annualTakeHome,
      annualWith: withVariable.regimes[withVariable.better].annualTakeHome,
    },
  };
}
