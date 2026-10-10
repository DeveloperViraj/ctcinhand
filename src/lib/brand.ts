/**
 * The InHand mark: an open palm holding a rupee coin. Saffron coin, white hand, green tile, a quiet
 * nod to the tricolour. One source for the site, the social cards and the PDF report.
 */

export const BRAND = {
  green: '#0f8a5f',
  saffron: '#f39a2e',
  navy: '#1d2a7a',
  white: '#ffffff',
} as const;

/** The hand, in a 64-unit box. */
export const HAND_PATH =
  'M10.5 35.5c0-1.4 1.2-2.4 2.6-2.2 2.9.3 5.6 1.4 8 2.9l3.6 2.2h10.6c3.2 0 3.6 4.4.6 5.2l-8.2 1.9 9.8-.4 9.4-6.6c2.7-1.9 5.8 1.6 3.4 4l-8.5 8.4c-2.4 2.4-5.6 3.7-9 3.7H18.6l-8.1-3.6z';

/** The rupee sign drawn on the coin; left out at favicon sizes, where it turns to noise. */
export const RUPEE_PATH = 'M29.6 17.8h6.8M29.6 20.6h6.8M31.4 17.8c4.2 0 4.2 5.6 0 5.6h-1.8l5 4.4';

export const COIN = { cx: 33, cy: 22, r: 8.5 } as const;

/** The mark as SVG markup. `rx` 0 gives the square tile that home-screen icons want. */
export function logoSvg({ rupee = true, rx = 16 } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="${BRAND.green}"/><path d="${HAND_PATH}" fill="${BRAND.white}"/><circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.r}" fill="${BRAND.saffron}"/>${
    rupee
      ? `<path d="${RUPEE_PATH}" fill="none" stroke="${BRAND.navy}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`
      : ''
  }</svg>`;
}

/**
 * The hand as relative segments for jsPDF's lines(): [dx, dy] for a line, six numbers for a cubic
 * Bézier. Converted by hand from HAND_PATH; starts at (10.5, 35.5) and closes back there.
 */
export const HAND_SEGMENTS: number[][] = [
  [0, -1.4, 1.2, -2.4, 2.6, -2.2],
  [2.9, 0.3, 5.6, 1.4, 8, 2.9],
  [3.6, 2.2],
  [10.6, 0],
  [3.2, 0, 3.6, 4.4, 0.6, 5.2],
  [-8.2, 1.9],
  [9.8, -0.4],
  [9.4, -6.6],
  [2.7, -1.9, 5.8, 1.6, 3.4, 4],
  [-8.5, 8.4],
  [-2.4, 2.4, -5.6, 3.7, -9, 3.7],
  [-14.2, 0],
  [-8.1, -3.6],
];
export const HAND_START: [number, number] = [10.5, 35.5];
