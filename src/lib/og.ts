/**
 * Social preview cards (og:image), drawn at build time.
 *
 * satori lays the card out and writes an SVG with every glyph converted to an outline, so the
 * result does not depend on fonts installed on the build machine; sharp then rasterises it. None
 * of this reaches the browser: the output is a plain PNG per page.
 *
 * The card reuses the IBM Plex subsets cut for the PDF report (same typeface as the site).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { SITE } from '../config/site';

export interface OgCard {
  /** Output file: /og/<slug>.png */
  slug: string;
  title: string;
  /** A headline figure, e.g. "₹93,788". */
  figure?: string;
  figureCaption?: string;
  /** Shares of CTC for the composition stripe: take-home, tax, rest. Defaults to a neutral mix. */
  shares?: [number, number, number];
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const ogImagePath = (slug: string) => `/og/${slug}.png`;

const COLORS = {
  canvas: '#f4f8f6',
  ink: '#141c19',
  ink2: '#45524e',
  ink3: '#65716d',
  accent: '#12a06e',
  tax: '#4f5d59',
  rest: '#bfe6d3',
  onAccent: '#ffffff',
};

// Resolved from the project root: this module is bundled before it runs, so import.meta.url would
// point into the build output rather than at src/.
const fontPath = (name: string) => join(process.cwd(), 'src', 'assets', 'pdf-fonts', name);

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500; style: 'normal' }[]> | null =
  null;

function loadFonts() {
  fonts ??= Promise.all([
    readFile(fontPath('report-sans-text.ttf')),
    readFile(fontPath('report-sans-medium.ttf')),
  ]).then(([text, medium]) => [
    // satori matches on the CSS weight it is given, not on the file's own weight class.
    { name: 'Plex', data: text, weight: 400, style: 'normal' },
    { name: 'Plex', data: medium, weight: 500, style: 'normal' },
  ]);
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

function mark(): Node {
  // The favicon, redrawn: an outlined bar (CTC) beside a shorter filled one (what reaches you).
  return h(
    'div',
    {
      display: 'flex',
      width: 56,
      height: 56,
      borderRadius: 12,
      background: COLORS.accent,
      position: 'relative',
    },
    [
      h('div', {
        position: 'absolute',
        left: 15,
        top: 13,
        width: 10,
        height: 30,
        borderRadius: 3,
        border: `3px solid ${COLORS.onAccent}`,
      }),
      h('div', {
        position: 'absolute',
        left: 31,
        top: 21,
        width: 10,
        height: 22,
        borderRadius: 3,
        background: COLORS.onAccent,
      }),
    ],
  );
}

function card(c: OgCard): Node {
  const [take, tax, rest] = c.shares ?? [0.78, 0.08, 0.14];
  const stripe = h('div', { display: 'flex', width: '100%', height: 14, gap: 4 }, [
    h('div', { flexGrow: take, background: COLORS.accent, borderRadius: '7px 0 0 7px' }),
    ...(tax > 0 ? [h('div', { flexGrow: tax, background: COLORS.tax })] : []),
    h('div', { flexGrow: rest, background: COLORS.rest, borderRadius: '0 7px 7px 0' }),
  ]);

  return h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      padding: '64px 72px 56px',
      background: COLORS.canvas,
      fontFamily: 'Plex',
      color: COLORS.ink,
    },
    [
      h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        mark(),
        h('div', { fontSize: 34, fontWeight: 500, letterSpacing: '-0.01em' }, SITE.name),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 20 }, [
        h(
          'div',
          {
            fontSize: c.figure ? 50 : 64,
            fontWeight: 500,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            maxWidth: 1000,
          },
          c.title,
        ),
        ...(c.figure
          ? [
              h('div', { display: 'flex', alignItems: 'baseline', gap: 18 }, [
                h(
                  'div',
                  { fontSize: 96, fontWeight: 500, letterSpacing: '-0.03em', color: COLORS.ink },
                  c.figure,
                ),
                h('div', { fontSize: 32, color: COLORS.ink2 }, c.figureCaption ?? ''),
              ]),
            ]
          : []),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 22 }, [
        stripe,
        h(
          'div',
          { display: 'flex', justifyContent: 'space-between', fontSize: 26, color: COLORS.ink3 },
          [
            h('div', {}, `CTC to in-hand salary, ${SITE.taxYearLabel}`),
            h('div', { color: COLORS.accent, fontWeight: 500 }, SITE.domain),
          ],
        ),
      ]),
    ],
  );
}

export async function renderOgPng(c: OgCard): Promise<Buffer> {
  const svg = await satori(card(c) as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
}
