/**
 * Social preview cards (og:image), drawn at build time.
 *
 * satori lays the card out and writes an SVG with every glyph converted to an outline, so the
 * result does not depend on fonts installed on the build machine; sharp then rasterises it. None
 * of this reaches the browser: the output is a plain PNG per page.
 *
 * The card reuses the IBM Plex subsets cut for the PDF report (same typeface as the site).
 */

import { rosetteSvg } from './art';
import { BRAND, logoSvg } from './brand';
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
  canvas: '#fcfbf8',
  ink: '#1c2340',
  ink2: '#454c66',
  ink3: '#626a82',
  accent: '#0f8a5f',
  tax: '#2c3566',
  rest: '#bfe6d3',
  onAccent: '#ffffff',
};

// Resolved from the project root: this module is bundled before it runs, so import.meta.url would
// point into the build output rather than at src/.
const fontPath = (name: string) => join(process.cwd(), 'src', 'assets', 'pdf-fonts', name);

const ogFontPath = (name: string) => join(process.cwd(), 'src', 'assets', 'og-fonts', name);

type Font = { name: string; data: Buffer; weight: 400 | 500 | 700; style: 'normal' };
let fonts: Promise<Font[]> | null = null;

function loadFonts() {
  fonts ??= Promise.all([
    readFile(fontPath('report-sans-text.ttf')),
    readFile(fontPath('report-sans-medium.ttf')),
    readFile(ogFontPath('eczar-700-latin.ttf')),
    readFile(ogFontPath('eczar-700-latin-ext.ttf')),
  ]).then(([text, medium, eczar, eczarExt]): Font[] => [
    // satori matches on the CSS weight it is given, not on the file's own weight class.
    { name: 'Plex', data: text, weight: 400, style: 'normal' },
    { name: 'Plex', data: medium, weight: 500, style: 'normal' },
    // Headlines, as on the site. The rupee sign is in the Latin Extended file, so it is a fallback.
    { name: 'Eczar', data: eczar, weight: 700, style: 'normal' },
    { name: 'EczarExt', data: eczarExt, weight: 700, style: 'normal' },
  ]);
  return fonts;
}

/** The guilloche rosette in brand colours, as an image for the corner of each card. */
const rosette = () => {
  const coloured = rosetteSvg().replace('stroke="#000"', `stroke="${BRAND.green}"`);
  return `data:image/svg+xml;base64,${Buffer.from(coloured).toString('base64')}`;
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

function mark(): Node {
  // The site's mark (src/lib/brand.ts), as an SVG image.
  const src = `data:image/svg+xml;base64,${Buffer.from(logoSvg()).toString('base64')}`;
  return { type: 'img', props: { src, width: 56, height: 56, style: { borderRadius: 12 } } };
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
      position: 'relative',
    },
    [
      {
        type: 'img',
        props: {
          src: rosette(),
          width: 620,
          height: 620,
          style: { position: 'absolute', right: -170, top: -150, opacity: 0.22 },
        },
      },
      h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        mark(),
        h('div', { fontFamily: 'Eczar, EczarExt', fontSize: 38, fontWeight: 700 }, SITE.name),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: 20 }, [
        h(
          'div',
          {
            fontFamily: 'Eczar, EczarExt',
            fontSize: c.figure ? 54 : 68,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.015em',
            maxWidth: 1000,
          },
          c.title,
        ),
        ...(c.figure
          ? [
              h('div', { display: 'flex', alignItems: 'flex-end', gap: 20 }, [
                h(
                  'div',
                  {
                    fontFamily: 'Eczar, EczarExt',
                    fontSize: 100,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: COLORS.ink,
                  },
                  c.figure,
                ),
                h(
                  'div',
                  { fontSize: 32, color: COLORS.ink2, paddingBottom: 18 },
                  c.figureCaption ?? '',
                ),
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
