/**
 * The salary breakdown as one plain, well-formatted Excel sheet: a bordered table of the month and
 * year figures, a second one with both tax regimes side by side, and a few footnotes. Amounts are
 * real numbers in Indian digit grouping and the totals are formulas, so the sheet stays editable.
 *
 * `buildWorkbook` is pure, so tests build the same file in Node and read it back; the browser
 * wrapper (src/scripts/export-excel.ts) saves it.
 */

import ExcelJS from 'exceljs';
import { SITE } from '../../config/site';
import { formatCompactRupees, formatMonthYear, formatRupees } from '../format';
import { detailLedgers, REGIME_LABEL } from '../ledgers';
import type { CalculationResult } from '../tax/calculate';
import { STATES } from '../tax/professional-tax';

export interface WorkbookOptions {
  /** Link back to this exact calculation. */
  shareUrl?: string;
  /** When the workbook was prepared. Defaults to now; tests pin it. */
  generatedOn?: Date;
}

/* Style ------------------------------------------------------------------------------------- */

const FONT = 'Arial';
const BLACK = 'FF000000';
/** Column captions. */
const HEADER = 'FFF9CB9C';
/** The figure you keep. */
const RESULT = 'FFFFF2CC';
const NOTE = 'FF444444';
const LINK = 'FF1155CC';

/** Indian digit grouping (12,34,567) whatever the reader's locale: Excel has no lakh format. */
export const INDIAN = '[>=10000000]##\\,##\\,##\\,##0;[>=100000]##\\,##\\,##0;##,##0';

type Edge = Partial<ExcelJS.Border>;
const thin: Edge = { style: 'thin', color: { argb: BLACK } };
const medium: Edge = { style: 'medium', color: { argb: BLACK } };
const box = (edge: Edge): Partial<ExcelJS.Borders> => ({
  top: edge,
  left: edge,
  bottom: edge,
  right: edge,
});

interface CellStyle {
  bold?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
  border?: Partial<ExcelJS.Borders>;
  wrap?: boolean;
}

function put(
  ws: ExcelJS.Worksheet,
  ref: string,
  value: ExcelJS.CellValue,
  { bold = false, size = 10, color = BLACK, fill, align = 'left', border, wrap = false }: CellStyle,
): ExcelJS.Cell {
  const cell = ws.getCell(ref);
  cell.value = value;
  cell.font = { name: FONT, size, bold, color: { argb: color } };
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  if (border) cell.border = border;
  if (typeof value === 'number' || (value && typeof value === 'object' && 'formula' in value))
    cell.numFmt = INDIAN;
  cell.alignment = {
    vertical: 'middle',
    horizontal: align,
    wrapText: wrap,
    indent: align === 'center' || wrap ? 0 : 1,
  };
  return cell;
}

/** Engine notes write "Rs" for outputs without the glyph; Arial has the rupee sign. */
const rupee = (text: string) => text.replace(/\bRs\.? ?(?=[\d₹])/g, '₹');

const listOf = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/* Tables ------------------------------------------------------------------------------------ */

/** A table's title: bold, centred across B:D, in a heavier box, as in a hand-made sheet. */
function title(ws: ExcelJS.Worksheet, row: number, text: string) {
  ws.mergeCells(`B${row}:D${row}`);
  put(ws, `B${row}`, text, { bold: true, size: 11, align: 'center' });
  for (const c of ['B', 'C', 'D']) ws.getCell(`${c}${row}`).border = box(medium);
  ws.getRow(row).height = 24;
}

function captions(ws: ExcelJS.Worksheet, row: number, labels: [string, string, string]) {
  labels.forEach((label, i) =>
    put(ws, `${'BCD'[i]}${row}`, label, {
      bold: true,
      fill: HEADER,
      align: 'center',
      border: box(thin),
    }),
  );
  ws.getRow(row).height = 21;
}

type Amount = number | ExcelJS.CellFormulaValue;

function amounts(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  [month, year]: [Amount, Amount],
  { bold = false, fill, fillLast }: { bold?: boolean; fill?: string; fillLast?: string } = {},
) {
  put(ws, `B${row}`, label, { bold, fill, border: box(thin) });
  put(ws, `C${row}`, month, { bold, fill, align: 'right', border: box(thin) });
  put(ws, `D${row}`, year, { bold, fill: fillLast ?? fill, align: 'right', border: box(thin) });
  ws.getRow(row).height = 19;
}

const sum = (column: string, from: number, to: number, result: number): Amount => ({
  formula: `SUM(${column}${from}:${column}${to})`,
  result,
});

/* The sheet --------------------------------------------------------------------------------- */

function placeOf(result: CalculationResult): string {
  const { city, stateCode } = result.input;
  const state = STATES.find((s) => s.code === stateCode)?.name ?? stateCode;
  return city && city !== 'Other' ? `${city}, ${state}` : state;
}

/** One footnote across the table's width, wrapped, with the row tall enough for its lines. */
function footnote(ws: ExcelJS.Worksheet, row: number, text: string, link?: string) {
  ws.mergeCells(`B${row}:D${row}`);
  put(ws, `B${row}`, link ? { text, hyperlink: link } : text, {
    size: 9,
    color: link ? LINK : NOTE,
    wrap: true,
  });
  if (link)
    ws.getCell(`B${row}`).font = { name: FONT, size: 9, underline: true, color: { argb: LINK } };
  ws.getRow(row).height = Math.ceil(text.length / 88) * 12 + 4;
}

function salarySheet(wb: ExcelJS.Workbook, result: CalculationResult, o: WorkbookOptions) {
  const ws = wb.addWorksheet('Salary breakdown', {
    properties: { defaultRowHeight: 18 },
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = [{ width: 4 }, { width: 40 }, { width: 20 }, { width: 20 }];

  if (result.errors.length > 0) {
    title(ws, 2, 'This salary structure does not add up');
    result.errors.forEach((error, i) => footnote(ws, 4 + i, rupee(error)));
    return;
  }

  const input = result.input;
  const a = result.structure.annual;
  const best = result.regimes[result.better];
  const [earnings, deductions, employer] = detailLedgers(result);

  // 1. The month and year breakdown: what you are paid (A), what is deducted (B), and A − B.
  let r = 2;
  title(
    ws,
    r,
    `Salary Breakdown for ${formatCompactRupees(input.ctc)} CTC (${SITE.shortYearLabel})`,
  );
  captions(ws, ++r, ['Component', 'Per Month (₹)', 'Per Year (₹)']);

  const paid = earnings.rows.filter((row) => row.kind === 'row');
  const firstPaid = r + 1;
  for (const row of paid) amounts(ws, ++r, row.label, [row.cells[0]!, row.cells[1]!]);
  const gross = [0, 1].map((j) => paid.reduce((s, row) => s + row.cells[j]!, 0));
  const grossRow = ++r;
  amounts(
    ws,
    r,
    'Gross salary (A)',
    [sum('C', firstPaid, r - 1, gross[0]), sum('D', firstPaid, r - 1, gross[1])],
    { bold: true },
  );

  // Deductions as positive amounts, so the sheet reads like a payslip.
  const taken = deductions.rows.filter((row) => row.kind === 'row');
  const firstTaken = r + 1;
  for (const row of taken) amounts(ws, ++r, row.label, [-row.cells[0]!, -row.cells[1]!]);
  const deducted = [0, 1].map((j) => taken.reduce((s, row) => s - row.cells[j]!, 0));
  const deductedRow = ++r;
  amounts(
    ws,
    r,
    'Total deductions (B)',
    [sum('C', firstTaken, r - 1, deducted[0]), sum('D', firstTaken, r - 1, deducted[1])],
    { bold: true },
  );

  const inHand = (column: string, j: number): Amount => ({
    formula: `${column}${grossRow}-${column}${deductedRow}`,
    result: gross[j] - deducted[j],
  });
  amounts(ws, ++r, 'In-hand salary (A − B)', [inHand('C', 0), inHand('D', 1)], {
    bold: true,
    fill: RESULT,
  });

  // 2. Both regimes, the in-hand column marked like the result column it is.
  r += 2;
  title(ws, r, 'New vs Old Tax Regime');
  captions(ws, ++r, ['Regime', 'Income Tax per Year (₹)', 'In-Hand per Month (₹)']);
  const clearWinner = result.savingByChoosingBetter >= 1;
  for (const regime of ['new', 'old'] as const) {
    const breakdown = result.regimes[regime];
    const isBetter = clearWinner && regime === result.better;
    amounts(
      ws,
      ++r,
      isBetter ? `${REGIME_LABEL[regime]} (lower tax)` : REGIME_LABEL[regime],
      [Math.round(breakdown.tax.totalTax), Math.round(breakdown.monthlyTakeHome)],
      { bold: isBetter, fillLast: RESULT },
    );
  }

  // 3. Footnotes: what the figures rest on, and what the CTC holds besides monthly pay.
  const notes = [
    `*Estimates for ${SITE.taxYearLabel} under the ${REGIME_LABEL[best.regime].toLowerCase()}, for a CTC of ${formatRupees(input.ctc)} in ${placeOf(result)}. Not tax advice; your payslip and Form 130 (formerly Form 16) are the final word.`,
  ];
  const held = (employer?.rows ?? []).filter(
    (row) => row.kind === 'row' && !row.label.startsWith('Variable'),
  );
  if (held.length > 0) {
    const parts = held.map(
      (row) =>
        `${row.label
          .replace(/ \(.*\)$/, '')
          .replace(/^Employer/, 'employer')
          .replace('Gratuity provision', 'gratuity')} of ${formatRupees(row.cells[1]!)}`,
    );
    notes.push(
      `*Your CTC also includes ${listOf(parts)} a year, which are not paid in your monthly salary.`,
    );
  }
  if (a.variable > 0)
    notes.push(
      `*Variable pay of ${formatRupees(Math.round(a.variable))} a year is paid separately, if earned, and is not included above.`,
    );
  if ((input.joiningBonus ?? 0) > 0)
    notes.push(
      `*The joining bonus of ${formatRupees(input.joiningBonus ?? 0)} is a one-time payment and is left out.`,
    );
  for (const notice of result.notices) notes.push(`*${rupee(notice)}`);
  notes.push(
    `*Statutory rates verified ${formatMonthYear(SITE.ratesVerifiedOn)}. Prepared ${(o.generatedOn ?? new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} on ${SITE.domain}.`,
  );

  r += 1;
  for (const note of notes) footnote(ws, ++r, note);
  if (o.shareUrl) footnote(ws, r + 2, 'Open this calculation online', o.shareUrl);
}

/* Entry point ------------------------------------------------------------------------------- */

export function buildWorkbook(
  result: CalculationResult,
  options: WorkbookOptions = {},
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = SITE.name;
  wb.title = `Salary breakdown, ${SITE.shortYearLabel}`;
  wb.subject = `CTC to in-hand salary, ${SITE.taxYearLabel}`;
  wb.created = options.generatedOn ?? new Date();
  // Formulas carry cached results, but ask Excel to recalculate them when the file opens.
  wb.calcProperties.fullCalcOnLoad = true;
  salarySheet(wb, result, options);
  return wb;
}
