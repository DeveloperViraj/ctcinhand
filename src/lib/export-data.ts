/**
 * Shapes a calculation into rows for the PDF and Excel exports, so both files show the same
 * numbers in the same order as the page.
 */

import { SITE } from '../config/site';
import { formatMonthYear } from './format';
import type { CalculationResult } from './tax/calculate';
import { describePtPattern } from './pt-pattern';
import { employerPfNote, pfCeilingNote } from './pf-note';
import type { Regime } from './tax/rates';

/** Whole rupees, written the way the PDF and spreadsheet fonts can always show. */
const rs = (amount: number) => `Rs ${Math.round(amount).toLocaleString('en-IN')}`;

export interface ExportRow {
  label: string;
  /** Annual rupee amount. Negative means it is deducted. */
  value: number;
  note?: string;
  /** Stable handle for the few rows an export needs to find again. */
  key?: 'income-tax' | 'gratuity';
}

export type ExportSectionId = 'earnings' | 'deductions' | 'employer' | 'comparison' | 'statutory';

export interface ExportSection {
  /** Stable handle, so an export can pick a section without matching on its title. */
  id: ExportSectionId;
  title: string;
  rows: ExportRow[];
  total?: ExportRow;
}

export interface ExportDocument {
  title: string;
  subtitle: string;
  sections: ExportSection[];
  notices: string[];
  footer: string;
}

const REGIME: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

export function buildExportDocument(result: CalculationResult): ExportDocument {
  const a = result.structure.annual;
  const best = result.regimes[result.better];
  const other = result.regimes[result.better === 'new' ? 'old' : 'new'];
  const pt = result.professionalTax;

  const earnings: ExportRow[] = [
    { label: 'Basic + DA', value: a.basic },
    { label: 'House rent allowance', value: a.hra },
    { label: 'Leave travel allowance', value: a.lta },
    { label: 'Special allowance', value: a.special },
  ].filter((r) => r.value > 0);

  const deductions: ExportRow[] = [
    {
      label: 'Provident fund (employee)',
      value: -result.structure.pf.employee * 12,
      note:
        result.input.pfMode === 'ceiling'
          ? pfCeilingNote(result.structure.pf.employeeByMonth, rs)
          : 'On full Labour Code wages',
    },
    { label: 'ESI (employee, 0.75%)', value: -result.structure.esi.employee * 12 },
    { label: pt.label, value: -pt.annual, note: ptHint(pt.monthly) },
    {
      label: `Income tax (${REGIME[best.regime].toLowerCase()})`,
      value: -best.tax.totalTax,
      key: 'income-tax' as const,
    },
    // Income tax stays even at zero, as on the page: "no tax" is worth saying.
  ].filter((r) => r.value !== 0 || r.key === 'income-tax');

  // Same order and wording as the page. Employer PF, ESI and gratuity are listed only when the
  // offer counts them inside the CTC, so the rows (with gross salary) add up to the total.
  const input = result.input;
  const employer: ExportRow[] = [
    { label: 'Variable pay', value: a.variable, note: 'Paid to you separately, if fully earned' },
    {
      label: 'Employer PF',
      value: input.employerPfInCtc ? a.employerPf : 0,
      note: employerPfNote(result.structure.pf, rs),
    },
    { label: 'Employer NPS', value: a.employerNps, note: 'Yours, but locked until retirement' },
    {
      label: 'Gratuity provision',
      value: input.gratuityInCtc ? a.gratuity : 0,
      note: 'Paid only when you leave, if eligible',
      key: 'gratuity' as const,
    },
    {
      label: 'Employer ESI (3.25%)',
      value: input.employerEsiInCtc ? a.employerEsi : 0,
      note: 'Buys insurance cover, not cash',
    },
  ].filter((r) => r.value > 0);

  const comparison: ExportRow[] = [
    { label: `${REGIME[best.regime]} - taxable income`, value: best.taxableIncome },
    { label: `${REGIME[best.regime]} - total tax`, value: best.tax.totalTax, note: 'Lower' },
    { label: `${REGIME[other.regime]} - taxable income`, value: other.taxableIncome },
    { label: `${REGIME[other.regime]} - total tax`, value: other.tax.totalTax },
    { label: 'Difference', value: result.savingByChoosingBetter },
  ];

  const wages = result.structure.wages;
  const statutory: ExportRow[] = [
    {
      label: 'Labour Code wages (per month)',
      value: wages.wages,
      note: 'Basis for PF, ESI and gratuity',
    },
    ...(wages.addBack > 0
      ? [
          {
            label: 'of which added by the 50% rule',
            value: wages.addBack,
            note: 'Allowances above half of pay counted as wages',
          },
        ]
      : []),
    {
      label: 'Gratuity if you leave now',
      value: result.gratuityProjection.amount,
      note: result.gratuityProjection.eligible
        ? `After ${result.gratuityProjection.countedYears} years`
        : `Needs ${result.gratuityProjection.minimumYears} years of service`,
    },
  ];

  return {
    title: 'Salary breakdown',
    subtitle: `${SITE.taxYearLabel}. ${REGIME[best.regime]} is cheaper by Rs ${Math.round(
      result.savingByChoosingBetter,
    ).toLocaleString('en-IN')} a year`,
    sections: [
      {
        id: 'earnings',
        title: 'What you are paid',
        rows: earnings,
        total: { label: 'Gross salary (fixed)', value: a.grossFixed },
      },
      {
        id: 'deductions',
        title: 'What is deducted',
        rows: deductions,
        total: { label: 'Annual in-hand', value: best.annualTakeHome - a.variable },
      },
      {
        id: 'employer',
        title: 'The rest of your CTC, and where it goes',
        rows: employer,
        total: { label: 'Total CTC', value: a.ctcComponents },
      },
      { id: 'comparison', title: 'Regime comparison', rows: comparison },
      { id: 'statutory', title: 'Statutory wages and gratuity', rows: statutory },
    ],
    notices: result.notices,
    footer: `Estimates only, not tax advice. Statutory rates verified ${formatMonthYear(SITE.ratesVerifiedOn)}. Generated by ${SITE.domain}`,
  };
}

export function monthlyInHand(result: CalculationResult): number {
  return result.regimes[result.better].monthlyTakeHome;
}

/**
 * The page's short professional-tax hint ("Rs 200 a month, Rs 300 in February"), rather than the
 * statute citation in `PtResult.note`. Undefined when every month is the same.
 */
export function ptHint(monthly: number[]): string | undefined {
  return describePtPattern(monthly, rs);
}
