/**
 * The salary breakdown as an Excel workbook, styled like the site and the PDF: navy ink, India
 * green for the money you keep, saffron for highlights.
 *
 * `buildWorkbook` is pure, so tests build the same file in Node and read it back; the browser
 * wrapper (src/scripts/export-excel.ts) adds the logo and saves it. Every amount is a real number
 * with a rupee format, and the month-by-month sheet uses formulas, so the file can be sorted,
 * summed and edited rather than being a picture of a table.
 *
 * Four sheets: a summary, the breakdown tables, the tax working for both regimes, and the year
 * month by month (where the September PF ceiling change and February professional tax show).
 */

import ExcelJS from 'exceljs';
import { SITE } from '../../config/site';
import { formatCompactRupees, formatMonthYear, formatRupees } from '../format';
import { detailLedgers, REGIME_LABEL, roundColumn, taxLedgers, type Ledger } from '../ledgers';
import type { CalculationResult } from '../tax/calculate';
import { STATES } from '../tax/professional-tax';

export interface WorkbookOptions {
  /** Link back to this exact calculation. */
  shareUrl?: string;
  /** When the workbook was prepared. Defaults to now; tests pin it. */
  generatedOn?: Date;
  /** The site's mark as a base64 PNG data URL, placed beside the title on the summary. */
  logo?: string;
}

/* Style ------------------------------------------------------------------------------------- */

/** The site's light theme, as Excel ARGB colours. */
const C = {
  ink: 'FF131F35',
  ink2: 'FF455063',
  ink3: 'FF636C7C',
  line: 'FFE0E4EB',
  lineStrong: 'FFC8CED9',
  accent: 'FF0B7643',
  accentSoft: 'FFE4F9EA',
  saffron: 'FFF69835',
  saffronSoft: 'FFFFF1DA',
  chakra: 'FF183680',
  chartTax: 'FF283C62',
  chartSave: 'FFA7D9B7',
  zebra: 'FFF8F9FB',
  head: 'FFF3F4F7',
  white: 'FFFFFFFF',
};

const FONT = 'Calibri';
/** Rupees with no decimals, a real minus sign for deductions and a dash for zero. */
const RUPEES = '"₹"#,##0;"−₹"#,##0;"–"';
const PERCENT = '0.0%';
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTH_NAMES = [
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
];

type FontSpec = {
  size?: number;
  bold?: boolean;
  color?: string;
  italic?: boolean;
  underline?: boolean;
};
const font = ({
  size = 10,
  bold = false,
  color = C.ink,
  italic = false,
  underline = false,
}: FontSpec = {}): Partial<ExcelJS.Font> => ({
  name: FONT,
  size,
  bold,
  italic,
  underline,
  color: { argb: color },
});
const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});
const hairline = (argb = C.line): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb } });

interface CellSpec {
  value: ExcelJS.CellValue;
  font?: FontSpec;
  fill?: string;
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
  wrap?: boolean;
  indent?: number;
  border?: Partial<ExcelJS.Borders>;
}

function put(ws: ExcelJS.Worksheet, ref: string, spec: CellSpec): ExcelJS.Cell {
  const cell = ws.getCell(ref);
  cell.value = spec.value;
  cell.font = font(spec.font);
  if (spec.fill) cell.fill = fill(spec.fill);
  if (spec.numFmt) cell.numFmt = spec.numFmt;
  if (spec.border) cell.border = spec.border;
  cell.alignment = {
    vertical: 'middle',
    horizontal: spec.align ?? 'left',
    wrapText: spec.wrap ?? false,
    indent: spec.indent ?? 0,
  };
  return cell;
}

const col = (n: number) => String.fromCharCode(64 + n);

/** Engine notes write "Rs" for outputs without the glyph; every Excel font has the rupee sign. */
const rupee = (text: string) => text.replace(/\bRs\.? ?(?=[\d₹])/g, '₹');

/** A new sheet with gridlines off, A4 printing fitted to the page width, and the given columns. */
function sheet(
  wb: ExcelJS.Workbook,
  name: string,
  tab: string,
  widths: number[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: tab }, defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  ws.columns = widths.map((width) => ({ width }));
  return ws;
}

/**
 * The band and title every sheet opens with: a saffron-green-navy stripe like the site's cheque
 * band, the site name, what the sheet is, and when it was prepared.
 */
function header(
  ws: ExcelJS.Worksheet,
  lastCol: number,
  subtitle: string,
  preparedOn: Date,
  indent = 0,
) {
  const last = col(lastCol);
  ws.mergeCells(`A1:${last}1`);
  ws.getCell('A1').fill = {
    type: 'gradient',
    gradient: 'angle',
    degree: 0,
    stops: [
      { position: 0, color: { argb: C.saffron } },
      { position: 0.5, color: { argb: C.accent } },
      { position: 1, color: { argb: C.chakra } },
    ],
  };
  ws.getRow(1).height = 6;
  ws.getRow(2).height = 34;
  ws.getRow(3).height = 18;
  put(ws, 'B2', { value: SITE.name, font: { size: 18, bold: true }, indent });
  put(ws, 'B3', { value: subtitle, font: { size: 10, color: C.ink3 }, indent });
  put(ws, `${last}2`, {
    value: 'Salary breakdown',
    font: { size: 11, bold: true },
    align: 'right',
  });
  put(ws, `${last}3`, {
    value: `Prepared ${preparedOn.getDate()} ${MONTH_NAMES[(preparedOn.getMonth() + 9) % 12]} ${preparedOn.getFullYear()}`,
    font: { size: 9, color: C.ink3 },
    align: 'right',
  });
}

/** A section title with the site's short saffron mark in the gutter column. */
function section(ws: ExcelJS.Worksheet, row: number, title: string) {
  ws.getRow(row).height = 24;
  ws.getCell(`A${row}`).fill = fill(C.saffron);
  put(ws, `B${row}`, { value: title, font: { size: 13, bold: true } });
}

/** Column captions over a stronger rule; the accent column, if any, is marked in green. */
function captions(
  ws: ExcelJS.Worksheet,
  row: number,
  labels: string[],
  from: number,
  accent?: number,
) {
  ws.getRow(row).height = 22;
  labels.forEach((label, i) => {
    const isAccent = i === accent;
    put(ws, `${col(from + i)}${row}`, {
      value: label,
      font: { size: 9, bold: true, color: isAccent ? C.white : C.ink2 },
      fill: isAccent ? C.accent : C.head,
      align: i === 0 ? 'left' : 'right',
      indent: i === 0 ? 1 : 0,
      border: { bottom: hairline(isAccent ? C.accent : C.lineStrong) },
    });
  });
}

/* Summary ----------------------------------------------------------------------------------- */

function basedOn(result: CalculationResult): [string, string][] {
  const input = result.input;
  const state = STATES.find((s) => s.code === input.stateCode)?.name ?? input.stateCode;
  const place = input.city && input.city !== 'Other' ? `${input.city}, ${state}` : state;
  const claims = Object.values(input.deductions).reduce((sum, v) => sum + Math.max(0, v), 0);
  const pf =
    input.pfMode === 'ceiling'
      ? '12% up to the wage ceiling'
      : input.pfMode === 'actual'
        ? '12% of full wages'
        : 'Not deducted';
  return [
    ['Annual CTC', formatRupees(input.ctc)],
    ...((input.joiningBonus ?? 0) > 0
      ? [['Joining bonus, left out', formatRupees(input.joiningBonus ?? 0)] as [string, string]]
      : []),
    ['Work location', place],
    ...(input.monthlyRent > 0
      ? [['Rent paid', `${formatRupees(input.monthlyRent)} a month`] as [string, string]]
      : []),
    ['Provident fund', pf],
    ...(claims > 0 ? [['Old-regime claims', formatRupees(claims)] as [string, string]] : []),
    ['Age', String(input.age)],
  ];
}

function summary(
  wb: ExcelJS.Workbook,
  result: CalculationResult,
  o: WorkbookOptions,
  preparedOn: Date,
) {
  const ws = sheet(wb, 'Summary', C.accent, [2.5, 30, 17, 17, 3, 22, 26]);
  header(ws, 7, `CTC to in-hand salary, ${SITE.taxYearLabel}`, preparedOn, o.logo ? 6 : 0);
  if (o.logo) {
    const id = wb.addImage({ base64: o.logo, extension: 'png' });
    ws.addImage(id, {
      tl: { col: 1.05, row: 1.1 },
      ext: { width: 40, height: 40 },
      editAs: 'oneCell',
    });
  }
  ws.getRow(4).height = 10;

  if (result.errors.length > 0) {
    section(ws, 5, 'This structure does not add up');
    result.errors.forEach((error, i) => {
      ws.mergeCells(`B${6 + i}:G${6 + i}`);
      put(ws, `B${6 + i}`, { value: error, font: { color: C.ink2 }, wrap: true });
      ws.getRow(6 + i).height = 30;
    });
    return;
  }

  const best = result.regimes[result.better];
  const a = result.structure.annual;

  // The figure people open this for, with what it rests on beside it.
  put(ws, 'B5', { value: 'In hand per month', font: { size: 11, bold: true, color: C.ink2 } });
  for (let r = 5; r <= 12; r++) ws.getRow(r).height = 21;
  ws.mergeCells('B6:D7');
  put(ws, 'B6', {
    value: Math.round(best.monthlyTakeHome),
    numFmt: RUPEES,
    font: { size: 28, bold: true, color: C.accent },
  });
  ws.mergeCells('B8:D9');
  put(ws, 'B8', {
    value: rupee(
      `${formatRupees(best.annualTakeHome)} a year${
        a.variable > 0 ? `, including ${formatRupees(a.variable)} variable pay` : ''
      }, from a ${formatCompactRupees(result.structure.input.ctcAnnual)} CTC under the ${REGIME_LABEL[result.better].toLowerCase()}.`,
    ),
    font: { size: 10, color: C.ink2 },
    wrap: true,
  });

  put(ws, 'F5', { value: 'Based on', font: { size: 9, bold: true, color: C.ink3 } });
  basedOn(result).forEach(([label, value], i) => {
    const r = 6 + i;
    put(ws, `F${r}`, {
      value: label,
      font: { size: 9, color: C.ink3 },
      border: { bottom: hairline() },
    });
    put(ws, `G${r}`, { value, font: { size: 10 }, align: 'right', border: { bottom: hairline() } });
  });

  // Both regimes, the cheaper one marked.
  let r = Math.max(11, 6 + basedOn(result).length + 1);
  section(ws, r, 'Both tax regimes');
  r += 1;
  const accent =
    result.savingByChoosingBetter >= 0.5 ? (result.better === 'new' ? 1 : 2) : undefined;
  captions(
    ws,
    r,
    [
      '',
      `New regime${accent === 1 ? ' (lower tax)' : ''}`,
      `Old regime${accent === 2 ? ' (lower tax)' : ''}`,
    ],
    2,
    accent,
  );
  const [nw, ol] = [result.regimes.new, result.regimes.old];
  const regimeRows: [string, number, number][] = [
    ['In hand a month', nw.monthlyTakeHome, ol.monthlyTakeHome],
    ['In hand a year', nw.annualTakeHome, ol.annualTakeHome],
    ['Taxable income', nw.taxableIncome, ol.taxableIncome],
    ['Income tax a year', nw.tax.totalTax, ol.tax.totalTax],
  ];
  regimeRows.forEach(([label, n, old], i) => {
    r += 1;
    const zebra = i % 2 === 1 ? C.zebra : undefined;
    put(ws, `B${r}`, {
      value: label,
      font: { color: C.ink2 },
      indent: 1,
      fill: zebra,
      border: { bottom: hairline() },
    });
    [n, old].forEach((v, j) => {
      const isBest = accent === j + 1;
      put(ws, `${col(3 + j)}${r}`, {
        value: Math.round(v),
        numFmt: RUPEES,
        font: { bold: isBest, color: isBest ? C.accent : C.ink },
        fill: isBest ? C.accentSoft : zebra,
        align: 'right',
        border: { bottom: hairline() },
      });
    });
  });
  r += 1;
  ws.mergeCells(`B${r}:D${r}`);
  put(ws, `B${r}`, {
    value:
      result.savingByChoosingBetter >= 0.5
        ? `The ${REGIME_LABEL[result.better].toLowerCase()} saves you ${formatRupees(result.savingByChoosingBetter)} a year.`
        : 'Both regimes come to the same tax.',
    font: { bold: true, color: C.accent },
  });
  ws.getRow(r).height = 22;

  // Where the CTC goes, with an in-cell bar for each part.
  r += 2;
  const total = a.ctcComponents;
  const takeHome = Math.max(0, best.annualTakeHome);
  const tax = Math.max(0, best.tax.totalTax);
  const rest = Math.max(0, total - takeHome - tax);
  section(ws, r, `Where your ${formatCompactRupees(total)} CTC goes`);
  r += 1;
  captions(ws, r, ['', 'Per year', 'Share of CTC'], 2);
  ws.mergeCells(`F${r}:G${r}`);
  put(ws, `F${r}`, { value: '', fill: C.head, border: { bottom: hairline(C.lineStrong) } });
  const parts: [string, number, string][] = [
    ['Reaches your bank', takeHome, C.accent],
    ['Income tax', tax, C.chartTax],
    ['PF, gratuity and other', rest, C.chartSave],
  ];
  for (const [label, value, color] of parts) {
    r += 1;
    const share = total > 0 ? value / total : 0;
    put(ws, `B${r}`, {
      value: label,
      font: { color: C.ink2 },
      indent: 1,
      border: { bottom: hairline() },
    });
    put(ws, `C${r}`, {
      value: Math.round(value),
      numFmt: RUPEES,
      align: 'right',
      border: { bottom: hairline() },
    });
    put(ws, `D${r}`, {
      value: share,
      numFmt: PERCENT,
      font: { color: C.ink3 },
      align: 'right',
      border: { bottom: hairline() },
    });
    ws.mergeCells(`F${r}:G${r}`);
    put(ws, `F${r}`, {
      value: '█'.repeat(Math.max(share > 0 ? 1 : 0, Math.round(share * 34))),
      font: { size: 10, color },
      border: { bottom: hairline() },
    });
  }
  r += 1;
  put(ws, `B${r}`, {
    value: 'Total CTC',
    font: { bold: true },
    indent: 1,
    border: { top: hairline(C.ink) },
  });
  put(ws, `C${r}`, {
    value: Math.round(total),
    numFmt: RUPEES,
    font: { bold: true },
    align: 'right',
    border: { top: hairline(C.ink) },
  });
  put(ws, `D${r}`, {
    value: 1,
    numFmt: PERCENT,
    font: { bold: true, color: C.ink3 },
    align: 'right',
    border: { top: hairline(C.ink) },
  });

  // Notes: each in a saffron-edged box, as on the page.
  if (result.notices.length > 0) {
    r += 2;
    section(ws, r, 'Notes on your numbers');
    for (const notice of result.notices) {
      r += 1;
      ws.mergeCells(`B${r}:G${r}`);
      put(ws, `B${r}`, {
        value: rupee(notice),
        font: { size: 10, color: C.ink2 },
        fill: C.saffronSoft,
        wrap: true,
        indent: 1,
        border: { left: { style: 'thick', color: { argb: C.saffron } } },
      });
      ws.getRow(r).height = Math.max(20, Math.ceil(notice.length / 105) * 14 + 8);
    }
  }

  footer(ws, r + 2, 7, o.shareUrl);
}

function footer(ws: ExcelJS.Worksheet, row: number, lastCol: number, shareUrl?: string) {
  const last = col(lastCol);
  ws.mergeCells(`B${row}:${last}${row}`);
  put(ws, `B${row}`, {
    value:
      'Estimates only, not tax advice. Your payslip and Form 130 (formerly Form 16) are the final word.',
    font: { size: 9, color: C.ink3 },
  });
  ws.mergeCells(`B${row + 1}:${last}${row + 1}`);
  put(ws, `B${row + 1}`, {
    value: `Statutory rates verified ${formatMonthYear(SITE.ratesVerifiedOn)}.`,
    font: { size: 9, color: C.ink3 },
  });
  const link = put(ws, `B${row + 2}`, {
    value: {
      text: shareUrl ? 'Reopen this calculation' : SITE.domain,
      hyperlink: shareUrl ?? SITE.url,
    },
    font: { size: 10, bold: true, color: C.accent, underline: true },
  });
  link.alignment = { vertical: 'middle' };
}

/* Ledgers ----------------------------------------------------------------------------------- */

/**
 * One breakdown table: a title, captions, rows with light zebra striping and notes in the last
 * column, and a total on a soft green band under a stronger rule.
 */
function ledger(ws: ExcelJS.Worksheet, start: number, l: Ledger, withNotes: boolean): number {
  let r = start;
  section(ws, r, l.title);
  r += 1;
  captions(
    ws,
    r,
    ['Component', ...l.columns, ...(withNotes ? ['Note'] : [])],
    2,
    l.accentColumn === undefined ? undefined : l.accentColumn + 1,
  );
  if (withNotes) {
    const noteCell = ws.getCell(`${col(3 + l.columns.length)}${r}`);
    noteCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  }
  let stripe = 0;
  for (const row of l.rows) {
    r += 1;
    const isTotal = row.kind === 'total';
    const isCarry = row.kind === 'carry';
    const zebra = !isTotal && stripe++ % 2 === 1 ? C.zebra : undefined;
    const rowFill = isTotal ? C.accentSoft : zebra;
    const edge = isTotal
      ? { top: hairline(C.accent), bottom: hairline(C.accent) }
      : { bottom: hairline() };
    put(ws, `B${r}`, {
      value: row.label,
      font: { bold: isTotal, color: isTotal ? C.ink : isCarry ? C.ink3 : C.ink2 },
      fill: rowFill,
      indent: 1,
      border: edge,
    });
    row.cells.forEach((v, j) => {
      const isAccent = l.accentColumn === j;
      put(ws, `${col(3 + j)}${r}`, {
        value: v === null ? '–' : v,
        numFmt: v === null ? undefined : RUPEES,
        font: {
          bold: isTotal || (isAccent && isTotal),
          color: isCarry || v === null ? C.ink3 : isAccent ? C.accent : C.ink,
        },
        fill: rowFill,
        align: 'right',
        border: edge,
      });
    });
    if (withNotes) {
      put(ws, `${col(3 + row.cells.length)}${r}`, {
        value: rupee(row.hint ?? ''),
        font: { size: 9, color: C.ink3 },
        fill: rowFill,
        indent: 1,
        wrap: true,
        border: edge,
      });
      if (row.hint && row.hint.length > 70)
        ws.getRow(r).height = Math.ceil(row.hint.length / 70) * 13 + 6;
    }
    if (isTotal) ws.getRow(r).height = 22;
  }
  return r;
}

function breakdown(wb: ExcelJS.Workbook, result: CalculationResult, preparedOn: Date) {
  const ws = sheet(wb, 'Breakdown', C.saffron, [2.5, 40, 16, 16, 62]);
  header(ws, 5, 'Every component of your CTC, a month and a year', preparedOn);
  let r = 4;
  for (const l of detailLedgers(result)) r = ledger(ws, r + 2, l, true);
}

function taxWorking(wb: ExcelJS.Workbook, result: CalculationResult, preparedOn: Date) {
  const ws = sheet(wb, 'Tax working', C.chakra, [2.5, 40, 18, 18, 52]);
  header(ws, 5, 'How the income tax was worked out, in both regimes', preparedOn);
  let r = 4;
  for (const l of taxLedgers(result)) r = ledger(ws, r + 2, l, true);
}

/** The value that appears in the most months: the usual professional tax deduction. */
function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0;
}

/* Month by month ---------------------------------------------------------------------------- */

function monthByMonth(wb: ExcelJS.Workbook, result: CalculationResult, preparedOn: Date) {
  const ws = sheet(wb, 'Month by month', C.chartSave, [2.5, 13, 15, 15, 11, 15, 16, 15, 40]);
  header(ws, 9, 'April to March, as each payslip should look', preparedOn);

  const best = result.regimes[result.better];
  const a = result.structure.annual;
  const pf = result.structure.pf.employeeByMonth;
  const pt = result.professionalTax.monthly;
  const esi = result.structure.esi.employee;
  const gross = a.grossFixed / 12;
  const tds = best.tax.totalTax / 12;

  section(ws, 5, 'Your year, month by month');
  captions(
    ws,
    6,
    ['Month', 'Fixed pay', 'Employee PF', 'ESI', 'Prof. tax', 'Income tax', 'In hand', 'Note'],
    2,
  );
  ws.getCell('I6').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 6 }];

  const typicalPt = mostCommon(pt);
  // Whole rupees that add up, as on a payslip: each column's year is rounded the way the Breakdown
  // sheet rounds it (gross and tax as printed, the rest absorbing the difference), then each month
  // is rounded so the column reaches that year exactly.
  const yearTargets = roundColumn(
    [
      a.grossFixed,
      -pf.reduce((x, y) => x + y, 0),
      -esi * 12,
      -pt.reduce((x, y) => x + y, 0),
      -best.tax.totalTax,
    ],
    Math.round(best.annualTakeHome - a.variable),
    [true, false, false, false, true],
  );
  const columns = [
    MONTHS.map(() => gross),
    pf.map((v) => -v),
    MONTHS.map(() => -esi),
    pt.map((v) => -v),
    MONTHS.map(() => -tds),
  ].map((values, j) => roundColumn(values, yearTargets[j]));
  const table = MONTHS.map((_, m) => columns.map((c) => c[m]));
  table.forEach((values, m) => {
    const r = 7 + m;
    const zebra = m % 2 === 1 ? C.zebra : undefined;
    const notes: string[] = [];
    if (m > 0 && Math.abs(pf[m] - pf[m - 1]) >= 1) notes.push('PF changes with the wage ceiling');
    if (Math.abs(pt[m] - typicalPt) >= 1)
      notes.push(`Professional tax ${formatRupees(pt[m])} this month`);
    put(ws, `B${r}`, {
      value: MONTHS[m],
      font: { color: C.ink2 },
      indent: 1,
      fill: zebra,
      border: { bottom: hairline() },
    });
    values.forEach((v, j) => {
      put(ws, `${col(3 + j)}${r}`, {
        value: v,
        numFmt: RUPEES,
        font: { color: v < 0 ? C.ink2 : C.ink },
        fill: zebra,
        align: 'right',
        border: { bottom: hairline() },
      });
    });
    put(ws, `H${r}`, {
      value: { formula: `SUM(C${r}:G${r})`, result: values.reduce((x, y) => x + y, 0) },
      numFmt: RUPEES,
      font: { bold: true, color: C.accent },
      fill: zebra ?? C.white,
      align: 'right',
      border: { bottom: hairline() },
    });
    put(ws, `I${r}`, {
      value: notes.join('; '),
      font: { size: 9, color: C.ink3 },
      indent: 1,
      fill: zebra,
      border: { bottom: hairline() },
    });
  });

  // The year: live totals over the twelve rows.
  const t = 19;
  const band = { top: hairline(C.accent), bottom: hairline(C.accent) };
  put(ws, `B${t}`, {
    value: 'Year',
    font: { bold: true },
    indent: 1,
    fill: C.accentSoft,
    border: band,
  });
  for (let j = 0; j < 6; j++) {
    const letter = col(3 + j);
    const sum = table.reduce(
      (x, values) => x + (j < 5 ? values[j] : values.reduce((p, q) => p + q, 0)),
      0,
    );
    put(ws, `${letter}${t}`, {
      value: { formula: `SUM(${letter}7:${letter}18)`, result: sum },
      numFmt: RUPEES,
      font: { bold: true, color: letter === 'H' ? C.accent : C.ink },
      fill: C.accentSoft,
      align: 'right',
      border: band,
    });
  }
  put(ws, `I${t}`, { value: '', fill: C.accentSoft, border: band });
  ws.getRow(t).height = 22;

  let r = t + 2;
  if (a.variable > 0) {
    put(ws, `B${r}`, { value: 'Variable pay', font: { color: C.ink2 }, indent: 1 });
    put(ws, `H${r}`, { value: Math.round(a.variable), numFmt: RUPEES, align: 'right' });
    put(ws, `I${r}`, {
      value: 'Paid separately, if fully earned',
      font: { size: 9, color: C.ink3 },
      indent: 1,
    });
    r += 1;
    put(ws, `B${r}`, { value: 'Year with variable pay', font: { bold: true }, indent: 1 });
    put(ws, `H${r}`, {
      value: { formula: `H${t}+H${r - 1}`, result: Math.round(best.annualTakeHome) },
      numFmt: RUPEES,
      font: { bold: true, color: C.accent },
      align: 'right',
    });
    r += 2;
  }
  ws.mergeCells(`B${r}:I${r}`);
  put(ws, `B${r}`, {
    value:
      'Income tax is spread evenly over the year here. Your employer may deduct more or less in some months after you declare investments, change jobs or receive a bonus; the year should match.',
    font: { size: 9, color: C.ink3 },
    wrap: true,
  });
  ws.getRow(r).height = 28;
}

/* Entry point ------------------------------------------------------------------------------- */

export function buildWorkbook(
  result: CalculationResult,
  options: WorkbookOptions = {},
): ExcelJS.Workbook {
  const preparedOn = options.generatedOn ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = SITE.name;
  wb.title = `Salary breakdown, ${SITE.shortYearLabel}`;
  wb.subject = `CTC to in-hand salary, ${SITE.taxYearLabel}`;
  wb.created = preparedOn;
  // Formulas carry cached results, but ask Excel to recalculate them when the file opens.
  wb.calcProperties.fullCalcOnLoad = true;

  summary(wb, result, options, preparedOn);
  if (result.errors.length === 0) {
    breakdown(wb, result, preparedOn);
    taxWorking(wb, result, preparedOn);
    monthByMonth(wb, result, preparedOn);
  }
  return wb;
}
