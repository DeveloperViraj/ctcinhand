/**
 * Excel export. Loaded on demand, so ExcelJS stays out of the page's own bundle until someone
 * clicks the button. The workbook itself is built by src/lib/excel/build-workbook.ts.
 */

import { buildWorkbook } from '../lib/excel/build-workbook';
import { exportFileName } from '../lib/export-data';
import type { CalculationResult } from '../lib/tax/calculate';

export async function exportExcel(
  result: CalculationResult,
  options: { shareUrl?: string } = {},
): Promise<void> {
  const workbook = buildWorkbook(result, { shareUrl: options.shareUrl });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(result, 'xlsx');
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
