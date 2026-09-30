/**
 * Fetches the report fonts in the browser. The files are emitted as hashed assets, so they are
 * requested only when someone exports a PDF and are cached like any other static file.
 */

import textUrl from '../../assets/pdf-fonts/report-sans-text.ttf?url';
import mediumUrl from '../../assets/pdf-fonts/report-sans-medium.ttf?url';
import type { PdfFontFiles } from './fonts';

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load a PDF font (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadPdfFonts(): Promise<PdfFontFiles> {
  const [text, medium] = await Promise.all([fetchBytes(textUrl), fetchBytes(mediumUrl)]);
  return { text, medium };
}
