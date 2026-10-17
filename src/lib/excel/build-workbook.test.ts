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
import { buildWorkbook } from './build-workbook';

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

describe('Excel workbook', () => {
  it.each(scenarios)('$name', async ({ name, input: i }) => {
    const result = calculate(i);
    expect(result.errors).toEqual([]);
    const wb = await roundTrip(
      buildWorkbook(result, { generatedOn: preparedOn, shareUrl: 'https://example.test/?c=1' }),
      name,
    );

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Summary',
      'Breakdown',
      'Tax working',
      'Month by month',
    ]);

    const best = result.regimes[result.better];
    const summary = wb.getWorksheet('Summary')!;
    expect(summary.getCell('B6').value).toBe(Math.round(best.monthlyTakeHome));
    expect(summary.getCell('B6').numFmt).toContain('₹');
    expect(summary.getCell('B2').value).toBe('CTC Salary Calculator');

    // The month-by-month year adds up to the year's fixed in-hand, as live formulas.
    const months = wb.getWorksheet('Month by month')!;
    const yearCell = months.getCell('H19');
    expect((yearCell.value as ExcelJS.CellFormulaValue).formula).toBe('SUM(H7:H18)');
    expect(numeric(yearCell.value)).toBe(
      Math.round(best.annualTakeHome - result.structure.annual.variable),
    );
    expect((months.getCell('H7').value as ExcelJS.CellFormulaValue).formula).toBe('SUM(C7:G7)');

    // Every ledger total in the breakdown equals the sum of its rows (rounded as on a payslip).
    const breakdown = wb.getWorksheet('Breakdown')!;
    let rows: number[] = [];
    breakdown.eachRow((row) => {
      const label = String(row.getCell(2).value ?? '');
      const perYear = row.getCell(4).value;
      if (typeof perYear !== 'number') {
        rows = [];
        return;
      }
      const isTotal = row.getCell(2).font?.bold === true;
      if (isTotal) {
        expect(Math.abs(rows.reduce((a, b) => a + b, 0) - perYear), label).toBeLessThanOrEqual(1);
        rows = [];
      } else {
        rows.push(perYear);
      }
    });
  });

  it('uses the site palette for captions and totals', () => {
    const wb = buildWorkbook(calculate(DEFAULT_INPUT), { generatedOn: preparedOn });
    const summary = wb.getWorksheet('Summary')!;
    const band = summary.getCell('A1').fill as ExcelJS.FillGradientAngle;
    expect(band.type).toBe('gradient');
    expect(band.stops.map((s) => s.color.argb)).toEqual(['FFF69835', 'FF0B7643', 'FF183680']);
    expect(summary.views[0].showGridLines).toBe(false);
  });

  it('explains a structure that does not add up instead of printing numbers', () => {
    const result = calculate(input({ basic: { unit: 'percent', value: 120 } }));
    const wb = buildWorkbook(result, { generatedOn: preparedOn });
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Summary']);
    expect(String(wb.getWorksheet('Summary')!.getCell('B5').value)).toContain('does not add up');
  });

  it('names the file after the CTC', () => {
    expect(exportFileName(calculate(DEFAULT_INPUT), 'xlsx')).toBe(
      'ctc-salary-breakdown-12-lakh.xlsx',
    );
  });
});
