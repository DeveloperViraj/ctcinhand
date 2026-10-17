/**
 * Builds the PDF report in Node for a spread of salaries and reads the text back out of it.
 *
 * Every run also writes the files, so the layout can be inspected by eye:
 *   PDF_SAMPLE_DIR=<folder> node node_modules/vitest/vitest.mjs run src/lib/pdf
 * Without PDF_SAMPLE_DIR they go to <os tmpdir>/ctc-pdf-samples.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { SITE } from '../../config/site';
import { formatNumber } from '../format';
import { calculate, type CalculatorInput } from '../tax/calculate';
import { DEFAULT_INPUT } from '../tax/defaults';
import { encodeState } from '../url-state';
import { buildPdf, pdfFileName, roundColumn } from './build-pdf';
import { toPdfText, type PdfFontFiles } from './fonts';

const fontDir = new URL('../../assets/pdf-fonts/', import.meta.url);
const fonts: PdfFontFiles = {
  text: readFileSync(new URL('report-sans-text.ttf', fontDir)),
  medium: readFileSync(new URL('report-sans-medium.ttf', fontDir)),
  display: readFileSync(new URL('report-display.ttf', fontDir)),
};
const sampleDir = process.env.PDF_SAMPLE_DIR ?? join(tmpdir(), 'ctc-pdf-samples');
const preparedOn = new Date(2026, 8, 28);

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/** Every object's dictionary and (inflated) stream, by object number. */
function readObjects(pdf: ArrayBuffer): Map<number, { dict: string; stream?: string }> {
  const raw = latin1(new Uint8Array(pdf));
  const objects = new Map<number, { dict: string; stream?: string }>();
  for (const match of raw.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) {
    const body = match[2];
    const start = body.indexOf('stream');
    if (start === -1) {
      objects.set(Number(match[1]), { dict: body });
      continue;
    }
    const dict = body.slice(0, start);
    const data = body.slice(body.indexOf('\n', start) + 1, body.lastIndexOf('endstream'));
    const bytes = Buffer.from(data, 'latin1');
    const stream = /FlateDecode/.test(dict) ? inflateSync(bytes).toString('latin1') : data;
    objects.set(Number(match[1]), { dict, stream });
  }
  return objects;
}

/** A ToUnicode CMap stream as glyph id -> character. */
function readToUnicode(stream: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const [, gid, code] of stream.matchAll(/<([0-9a-f]{4})><([0-9a-f]{4})>/gi)) {
    map.set(parseInt(gid, 16), String.fromCharCode(parseInt(code, 16)));
  }
  return map;
}

/**
 * Text per page, decoded through each font's ToUnicode map, which is exactly what a viewer does on
 * copy and paste. The text and display faces have different glyph ids, so the reader follows the
 * font selections (Tf) through the content stream.
 */
function pageTexts(pdf: ArrayBuffer): string[] {
  const objects = readObjects(pdf);
  const fonts = new Map<string, Map<number, string>>();
  for (const { dict } of objects.values()) {
    const resources = /\/Font\s*<<([^>]*)>>/.exec(dict);
    if (!resources) continue;
    for (const [, name, ref] of resources[1].matchAll(/\/(\w+)\s+(\d+) 0 R/g)) {
      const toUnicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(ref))!.dict);
      if (toUnicode) fonts.set(name, readToUnicode(objects.get(Number(toUnicode[1]))!.stream!));
    }
  }

  const pages = [...objects.values()]
    .filter(({ dict }) => /\/Type\s*\/Page\b/.test(dict))
    .map(({ dict }) => Number(/\/Contents (\d+) 0 R/.exec(dict)![1]));
  return pages.map((ref) => {
    const content = objects.get(ref)!.stream ?? '';
    let font = new Map<number, string>();
    const lines: string[] = [];
    for (const m of content.matchAll(/\/(\w+) [\d.]+ Tf|<([0-9a-fA-F]*)>\s*Tj/g)) {
      if (m[1]) {
        font = fonts.get(m[1]) ?? new Map();
        continue;
      }
      const gids = m[2].match(/.{4}/g) ?? [];
      lines.push(gids.map((gid) => font.get(parseInt(gid, 16)) ?? '�').join(''));
    }
    return lines.join('\n');
  });
}

const input = (overrides: Partial<CalculatorInput>): CalculatorInput => ({
  ...DEFAULT_INPUT,
  ...overrides,
});
const shareUrl = (i: CalculatorInput, mode: 'quick' | 'advanced' = 'quick') =>
  `${SITE.url}/?${encodeState({ mode, input: i })}`;

const scenarios: { name: string; input: CalculatorInput; mode?: 'quick' | 'advanced' }[] = [
  { name: 'a-default-12-lakh', input: DEFAULT_INPUT },
  { name: 'b-14-lakh-marginal-relief', input: input({ ctc: 14_00_000 }) },
  {
    name: 'c-30-lakh-mumbai-old-regime-claims',
    input: input({
      ctc: 30_00_000,
      stateCode: 'MH',
      city: 'Mumbai',
      monthlyRent: 35_000,
      deductions: { ...DEFAULT_INPUT.deductions, sec80C: 1_50_000, selfOccupiedInterest: 2_00_000 },
    }),
  },
  {
    name: 'd-3-lakh-west-bengal-esi',
    input: input({ ctc: 3_00_000, stateCode: 'WB', city: 'Kolkata' }),
  },
  { name: 'e-60-lakh-surcharge', input: input({ ctc: 60_00_000 }) },
  {
    name: 'f-basic-30-percent-labour-code',
    mode: 'advanced',
    input: input({
      ctc: 18_00_000,
      basic: { unit: 'percent', value: 30 },
      variable: { unit: 'percent', value: 10 },
    }),
  },
  {
    name: 'g-old-regime-wins',
    mode: 'advanced',
    input: input({
      ctc: 20_00_000,
      stateCode: 'MH',
      city: 'Mumbai',
      monthlyRent: 50_000,
      employerNps: { unit: 'percent', value: 10 },
      deductions: {
        sec80C: 1_50_000,
        nps80CCD1B: 50_000,
        healthInsurance: 75_000,
        selfOccupiedInterest: 2_00_000,
      },
    }),
  },
];

describe('PDF report', () => {
  mkdirSync(sampleDir, { recursive: true });

  it.each(scenarios)('$name', ({ name, input: i, mode }) => {
    const result = calculate(i);
    expect(result.errors).toEqual([]);

    const pdf = buildPdf(result, fonts, { shareUrl: shareUrl(i, mode), generatedOn: preparedOn });
    const bytes = pdf.output('arraybuffer');
    writeFileSync(join(sampleDir, `${name}.pdf`), Buffer.from(bytes));

    const pages = pageTexts(bytes);
    const all = pages.join('\n');
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(all).not.toContain('�');

    // The headline figure, with a real rupee sign rather than "Rs".
    const monthly = `₹${formatNumber(result.regimes[result.better].monthlyTakeHome)}`;
    expect(all).toContain(monthly);
    expect(all).not.toMatch(/\bRs\b/);

    // Every page carries the footer.
    pages.forEach((text, index) => {
      expect(text).toContain(`Page ${index + 1} of ${pages.length}`);
      expect(text).toContain(SITE.domain);
    });

    for (const notice of result.notices) {
      expect(all.replace(/\s+/g, ' ')).toContain(toPdfText(notice).slice(0, 40));
    }
    expect(all).toContain('Reopen this calculation');
  });

  it('says why a structure that does not add up has no figures', () => {
    const result = calculate(input({ basic: { unit: 'percent', value: 120 } }));
    expect(result.errors.length).toBeGreaterThan(0);
    const text = pageTexts(buildPdf(result, fonts).output('arraybuffer')).join('\n');
    expect(text).toContain('This structure does not add up');
  });

  it('shows the marginal-relief callout only when relief applies', () => {
    const text = (ctc: number) =>
      pageTexts(buildPdf(calculate(input({ ctc })), fonts).output('arraybuffer')).join('\n');
    expect(text(14_00_000)).toContain('Marginal relief applied');
    expect(text(12_00_000)).not.toContain('Marginal relief applied');
  });

  it('names the file after the CTC', () => {
    expect(pdfFileName(calculate(DEFAULT_INPUT))).toBe('ctc-salary-breakdown-12-lakh.pdf');
    expect(pdfFileName(calculate(input({ ctc: 1_25_00_000 })))).toBe(
      'ctc-salary-breakdown-1.25-crore.pdf',
    );
  });
});

describe('roundColumn', () => {
  it('makes rounded rows add up to the rounded total', () => {
    const rows = roundColumn([10.4, 10.4, 10.4], 31);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(31);
  });

  it('leaves pinned rows alone', () => {
    expect(roundColumn([100.6, -20.4, -20.4], 60, [true, false, false])).toEqual([101, -20, -21]);
  });

  it('falls back to plain rounding when the total cannot be reached', () => {
    expect(roundColumn([100, -150], 0)).toEqual([100, -150]);
  });
});

describe('toPdfText', () => {
  it('turns "Rs" amounts into the rupee sign', () => {
    expect(toPdfText('above Rs 21,000 a month')).toBe('above ₹21,000 a month');
  });

  it('replaces characters the font subset cannot draw instead of truncating', () => {
    expect(toPdfText('Café → 5 × 2 ≥ 10 ✓ done')).toBe('Cafe -> 5 x 2 >= 10 ? done');
  });
});
