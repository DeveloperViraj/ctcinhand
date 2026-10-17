/**
 * Builds the Excel workbook in Node for a spread of salaries, writes it out and reads it back.
 *
 * Every run also writes the files, so the layout can be inspected by eye:
 *   PDF_SAMPLE_DIR=<folder> node node_modules/vitest/vitest.mjs run src/lib/excel
 */

import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportFileName } from '../export-data';
import { calculate, type CalculatorInput } from '../tax/calculate';
import { DEFAULT_INPUT } from '../tax/defaults';
import { buildWorkbook, INDIAN } from './build-workbook';

const sampleDir = process.env.PDF_SAMPLE_DIR ?? join(tmpdir(), 'ctc-xlsx-samples');
const preparedOn = new Date(2026, 9, 17);
const input = (overrides: Partial<CalculatorInput>): CalculatorInput => ({
  ...DEFAULT_INPUT,
  ...overrides,
});

const scenarios: { name: string; input: CalculatorInput }[] = [
  { name: 'a-default-12-lakh', input: DEFAULT_INPUT },
  { name: 'b-14-lakh-joining-bonus', input: input({ ctc: 15_00_000, joiningBonus: 1_00_000 }) },
  {
    name: 'c-30-lakh-mumbai-variable',
    input: input({
      ctc: 30_00_000,
      stateCode: 'MH',
      city: 'Mumbai',
      monthlyRent: 40_000,
      variable: { unit: 'percent', value: 10 },
    }),
  },
  {
    name: 'd-3-lakh-west-bengal-esi',
    input: input({ ctc: 3_00_000, stateCode: 'WB', city: 'Kolkata' }),
  },
];

async function roundTrip(wb: ExcelJS.Workbook, name: string): Promise<ExcelJS.Workbook> {
  const buffer = await wb.xlsx.writeBuffer();
  mkdirSync(sampleDir, { recursive: true });
  writeFileSync(join(sampleDir, `${name}.xlsx`), Buffer.from(buffer));
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buffer);
  return back;
}

const numeric = (v: ExcelJS.CellValue): number =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'result' in v ? Number(v.result) : NaN;

/** The row whose label (column B) starts with `label`. */
function rowOf(ws: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  ws.eachRow((row) => {
    if (!found && String(row.getCell(2).value ?? '').startsWith(label)) found = row;
  });
  if (!found) throw new Error(`No row labelled ${label}`);
  return found;
}

describe('Excel workbook', () => {
  it.each(scenarios)('$name', async ({ name, input: i }) => {
    const result = calculate(i);
    expect(result.errors).toEqual([]);
    const wb = await roundTrip(
      buildWorkbook(result, { generatedOn: preparedOn, shareUrl: 'https://example.test/?c=1' }),
      name,
    );
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Salary breakdown']);
    const ws = wb.worksheets[0];
    const best = result.regimes[result.better];

    // In hand = gross (A) - deductions (B), as live formulas whose cached results match the page.
    const gross = rowOf(ws, 'Gross salary (A)');
    const deducted = rowOf(ws, 'Total deductions (B)');
    const inHand = rowOf(ws, 'In-hand salary');
    const formula = (cell: ExcelJS.Cell) => (cell.value as ExcelJS.CellFormulaValue).formula;
    expect(formula(inHand.getCell(3))).toBe(`C${gross.number}-C${deducted.number}`);
    expect(numeric(inHand.getCell(3).value)).toBe(Math.round(best.monthlyTakeHome));
    expect(numeric(inHand.getCell(4).value)).toBe(
      Math.round(best.annualTakeHome - result.structure.annual.variable),
    );

    // Every SUM's cached result is the sum of the rows it covers, so Excel's recalculation agrees.
    for (const row of [gross, deducted]) {
      for (const c of [3, 4]) {
        const cell = row.getCell(c);
        const [, column, from, to] = /SUM\(([A-Z])(\d+):[A-Z](\d+)\)/.exec(formula(cell))!;
        let total = 0;
        for (let r = Number(from); r <= Number(to); r++)
          total += numeric(ws.getCell(`${column}${r}`).value);
        expect(numeric(cell.value)).toBe(total);
      }
    }

    // Both regimes, the cheaper one named when one is cheaper (at 3 lakh both owe nothing).
    const regime = result.better === 'new' ? 'New regime' : 'Old regime';
    const tie = result.savingByChoosingBetter < 1;
    const better = rowOf(ws, tie ? regime : `${regime} (lower tax)`);
    expect(numeric(better.getCell(3).value)).toBe(Math.round(best.tax.totalTax));
    expect(numeric(better.getCell(4).value)).toBe(Math.round(best.monthlyTakeHome));
  });

  it('looks like a plain hand-made sheet: orange captions, black boxes, yellow result', () => {
    const ws = buildWorkbook(calculate(DEFAULT_INPUT), { generatedOn: preparedOn }).worksheets[0];
    const caption = rowOf(ws, 'Component').getCell(2);
    expect((caption.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFF9CB9C');
    expect(caption.border.top?.style).toBe('thin');
    expect(caption.font.name).toBe('Arial');
    const result = rowOf(ws, 'In-hand salary').getCell(3);
    expect((result.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFFF2CC');
    // Lakh grouping (ExcelJS drops the escapes when it reads a file back, so check before saving).
    expect(result.numFmt).toBe(INDIAN);
    expect(ws.getImages()).toHaveLength(0);
  });

  it('explains a structure that does not add up instead of printing numbers', () => {
    const result = calculate(input({ basic: { unit: 'percent', value: 120 } }));
    const ws = buildWorkbook(result, { generatedOn: preparedOn }).worksheets[0];
    expect(String(ws.getCell('B2').value)).toContain('does not add up');
    expect(() => rowOf(ws, 'In-hand salary')).toThrow();
  });

  it('names the file after the CTC', () => {
    expect(exportFileName(calculate(DEFAULT_INPUT), 'xlsx')).toBe(
      'ctc-salary-breakdown-12-lakh.xlsx',
    );
  });
});
