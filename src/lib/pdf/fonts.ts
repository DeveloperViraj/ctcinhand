/**
 * Fonts for the PDF report: two static cuts of IBM Plex Sans (the site's typeface), renamed and
 * subset by scripts/build-pdf-fonts.py. Together they weigh about 20 KB.
 *
 * Loading the files is left to the caller (see load-fonts.ts for the browser), so the report can
 * be built in Node from bytes read off disk.
 */

import type { jsPDF } from 'jspdf';
import charset from '../../assets/pdf-fonts/charset.json';

/** Raw TrueType bytes for each weight. */
export interface PdfFontFiles {
  /** Body text, weight 435. */
  text: Uint8Array;
  /** Headings, figures and totals, weight 535. */
  medium: Uint8Array;
}

export const FONT_FAMILY = 'InHandSans';

/**
 * jsPDF knows only "normal" and "bold" styles, so the medium cut is registered as "bold". It is
 * still 535, not a heavy bold.
 */
export type FontWeight = 'normal' | 'bold';

export function registerFonts(pdf: jsPDF, fonts: PdfFontFiles): void {
  const files: [string, Uint8Array, FontWeight][] = [
    ['report-sans-text.ttf', fonts.text, 'normal'],
    ['report-sans-medium.ttf', fonts.medium, 'bold'],
  ];
  for (const [name, bytes, weight] of files) {
    pdf.addFileToVFS(name, toBase64(bytes));
    pdf.addFont(name, FONT_FAMILY, weight, undefined, 'Identity-H');
  }
}

/** btoa works on byte strings; chunk the conversion so large files do not overflow the stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const DRAWABLE = new Set(charset.chars);

/** Close stand-ins for characters the subset leaves out, so text never loses meaning. */
const FALLBACK: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '≤': '<=',
  '≥': '>=',
  '×': 'x',
  '‑': '-',
  '‐': '-',
  '­': '',
};

/**
 * Prepares a string for drawing. Engine messages write "Rs" because other outputs may lack the
 * glyph; this font has it. Anything the subset cannot draw is replaced, because jsPDF silently
 * drops the rest of a string after the first character it has no glyph for.
 */
export function toPdfText(text: string): string {
  const withRupee = text.replace(/\bRs\.? ?(?=[\d₹])/g, '₹');
  let out = '';
  for (const char of withRupee.normalize('NFC')) {
    if (DRAWABLE.has(char)) {
      out += char;
      continue;
    }
    if (char in FALLBACK) {
      out += FALLBACK[char];
      continue;
    }
    // Accented Latin letters lose their accent rather than the whole character.
    const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += [...base].every((c) => DRAWABLE.has(c)) ? base : /\s/.test(char) ? ' ' : '?';
  }
  return out;
}
