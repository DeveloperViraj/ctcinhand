/**
 * PDF export. Loaded on demand, so jsPDF never reaches someone who does not export.
 *
 * jsPDF's built-in fonts have no rupee glyph (U+20B9), so amounts are written as "Rs" rather than
 * rendering a blank box. Embedding a font with the glyph would add roughly 300 KB to the bundle.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SITE } from '../config/site';
import { buildExportDocument, monthlyInHand } from '../lib/export-data';
import type { CalculationResult } from '../lib/tax/calculate';

const rs = (amount: number) => `Rs ${Math.round(Math.abs(amount)).toLocaleString('en-IN')}`;
const signed = (amount: number) => (amount < 0 ? `- ${rs(amount)}` : rs(amount));

export async function exportPdf(result: CalculationResult): Promise<void> {
  const doc = buildExportDocument(result);
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  let y = margin;

  pdf.setFont('helvetica', 'bold').setFontSize(18).setTextColor(17, 24, 30);
  pdf.text(doc.title, margin, y);
  y += 18;

  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 100, 110);
  pdf.text(doc.subtitle, margin, y);
  y += 26;

  const headline = rs(monthlyInHand(result));
  pdf.setFont('helvetica', 'bold').setFontSize(24).setTextColor(11, 110, 135);
  // Measure while the 24pt font is still active: measuring after switching to 10pt returns a
  // width about 40% too small, which is what made the caption overlap the figure.
  const headlineWidth = pdf.getTextWidth(headline);
  pdf.text(headline, margin, y);
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 100, 110);
  pdf.text('per month in hand', margin + headlineWidth + 8, y);
  y += 24;

  for (const section of doc.sections) {
    const body = section.rows.map((r) => [
      r.label + (r.note ? `\n${r.note}` : ''),
      signed(r.value),
    ]);
    if (section.total) body.push([section.total.label, rs(section.total.value)]);

    autoTable(pdf, {
      startY: y,
      head: [[section.title, '']],
      body,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: [55, 65, 75] },
      headStyles: { fillColor: [244, 247, 249], textColor: [17, 24, 30], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 120 } },
      didParseCell: (data) => {
        if (section.total && data.row.index === body.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [17, 24, 30];
        }
      },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  if (doc.notices.length) {
    pdf.setFontSize(9).setTextColor(120, 85, 20);
    for (const notice of doc.notices) {
      const lines = pdf.splitTextToSize(`• ${notice}`, 515 - margin);
      if (y > 760) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(lines, margin, y);
      y += lines.length * 11 + 4;
    }
  }

  pdf.setFontSize(8).setTextColor(130, 140, 150);
  pdf.text(doc.footer, margin, 812);

  pdf.save(`${SITE.name.toLowerCase()}-salary-breakdown.pdf`);
}
