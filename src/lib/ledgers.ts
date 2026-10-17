/**
 * The breakdown tables shared by the PDF and the spreadsheet: earnings, deductions and the rest of
 * the CTC, and both regimes' tax working. Every column is rounded so its rows add up to its total
 * exactly, as on a payslip.
 */

import { buildExportDocument, type ExportRow, type ExportSectionId } from './export-data';
import { formatNumber } from './format';
import type { CalculationResult, RegimeBreakdown } from './tax/calculate';
import type { Regime } from './tax/rates';

export const REGIME_LABEL: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

const MINUS = '−';

/** Whole rupees, lakh grouping, and a real minus sign for deductions. */
export function money(amount: number): string {
  const whole = Math.round(amount);
  return `${whole < 0 ? MINUS : ''}₹${formatNumber(Math.abs(whole))}`;
}

/**
 * Rounds a column of amounts to whole rupees so the rows add up to `target` exactly, as on a
 * payslip. `pinned` rows repeat a figure printed elsewhere, so they keep their plain rounding and
 * the others absorb the difference. Falls back to plain rounding if the column cannot reconcile
 * (a clamped total, say).
 */
export function roundColumn(values: number[], target: number, pinned: boolean[] = []): number[] {
  const plain = values.map((v) => Math.round(v));
  const free = values.map((_, i) => !pinned[i]);
  const fixedSum = plain.reduce((sum, v, i) => (free[i] ? sum : sum + v), 0);
  const floors = values.map((v, i) => (free[i] ? Math.floor(v) : plain[i]));
  let short = target - fixedSum - floors.reduce((sum, v, i) => (free[i] ? sum + v : sum), 0);
  const freeCount = free.filter(Boolean).length;
  if (short < 0 || short > freeCount) return plain;

  const order = values
    .map((v, i) => ({ i, fraction: v - Math.floor(v) }))
    .filter(({ i }) => free[i])
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const rounded = [...floors];
  for (const { i } of order) {
    if (short <= 0) break;
    rounded[i] += 1;
    short -= 1;
  }
  return rounded;
}

export type Cell = number | null;

export interface LedgerRow {
  label: string;
  hint?: string;
  cells: Cell[];
  /** carry: a figure brought forward from another table; total: stronger rule above. */
  kind: 'row' | 'carry' | 'total';
}

export interface Ledger {
  title: string;
  columns: string[];
  /** Index of a column to mark in the accent (the cheaper regime). */
  accentColumn?: number;
  rows: LedgerRow[];
}

/**
 * A ledger with "Per month" and "Per year" columns built from an export section. `carry` is gross
 * salary brought forward from the first table, so every table's rows visibly add up to its total.
 * The carried figure and income tax are printed elsewhere too, so they keep their plain rounding.
 */
function monthlyLedger(
  title: string,
  rows: ExportRow[],
  total: { label: string; annual: number; monthly: number },
  carry?: ExportRow,
): Ledger {
  const all = carry ? [carry, ...rows] : rows;
  const isCarry = (i: number) => carry !== undefined && i === 0;
  const annual = roundColumn(
    all.map((r) => r.value),
    Math.round(total.annual),
    all.map((r, i) => isCarry(i) || r.key === 'income-tax'),
  );
  const monthly = roundColumn(
    all.map((r) => r.value / 12),
    Math.round(total.monthly),
    all.map((_, i) => isCarry(i)),
  );
  return {
    title,
    columns: ['Per month', 'Per year'],
    rows: [
      ...all.map((row, i): LedgerRow => ({
        label: row.label,
        hint: row.note,
        cells: [monthly[i], annual[i]],
        kind: isCarry(i) ? 'carry' : 'row',
      })),
      {
        label: total.label,
        cells: [Math.round(total.monthly), Math.round(total.annual)],
        kind: 'total',
      },
    ],
  };
}

/** The gratuity projection, told where the gratuity line sits rather than in a block of its own. */
function gratuityNote(result: CalculationResult): string {
  const g = result.gratuityProjection;
  return g.eligible
    ? `Paid only when you leave; about ${money(g.amount)} after ${g.countedYears} years`
    : `Paid only when you leave, and only after ${g.minimumYears} years of service`;
}

export function detailLedgers(result: CalculationResult): Ledger[] {
  const doc = buildExportDocument(result);
  const section = (id: ExportSectionId) => doc.sections.find((s) => s.id === id)!;
  const a = result.structure.annual;
  const best = result.regimes[result.better];
  const gross: ExportRow = { label: 'Gross salary (fixed)', value: a.grossFixed };

  const earnings = section('earnings');
  const deductions = section('deductions');
  const employer = section('employer');

  const ledgers = [
    monthlyLedger(earnings.title, earnings.rows, {
      label: 'Gross salary (fixed)',
      annual: a.grossFixed,
      monthly: a.grossFixed / 12,
    }),
    monthlyLedger(
      deductions.title,
      deductions.rows,
      {
        label: a.variable > 0 ? 'In hand, before variable pay' : 'In hand',
        annual: best.annualTakeHome - a.variable,
        monthly: best.monthlyTakeHome,
      },
      gross,
    ),
  ];
  if (employer.rows.length > 0) {
    const rows = employer.rows.map((row) =>
      row.key === 'gratuity' ? { ...row, note: gratuityNote(result) } : row,
    );
    ledgers.push(
      monthlyLedger(
        employer.title,
        rows,
        { label: 'Total CTC', annual: a.ctcComponents, monthly: a.ctcComponents / 12 },
        gross,
      ),
    );
  }
  return ledgers;
}

/** Both regimes' working side by side: the page's "How the tax was worked out". */
export function taxLedgers(result: CalculationResult): Ledger[] {
  const regimes = [result.regimes.new, result.regimes.old];
  type Line = { label: string; hint?: string; value: (r: RegimeBreakdown) => number | null };
  const deduction = (v: number | undefined | null) => (v && v > 0 ? -v : null);

  const surchargeRates = [
    ...new Set(regimes.filter((r) => r.tax.surcharge > 0).map((r) => r.tax.surchargeRate)),
  ];
  const surchargeReliefs = regimes.filter((r) => r.tax.surchargeMarginalRelief > 0);
  const old = result.regimes.old;
  const hra = old.hraExemption;

  const income: Line[] = [
    {
      label: 'Gross salary',
      hint:
        old.employerContributionPerquisite >= 1
          ? `Includes ${money(old.employerContributionPerquisite)} of employer PF and NPS above ${money(7_50_000)}`
          : undefined,
      value: (r) => r.grossSalary,
    },
    {
      label: 'HRA exemption',
      hint: hra
        ? hra.binding === 'rent'
          ? 'Limited by rent paid minus 10% of Basic'
          : hra.binding === 'percent'
            ? `Limited to ${hra.rate === 0.5 ? '50%' : '40%'} of Basic`
            : 'Limited to the HRA you receive'
        : undefined,
      value: (r) => deduction(r.hraExemption?.exemption),
    },
    { label: 'Standard deduction', value: (r) => deduction(r.standardDeduction) },
    { label: 'Professional tax', value: (r) => deduction(r.professionalTaxDeduction) },
    { label: 'Employer NPS (s.124)', value: (r) => deduction(r.employerNpsDeduction) },
    {
      label: '80C (s.123)',
      hint: old.sec80C?.capped ? `Capped at ${money(old.sec80C.cap)}; you entered more` : undefined,
      value: (r) => deduction(r.sec80C?.allowed),
    },
    {
      label: 'NPS 80CCD(1B) (s.124(3))',
      hint: old.nps80CCD1B?.capped ? 'Capped at ₹50,000' : undefined,
      value: (r) => deduction(r.nps80CCD1B?.allowed),
    },
    {
      label: 'Health insurance (s.126)',
      hint: old.healthInsurance?.capped ? `Capped at ${money(old.healthInsurance.cap)}` : undefined,
      value: (r) => deduction(r.healthInsurance?.allowed),
    },
    {
      label: 'Home loan interest (s.22)',
      hint: old.selfOccupiedInterest?.capped ? 'Capped at ₹2,00,000' : undefined,
      value: (r) => deduction(r.selfOccupiedInterest?.allowed),
    },
  ];
  const tax: Line[] = [
    { label: 'Tax at slab rates', value: (r) => r.tax.slabTax },
    {
      label: 'Rebate (s.156)',
      hint: regimes.some((r) => r.tax.rebateIsMarginalRelief)
        ? 'Marginal relief above ₹12 lakh'
        : undefined,
      value: (r) => deduction(r.tax.rebate),
    },
    {
      label:
        surchargeRates.length === 1
          ? `Surcharge at ${(surchargeRates[0] * 100).toFixed(0)}%`
          : 'Surcharge',
      hint:
        surchargeRates.length > 1
          ? regimes
              .filter((r) => r.tax.surcharge > 0)
              .map((r) => `${(r.tax.surchargeRate * 100).toFixed(0)}% in the ${r.regime} regime`)
              .join(', ')
          : surchargeReliefs.length > 0
            ? `Marginal relief of ${money(surchargeReliefs[0].tax.surchargeMarginalRelief)} applied`
            : undefined,
      value: (r) => (r.tax.surcharge > 0 ? r.tax.surcharge : null),
    },
    { label: 'Health & education cess (4%)', value: (r) => r.tax.cess },
  ];

  // Show a line only if at least one regime uses it; reconcile each column to its total.
  const group = (lines: Line[], total: (r: RegimeBreakdown) => number) => {
    const used = lines.filter((line) => regimes.some((r) => line.value(r) !== null));
    const columns = regimes.map((r) => {
      const values = used.map((line) => line.value(r));
      const present = values.map((v) => v !== null);
      const rounded = roundColumn(
        values.filter((v): v is number => v !== null),
        Math.round(total(r)),
      );
      let k = 0;
      return present.map((p) => (p ? rounded[k++] : null));
    });
    return used.map((line, i): LedgerRow => ({
      label: line.label,
      hint: line.hint,
      cells: columns.map((col) => col[i]),
      kind: 'row',
    }));
  };

  // Two ledgers, as on the page, so each can find its own place in the flow.
  const columns = regimes.map((r) => REGIME_LABEL[r.regime]);
  const accentColumn =
    result.savingByChoosingBetter >= 0.5 ? (result.better === 'new' ? 0 : 1) : undefined;
  return [
    {
      title: 'Taxable income in each regime',
      columns,
      accentColumn,
      rows: [
        ...group(income, (r) => r.taxableIncome),
        {
          label: 'Taxable income',
          cells: regimes.map((r) => Math.round(r.taxableIncome)),
          kind: 'total',
        },
      ],
    },
    {
      title: 'Income tax in each regime',
      columns,
      accentColumn,
      rows: [
        ...group(tax, (r) => r.tax.totalTax),
        {
          label: 'Total tax',
          cells: regimes.map((r) => Math.round(r.tax.totalTax)),
          kind: 'total',
        },
      ],
    },
  ];
}
