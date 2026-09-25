/**
 * Excel export. Loaded on demand so SheetJS stays out of the initial bundle.
 *
 * Amounts are written as real numbers with an Indian currency format, so the file can be sorted
 * and summed rather than being a picture of a table.
 */

import { utils, writeFile, type WorkSheet } from 'xlsx';
import { SITE } from '../config/site';
import { buildExportDocument } from '../lib/export-data';
import type { CalculationResult } from '../lib/tax/calculate';

const CURRENCY = '[$₹-en-IN]##,##,##0';

export async function exportExcel(result: CalculationResult): Promise<void> {
  const doc = buildExportDocument(result);
  const rows: (string | number | null)[][] = [[doc.title], [doc.subtitle], []];

  for (const section of doc.sections) {
    rows.push([section.title, 'Amount (Rs/year)', 'Note']);
    for (const row of section.rows) rows.push([row.label, row.value, row.note ?? '']);
    if (section.total) rows.push([section.total.label, section.total.value, '']);
    rows.push([]);
  }

  if (doc.notices.length) {
    rows.push(['Notes']);
    for (const notice of doc.notices) rows.push([notice]);
    rows.push([]);
  }
  rows.push([doc.footer]);

  const sheet: WorkSheet = utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 60 }];

  // Apply the currency format to every numeric cell in the amount column.
  for (const ref of Object.keys(sheet)) {
    if (ref.startsWith('!')) continue;
    const cell = sheet[ref];
    if (cell && cell.t === 'n' && /^B\d+$/.test(ref)) cell.z = CURRENCY;
  }

  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Salary breakdown');
  writeFile(book, `${SITE.name.toLowerCase()}-salary-breakdown.xlsx`, { compression: true });
}
