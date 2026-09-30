/**
 * PDF export. Loaded on demand, so jsPDF and the report fonts never reach someone who does not
 * export. The layout lives in src/lib/pdf/build-pdf.ts; this file only fetches and saves.
 */

import { buildPdf, pdfFileName } from '../lib/pdf/build-pdf';
import { loadPdfFonts } from '../lib/pdf/load-fonts';
import type { CalculationResult } from '../lib/tax/calculate';

export interface ExportPdfOptions {
  /** A link that reopens this calculation, printed in the report as "Reopen this calculation". */
  shareUrl?: string;
}

export async function exportPdf(
  result: CalculationResult,
  options: ExportPdfOptions = {},
): Promise<void> {
  const fonts = await loadPdfFonts();
  buildPdf(result, fonts, { shareUrl: options.shareUrl }).save(pdfFileName(result));
}
