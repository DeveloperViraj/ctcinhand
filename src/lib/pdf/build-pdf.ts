/**
 * The salary report PDF.
 *
 * `buildPdf` is pure: a calculation and font bytes in, a jsPDF document out. The browser wrapper
 * (src/scripts/export-pdf.ts) fetches the fonts and saves the file; tests build the same document
 * in Node and read it back.
 *
 * The page follows the site's system: IBM Plex Sans at 435 and 535, one peacock accent, ink greys
 * and hairline ledgers. A4 portrait with 48pt margins, vertical positions on a 4pt grid. Each block
 * is measured before it is drawn, so a block that does not fit moves whole to the next page, and a
 * table that has to break repeats its column header.
 *
 * Text is always measured in the style it is drawn in (see Canvas.measure). Measuring after a size
 * change is what once made the header caption overlap the headline figure.
 */

import { jsPDF } from 'jspdf';
import { SITE } from '../../config/site';
import { buildExportDocument, type ExportRow, type ExportSectionId } from '../export-data';
import { formatCompactRupees, formatNumber } from '../format';
import type { CalculationResult, RegimeBreakdown } from '../tax/calculate';
import { STATES } from '../tax/professional-tax';
import type { Regime } from '../tax/rates';
import { FONT_FAMILY, registerFonts, toPdfText, type FontWeight, type PdfFontFiles } from './fonts';

export interface BuildPdfOptions {
  /** Link back to this exact calculation, printed as "Reopen this calculation". */
  shareUrl?: string;
  /** When the report was prepared. Defaults to now; tests pin it. */
  generatedOn?: Date;
}

/* Geometry ----------------------------------------------------------------------------------- */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const LEFT = MARGIN;
const RIGHT = PAGE_W - MARGIN;
const WIDTH = RIGHT - LEFT;

/** The footer is a hairline and two lines of small print ending on the bottom margin. */
const FOOTER_RULE = PAGE_H - MARGIN - 24;
const CONTENT_BOTTOM = FOOTER_RULE - 20;
const FIRST_PAGE_TOP = 108;
const NEXT_PAGE_TOP = 92;

const SECTION_GAP = 28;
const HEADING_GAP = 12;

/** IBM Plex Sans cap height, as a fraction of the font size. */
const CAP = 0.698;

const snap = (value: number) => Math.ceil(value / 4 - 1e-9) * 4;

/* Colour and type ---------------------------------------------------------------------------- */

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

const COLOR = {
  ink: rgb('#1B2530'),
  ink2: rgb('#4A5663'),
  ink3: rgb('#6B7682'),
  line: rgb('#E3E8EC'),
  lineStrong: rgb('#CDD5DB'),
  accent: rgb('#0B6E87'),
  accentSoft: rgb('#E8F4F7'),
  inset: rgb('#F3F6F8'),
  chartTax: rgb('#9AA5B1'),
  chartRest: rgb('#D5DBE0'),
  warn: rgb('#D9A035'),
  white: rgb('#FFFFFF'),
};

interface TextStyle {
  size: number;
  weight: FontWeight;
  color: Rgb;
  /** Height of one line box. Text sits in it with its capitals centred. */
  leading: number;
}

const style = (size: number, weight: FontWeight, color: Rgb, leading: number): TextStyle => ({
  size,
  weight,
  color,
  leading,
});
const tint = (base: TextStyle, color: Rgb): TextStyle => ({ ...base, color });

const T = {
  hero: style(32, 'bold', COLOR.ink, 40),
  figure: style(15, 'bold', COLOR.ink, 20),
  amount: style(11, 'bold', COLOR.ink, 16),
  heading: style(11, 'bold', COLOR.ink, 16),
  body: style(9, 'normal', COLOR.ink2, 12),
  value: style(9, 'normal', COLOR.ink, 12),
  strong: style(9, 'bold', COLOR.ink, 12),
  small: style(7.5, 'normal', COLOR.ink3, 10),
  label: style(7.5, 'bold', COLOR.ink3, 10),
  micro: style(7, 'normal', COLOR.ink3, 10),
};

/** Baseline of a line whose line box starts at `top`. */
const baseline = (top: number, s: TextStyle) => top + s.leading / 2 + (CAP * s.size) / 2;

/* Money -------------------------------------------------------------------------------------- */

const MINUS = '−';

/** Whole rupees, lakh grouping, and a real minus sign for deductions. */
function money(amount: number): string {
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

/* Canvas ------------------------------------------------------------------------------------- */

/** jsPDF plus a flow cursor, page breaks and text helpers that always set the style first. */
class Canvas {
  y = FIRST_PAGE_TOP;
  pageTop = FIRST_PAGE_TOP;

  constructor(readonly pdf: jsPDF) {}

  use(s: TextStyle): void {
    this.pdf.setFont(FONT_FAMILY, s.weight);
    this.pdf.setFontSize(s.size);
    this.pdf.setTextColor(...s.color);
  }

  measure(text: string, s: TextStyle): number {
    this.use(s);
    return this.pdf.getTextWidth(toPdfText(text));
  }

  text(text: string, x: number, y: number, s: TextStyle, align: 'left' | 'right' = 'left'): void {
    this.use(s);
    this.pdf.text(toPdfText(text), x, y, { align, baseline: 'alphabetic' });
  }

  /** Draws pieces in different styles along one baseline; returns the x after the last piece. */
  runs(pieces: [string, TextStyle][], x: number, y: number): number {
    for (const [text, s] of pieces) {
      this.text(text, x, y, s);
      x += this.measure(text, s);
    }
    return x;
  }

  wrap(text: string, s: TextStyle, width: number): string[] {
    this.use(s);
    return this.pdf.splitTextToSize(toPdfText(text), width) as string[];
  }

  /** Draws wrapped lines from a line-box top; returns the height used. */
  paragraph(lines: string[], x: number, top: number, s: TextStyle): number {
    lines.forEach((line, i) => this.text(line, x, baseline(top + i * s.leading, s), s));
    return lines.length * s.leading;
  }

  rule(x1: number, x2: number, y: number, color: Rgb, width = 0.5, dash?: number[]): void {
    this.pdf.setDrawColor(...color);
    this.pdf.setLineWidth(width);
    this.pdf.setLineDashPattern(dash ?? [], 0);
    this.pdf.line(x1, y, x2, y);
    if (dash) this.pdf.setLineDashPattern([], 0);
  }

  box(x: number, y: number, w: number, h: number, color: Rgb, radius = 0): void {
    this.pdf.setFillColor(...color);
    if (radius > 0) this.pdf.roundedRect(x, y, w, h, radius, radius, 'F');
    else this.pdf.rect(x, y, w, h, 'F');
  }

  /**
   * A filled rectangle rounded on the left and/or right only, drawn as one path so there is no
   * seam where two shapes would otherwise overlap.
   */
  segment(x: number, y: number, w: number, h: number, color: Rgb, left: number, right: number) {
    const k = 0.5523; // Bezier handle length for a quarter circle
    const { pdf } = this;
    pdf.setFillColor(...color);
    pdf.moveTo(x + left, y);
    pdf.lineTo(x + w - right, y);
    if (right)
      pdf.curveTo(x + w - right * (1 - k), y, x + w, y + right * (1 - k), x + w, y + right);
    pdf.lineTo(x + w, y + h - right);
    if (right)
      pdf.curveTo(
        x + w,
        y + h - right * (1 - k),
        x + w - right * (1 - k),
        y + h,
        x + w - right,
        y + h,
      );
    pdf.lineTo(x + left, y + h);
    if (left) pdf.curveTo(x + left * (1 - k), y + h, x, y + h - left * (1 - k), x, y + h - left);
    pdf.lineTo(x, y + left);
    if (left) pdf.curveTo(x, y + left * (1 - k), x + left * (1 - k), y, x + left, y);
    pdf.close();
    pdf.fill();
  }

  /**
   * Reserves `height` for a block, `gap` below whatever came before. If it would run into the
   * footer, the block starts on a new page instead (without the gap). Returns the block's top.
   */
  begin(height: number, gap = SECTION_GAP): number {
    if (this.y > this.pageTop) {
      if (this.y + gap + height > CONTENT_BOTTOM) this.newPage();
      else this.y += gap;
    }
    return this.y;
  }

  newPage(): void {
    this.pdf.addPage();
    this.pageTop = this.y = NEXT_PAGE_TOP;
  }
}

/** The site logo: a rounded peacock square holding two bars, one outlined and one filled. */
function drawMark(c: Canvas, x: number, y: number, size: number): void {
  const k = size / 32;
  c.box(x, y, size, size, COLOR.accent, 7 * k);
  c.pdf.setDrawColor(...COLOR.white);
  c.pdf.setLineWidth(1.8 * k);
  c.pdf.roundedRect(x + 8.5 * k, y + 7.5 * k, 6 * k, 17 * k, 1.5 * k, 1.5 * k, 'S');
  c.box(x + 17.5 * k, y + 12 * k, 6 * k, 12.5 * k, COLOR.white, 1.5 * k);
}

/* Page furniture ----------------------------------------------------------------------------- */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const longDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const isoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

const DOC_TITLE = 'Salary breakdown';

function drawFirstHeader(c: Canvas): void {
  drawMark(c, LEFT, MARGIN, 20);
  c.text(SITE.name, LEFT + 28, MARGIN + 10 + (CAP * 13) / 2, style(13, 'bold', COLOR.ink, 16));
  c.text(DOC_TITLE, RIGHT, MARGIN + CAP * 10, style(10, 'bold', COLOR.ink, 12), 'right');
  c.text(SITE.taxYearLabel, RIGHT, MARGIN + 20, T.small, 'right');
  c.rule(LEFT, RIGHT, MARGIN + 36, COLOR.line);
}

function drawRunningHeader(c: Canvas): void {
  drawMark(c, LEFT, MARGIN - 4, 12);
  const y = MARGIN + 2 + (CAP * 9) / 2;
  c.text(SITE.name, LEFT + 18, y, style(9, 'bold', COLOR.ink, 12));
  c.text(`${DOC_TITLE}, ${SITE.taxYearLabel}`, RIGHT, y, T.small, 'right');
  c.rule(LEFT, RIGHT, MARGIN + 20, COLOR.line);
}

function drawFooter(c: Canvas, page: number, pages: number, preparedOn: Date): void {
  c.rule(LEFT, RIGHT, FOOTER_RULE, COLOR.line);
  const first = FOOTER_RULE + 14;
  const second = first + 10;
  c.text(
    'Estimates only, not tax advice. Your payslip and Form 16 are the final word.',
    LEFT,
    first,
    T.micro,
  );
  c.text(`Page ${page} of ${pages}`, RIGHT, first, T.micro, 'right');
  c.text(
    `Statutory rates verified ${isoDate(SITE.ratesVerifiedOn)}. Prepared ${longDate(preparedOn)}.`,
    LEFT,
    second,
    T.micro,
  );
  c.text(SITE.domain, RIGHT, second, T.micro, 'right');
  const w = c.measure(SITE.domain, T.micro);
  c.pdf.link(RIGHT - w, second - 7, w, 9, { url: SITE.url });
}

/* Summary blocks ----------------------------------------------------------------------------- */

const REGIME_LABEL: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

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
    ['Annual CTC', money(input.ctc)],
    ['Work location', place],
    ...(input.monthlyRent > 0
      ? [['Rent paid', `${money(input.monthlyRent)} a month`] as [string, string]]
      : []),
    ['Provident fund', pf],
    ...(claims > 0 ? [['Old-regime claims', money(claims)] as [string, string]] : []),
    ['Age', String(input.age)],
  ];
}

function drawHero(c: Canvas, result: CalculationResult, shareUrl: string | undefined): void {
  const best = result.regimes[result.better];
  const a = result.structure.annual;
  const top = c.y;

  // Left: the one number people open this for.
  const leftWidth = 272;
  c.text('In hand per month', LEFT, baseline(top, T.body), T.body);
  c.text(money(best.monthlyTakeHome), LEFT - 1.5, baseline(top + 16, T.hero), T.hero);
  const sentence = `${money(best.annualTakeHome)} a year${
    a.variable > 0 ? `, including ${money(a.variable)} variable pay` : ''
  }, from a ${formatCompactRupees(result.input.ctc)} CTC under the ${REGIME_LABEL[
    result.better
  ].toLowerCase()}.`;
  const leftHeight = 60 + c.paragraph(c.wrap(sentence, T.body, leftWidth), LEFT, top + 60, T.body);

  // Right: what the figure rests on, like the account details on a statement. Label and value
  // share one baseline even though they are set in different sizes.
  const x = LEFT + 316;
  const rowHeight = 16;
  c.text('Based on', x, baseline(top, T.label), T.label);
  let y = top + 16;
  basedOn(result).forEach(([label, value], i) => {
    if (i > 0) c.rule(x, RIGHT, y, COLOR.line);
    const b = baseline(y + 2, T.value);
    c.text(label, x, b, T.small);
    c.text(value, RIGHT, b, tint(T.value, COLOR.ink2), 'right');
    y += rowHeight;
  });

  if (shareUrl) {
    c.rule(x, RIGHT, y, COLOR.line);
    const b = baseline(y + 4, T.value);
    const link = style(8, 'bold', COLOR.accent, 12);
    const label = 'Reopen this calculation';
    c.text(label, x, b, link);
    // A share link is too long to be useful in print; the host tells a paper reader where to go.
    c.text(new URL(shareUrl).host, RIGHT, b, T.small, 'right');
    c.pdf.link(x, y + 2, RIGHT - x, rowHeight, { url: shareUrl });
    y += rowHeight + 4;
  }

  c.y = top + snap(Math.max(leftHeight, y - top));
}

function drawMarginalRelief(c: Canvas, result: CalculationResult): void {
  const best = result.regimes[result.better];
  if (!best.tax.rebateIsMarginalRelief) return;

  const pad = 14;
  const text = `Your income is just above ₹12 lakh, so your tax is capped at the amount by which it exceeds that. Without this relief you would pay ${money(
    best.tax.rebate * 1.04,
  )} more a year. The 4% cess still applies on top, so until your taxable income passes about ₹12.71 lakh each extra rupee costs ₹1.04 in tax.`;
  const lines = c.wrap(text, T.body, WIDTH - 2 * pad);
  const height = snap(12 + 12 + 4 + lines.length * 12 + 12);
  const top = c.begin(height, 24);

  c.box(LEFT, top, WIDTH, height, COLOR.accentSoft, 6);
  c.text('Marginal relief applied', LEFT + pad, baseline(top + 12, T.strong), T.strong);
  c.paragraph(lines, LEFT + pad, top + 28, T.body);
  c.y = top + height;
}

function drawRegimes(c: Canvas, result: CalculationResult): void {
  const cardHeight = 84;
  const height = 16 + HEADING_GAP + cardHeight + 12 + 12;
  const top = c.begin(height);
  c.text('Both tax regimes', LEFT, baseline(top, T.heading), T.heading);

  const gap = 8;
  const cardWidth = (WIDTH - gap) / 2;
  const cardTop = top + 16 + HEADING_GAP;
  const saving = result.savingByChoosingBetter;

  (['new', 'old'] as const).forEach((regime, i) => {
    const r = result.regimes[regime];
    const isBetter = regime === result.better && saving >= 0.5;
    const x = LEFT + i * (cardWidth + gap);
    const pad = 12;
    c.box(x, cardTop, cardWidth, cardHeight, isBetter ? COLOR.accentSoft : COLOR.inset, 4);

    const nameY = baseline(cardTop + pad, T.value);
    c.text(REGIME_LABEL[regime], x + pad, nameY, T.value);
    if (isBetter) {
      const chip = style(7, 'bold', COLOR.white, 10);
      const w = c.measure('Lower tax', chip) + 10;
      const middle = nameY - (CAP * T.value.size) / 2;
      c.box(x + cardWidth - pad - w, middle - 6, w, 12, COLOR.accent, 2);
      c.text('Lower tax', x + cardWidth - pad - 5, middle + (CAP * chip.size) / 2, chip, 'right');
    }
    c.text(money(r.monthlyTakeHome), x + pad, baseline(cardTop + 26, T.figure), T.figure);
    c.text('in hand a month', x + pad, baseline(cardTop + 45, T.small), T.small);
    c.runs(
      [
        [money(r.tax.totalTax), T.body],
        [' tax a year', T.small],
      ],
      x + pad,
      baseline(cardTop + 60, T.body),
    );
  });

  const verdictY = baseline(cardTop + cardHeight + 12, T.body);
  if (saving >= 0.5) {
    c.runs(
      [
        [`The ${REGIME_LABEL[result.better].toLowerCase()} saves you `, T.body],
        [money(saving), tint(T.strong, COLOR.accent)],
        [' a year.', T.body],
      ],
      LEFT,
      verdictY,
    );
  } else {
    c.text('Both regimes come to the same tax.', LEFT, verdictY, T.body);
  }
  c.y = top + height;
}

/** Where the CTC goes: one stacked bar, take-home in the accent and the rest in two greys. */
function drawComposition(c: Canvas, result: CalculationResult): void {
  const total = result.structure.annual.ctcComponents;
  if (total <= 0) return;

  const best = result.regimes[result.better];
  const takeHome = Math.max(0, Math.round(best.annualTakeHome));
  const tax = Math.max(0, Math.round(best.tax.totalTax));
  const rest = Math.max(0, Math.round(total) - takeHome - tax);
  const segments = [
    { label: 'Reaches your bank', value: takeHome, color: COLOR.accent },
    { label: 'Income tax', value: tax, color: COLOR.chartTax },
    { label: 'PF, gratuity and other', value: rest, color: COLOR.chartRest },
  ].filter((s) => s.value > 0);

  const barHeight = 10;
  const legendHeight = 12 + 16 + 10;
  const height = 16 + HEADING_GAP + barHeight + 14 + legendHeight;
  const top = c.begin(height);
  c.text(
    `Where your ${formatCompactRupees(total)} CTC goes`,
    LEFT,
    baseline(top, T.heading),
    T.heading,
  );

  // Segments with 2pt white gaps, rounded only at the two outer ends.
  const gap = 2;
  const barTop = top + 16 + HEADING_GAP;
  const available = WIDTH - gap * (segments.length - 1);
  const radius = 2;
  let x = LEFT;
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    // The last segment takes whatever is left, so rounding never leaves a sliver at the end.
    const width = last ? RIGHT - x : Math.max(2, (seg.value / total) * available);
    const r = Math.min(radius, width / 2);
    c.segment(x, barTop, width, barHeight, seg.color, i === 0 ? r : 0, last ? r : 0);
    x += width + gap;
  });

  // Direct-labelled legend, one column per segment, in bar order.
  const legendTop = barTop + barHeight + 14;
  const columnWidth = (WIDTH - 2 * 16) / 3;
  segments.forEach((seg, i) => {
    const cx = LEFT + i * (columnWidth + 16);
    const labelY = baseline(legendTop, T.body);
    c.box(cx, labelY - 7, 7, 7, seg.color, 1.5);
    c.text(seg.label, cx + 12, labelY, T.body);
    c.text(money(seg.value), cx + 12, baseline(legendTop + 12, T.amount), T.amount);
    c.text(
      `${((seg.value / total) * 100).toFixed(1)}% of CTC`,
      cx + 12,
      baseline(legendTop + 28, T.small),
      T.small,
    );
  });
  c.y = top + height;
}

/* Ledgers ------------------------------------------------------------------------------------ */

type Cell = number | null;

interface LedgerRow {
  label: string;
  hint?: string;
  cells: Cell[];
  /** carry: a figure brought forward from another table; total: stronger rule above. */
  kind: 'row' | 'carry' | 'total';
}

interface Ledger {
  title: string;
  columns: string[];
  /** Index of a column to mark in the accent (the cheaper regime). */
  accentColumn?: number;
  rows: LedgerRow[];
}

const VALUE_COLUMN = 92;
const ROW_PAD = 4;
/** Title, gap, then the column captions over a dashed rule. */
const LEDGER_HEAD = 16 + HEADING_GAP + 16;

/** Wraps every row once, up front, so heights are known before anything is drawn. */
function measureRows(c: Canvas, ledger: Ledger) {
  const labelWidth = WIDTH - ledger.columns.length * VALUE_COLUMN - 12;
  return ledger.rows.map((row) => {
    const labelStyle =
      row.kind === 'total' ? T.strong : row.kind === 'carry' ? tint(T.body, COLOR.ink3) : T.body;
    const label = c.wrap(row.label, labelStyle, labelWidth);
    const hint = row.hint ? c.wrap(row.hint, T.small, labelWidth) : [];
    const padTop = row.kind === 'total' ? 8 : ROW_PAD;
    const height = snap(padTop + label.length * 12 + hint.length * 10 + ROW_PAD);
    return { row, label, hint, padTop, height, labelStyle };
  });
}

function drawLedgerHead(c: Canvas, ledger: Ledger, top: number, continued: boolean): void {
  const title = continued ? `${ledger.title}, continued` : ledger.title;
  c.text(title, LEFT, baseline(top, T.heading), T.heading);
  const headTop = top + 16 + HEADING_GAP;
  const y = baseline(headTop, T.small) - 2;
  c.text('Component', LEFT, y, T.small);
  ledger.columns.forEach((label, i) => {
    const right = RIGHT - (ledger.columns.length - 1 - i) * VALUE_COLUMN;
    const accent = i === ledger.accentColumn;
    c.text(label, right, y, accent ? tint(T.label, COLOR.accent) : T.small, 'right');
  });
  c.rule(LEFT, RIGHT, headTop + 12, COLOR.lineStrong, 0.75, [1.5, 1.5]);
}

/**
 * The site's ledger: a dashed rule under the captions, hairlines between rows, none after the
 * last, and the total set at 535 below a stronger rule. Amounts are right-aligned; Plex's default
 * figures are tabular, so the columns line up digit for digit.
 */
function drawLedger(c: Canvas, ledger: Ledger): void {
  const rows = measureRows(c, ledger);
  if (rows.length === 0) return;

  // A table that fits on a page is never split: it moves whole to the next page. Only a table
  // taller than a page breaks, keeping its heading with at least the first three rows.
  const height = (list: typeof rows) => list.reduce((sum, r) => sum + r.height, 0);
  const whole = LEDGER_HEAD + height(rows);
  const keep =
    whole <= CONTENT_BOTTOM - NEXT_PAGE_TOP ? whole : LEDGER_HEAD + height(rows.slice(0, 3));
  const top = c.begin(keep);
  drawLedgerHead(c, ledger, top, false);
  c.y = top + LEDGER_HEAD;

  rows.forEach((geo, i) => {
    const next = rows[i + 1];
    // A total never starts a page on its own; it moves with the row above it.
    const need = geo.height + (next?.row.kind === 'total' ? next.height : 0);
    const breaks = c.y + need > CONTENT_BOTTOM;
    if (breaks) {
      c.newPage();
      drawLedgerHead(c, ledger, c.y, true);
      c.y += LEDGER_HEAD;
    }

    const { row } = geo;
    const rowTop = c.y;
    if (row.kind === 'total') c.rule(LEFT, RIGHT, rowTop, COLOR.lineStrong, 0.75);
    else if (i > 0 && !breaks) c.rule(LEFT, RIGHT, rowTop, COLOR.line);

    const first = baseline(rowTop + geo.padTop, geo.labelStyle);
    geo.label.forEach((line, j) => c.text(line, LEFT, first + j * 12, geo.labelStyle));
    const hintTop = first + (geo.label.length - 1) * 12 + 10.5;
    geo.hint.forEach((line, j) => c.text(line, LEFT, hintTop + j * 10, T.small));

    const valueStyle =
      row.kind === 'total' ? T.strong : row.kind === 'carry' ? tint(T.value, COLOR.ink3) : T.value;
    row.cells.forEach((cell, j) => {
      const right = RIGHT - (row.cells.length - 1 - j) * VALUE_COLUMN;
      if (cell === null) c.text('–', right, first, tint(T.value, COLOR.ink3), 'right');
      else c.text(money(cell), right, first, valueStyle, 'right');
    });
    c.y = rowTop + geo.height;
  });
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

function detailLedgers(result: CalculationResult): Ledger[] {
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
function taxLedgers(result: CalculationResult): Ledger[] {
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

/* Closing blocks ----------------------------------------------------------------------------- */

/** Only drawn when the offer has no gratuity line in its CTC to carry the projection. */
function drawGratuity(c: Canvas, result: CalculationResult): void {
  if (result.input.gratuityInCtc && result.structure.annual.gratuity > 0) return;
  const g = result.gratuityProjection;
  const text = g.eligible
    ? `You would receive about ${money(g.amount)} in gratuity after ${g.countedYears} years, based on ${money(
        result.structure.wages.wages,
      )} a month of Labour Code wages.`
    : `Gratuity needs ${g.minimumYears} years of service. It is part of your CTC but you receive nothing before then.`;
  const lines = c.wrap(text, T.body, WIDTH);
  const top = c.begin(16 + HEADING_GAP + lines.length * 12);
  c.text('Gratuity', LEFT, baseline(top, T.heading), T.heading);
  c.y = top + 16 + HEADING_GAP + c.paragraph(lines, LEFT, top + 16 + HEADING_GAP, T.body);
}

/** Each note has a thin amber rule beside it, the page's only use of a warning colour. */
function drawNotes(c: Canvas, notices: string[]): void {
  if (notices.length === 0) return;
  const indent = 12;
  const gap = 12;
  notices.forEach((notice, i) => {
    const lines = c.wrap(notice, T.body, WIDTH - indent);
    const noteHeight = lines.length * 12;
    const head = i === 0 ? 16 + HEADING_GAP : 0;
    const top = c.begin(head + noteHeight, i === 0 ? SECTION_GAP : gap);
    if (i === 0) c.text('Notes on your numbers', LEFT, baseline(top, T.heading), T.heading);
    const noteTop = top + head;
    c.box(LEFT, noteTop + 1, 2, noteHeight - 2, COLOR.warn);
    c.paragraph(lines, LEFT + indent, noteTop, T.body);
    c.y = noteTop + noteHeight;
  });
}

function drawErrors(c: Canvas, errors: string[]): void {
  c.text('This structure does not add up', LEFT, baseline(c.y, T.heading), T.heading);
  c.y += 16 + HEADING_GAP;
  for (const error of errors) {
    const lines = c.wrap(error, T.body, WIDTH);
    c.y += c.paragraph(lines, LEFT, c.y, T.body) + 8;
  }
}

/* Entry point -------------------------------------------------------------------------------- */

export function buildPdf(
  result: CalculationResult,
  fonts: PdfFontFiles,
  options: BuildPdfOptions = {},
): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  registerFonts(pdf, fonts);
  // jsPDF's type lists a fixed set of tags without en-IN, but writes any BCP 47 tag it is given.
  pdf.setLanguage('en-IN' as Parameters<jsPDF['setLanguage']>[0]);
  pdf.setProperties({
    title: `${SITE.name} ${DOC_TITLE.toLowerCase()}, ${SITE.shortYearLabel}`,
    subject: `CTC to in-hand salary, ${SITE.taxYearLabel}`,
    author: SITE.name,
    creator: SITE.url,
  });

  const c = new Canvas(pdf);
  drawFirstHeader(c);

  if (result.errors.length > 0) {
    drawErrors(c, result.errors);
  } else {
    drawHero(c, result, options.shareUrl);
    drawMarginalRelief(c, result);
    drawRegimes(c, result);
    drawComposition(c, result);
    // The caveats come before the ledgers, as on the page: they change how the figures should be read.
    drawNotes(c, result.notices);
    for (const ledger of detailLedgers(result)) drawLedger(c, ledger);
    drawGratuity(c, result);
    for (const ledger of taxLedgers(result)) drawLedger(c, ledger);
  }

  const pages = pdf.getNumberOfPages();
  const preparedOn = options.generatedOn ?? new Date();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    if (page > 1) drawRunningHeader(c);
    drawFooter(c, page, pages, preparedOn);
  }
  return pdf;
}

/** "inhand-salary-breakdown-12-lakh.pdf" */
export function pdfFileName(result: CalculationResult): string {
  const ctc = formatCompactRupees(result.input.ctc)
    .replace('₹', '')
    .replace(' L', '-lakh')
    .replace(' Cr', '-crore')
    .replace(/[^\w.-]+/g, '-');
  return `${SITE.name.toLowerCase()}-salary-breakdown-${ctc}.pdf`;
}
