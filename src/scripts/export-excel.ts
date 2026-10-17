/**
 * Excel export. Loaded on demand, so ExcelJS stays out of the page's own bundle until someone
 * clicks the button. The workbook itself is built by src/lib/excel/build-workbook.ts.
 */

import { buildWorkbook } from '../lib/excel/build-workbook';
import { exportFileName } from '../lib/export-data';
import type { CalculationResult } from '../lib/tax/calculate';

/** The site's mark as a data URL, for the workbook's title. Left out if it cannot be fetched. */
async function loadLogo(): Promise<string | undefined> {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function exportExcel(
  result: CalculationResult,
  options: { shareUrl?: string } = {},
): Promise<void> {
  const workbook = buildWorkbook(result, { shareUrl: options.shareUrl, logo: await loadLogo() });
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
