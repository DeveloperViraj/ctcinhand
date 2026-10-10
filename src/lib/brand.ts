/**
 * The InHand mark: an open palm with a rupee coin above it, on a green tile. One source for the
 * header, favicon, app icons, Organization logo, social cards and the PDF report.
 */

export const BRAND = {
  green: '#0f8a5f',
  saffron: '#f5a524',
  rim: '#c9750f',
  navy: '#1d2a7a',
  white: '#ffffff',
} as const;

/** The hand, in a 64-unit box: absolute M, L, C and Z only, so it converts cleanly for jsPDF. */
export const HAND_PATH =
  'M10.6 43C13.5 41.2 16.8 39.2 20.2 38.6C23.4 38 25.8 39 28.4 40L37.4 40C38.67 40 39.7 41.03 39.7 42.3C39.7 43.57 38.67 44.6 37.4 44.6L26.6 44.6C26.08 44.6 25.65 45.03 25.65 45.55C25.65 46.07 26.08 46.5 26.6 46.5L37 46.5C38.6 46.5 40.03 43.4 40.9 42.9L50.6 37.3C51.59 36.8 52.8 37.21 53.3 38.2C53.8 39.19 53.39 40.4 52.4 40.9L36.2 53C34.6 54 33 53.9 31.4 53.5C27.5 52.6 23.5 51.2 20.4 50.6C17 50 13.6 51.8 10.6 53.3Z';

/** The rupee sign, from Geist Bold, fitted to the coin. Left off at favicon sizes. */
export const RUPEE_PATH =
  'M31.6 28.8 27.22 24.74V22.84H30.95Q31.64 22.84 32.1 22.64Q32.55 22.45 32.78 22.04Q33.01 21.64 33.01 21.04Q33.01 20.43 32.78 20.04Q32.55 19.65 32.1 19.46Q31.64 19.26 30.95 19.26H27.22V17.33H31.08Q32.4 17.33 33.4 17.76Q34.41 18.18 34.98 18.99Q35.56 19.81 35.56 20.98Q35.56 22.14 35.01 22.98Q34.46 23.81 33.46 24.25Q32.46 24.69 31.08 24.69H30.21L34.75 28.8ZM27.22 21.74V20.4H36.78V21.74ZM27.22 18.53V17.2H36.78V18.53Z';

export const COIN = { cx: 32, cy: 23, r: 12.6, rim: 10.2, rimWidth: 1.6 } as const;

/**
 * The mark as SVG markup. `detail` false drops the rim and the rupee sign, for favicons, where
 * they would only blur; `rx` 0 gives the square tile home-screen icons want.
 */
export function logoSvg({ detail = true, rx = 15 } = {}): string {
  const { cx, cy, r, rim, rimWidth } = COIN;
  const coinDetail = detail
    ? `<circle cx="${cx}" cy="${cy}" r="${rim}" fill="none" stroke="${BRAND.rim}" stroke-width="${rimWidth}"/><path d="${RUPEE_PATH}" fill="${BRAND.navy}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rx}" fill="${BRAND.green}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${BRAND.saffron}"/>${coinDetail}<path d="${HAND_PATH}" fill="${BRAND.white}"/></svg>`;
}

/** One closed outline for jsPDF's lines(): a start point and relative segments. */
export interface Subpath {
  start: [number, number];
  /** [dx, dy] for a line, six numbers for a cubic Bézier, all relative to the previous point. */
  segments: number[][];
}

/**
 * Converts SVG path data (M, L, H, V, C, Q and Z, absolute or relative, with implicit repeats) into
 * jsPDF subpaths. Quadratic curves become the equivalent cubics, since jsPDF only draws cubics.
 */
export function pathToSubpaths(d: string): Subpath[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const subpaths: Subpath[] = [];
  let current: Subpath | null = null;
  let x = 0;
  let y = 0;
  let command = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  const lineTo = (nx: number, ny: number) => {
    current!.segments.push([nx - x, ny - y]);
    x = nx;
    y = ny;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const rel = command === command.toLowerCase();
    const bx = rel ? x : 0;
    const by = rel ? y : 0;
    switch (command.toUpperCase()) {
      case 'M': {
        x = bx + num();
        y = by + num();
        current = { start: [x, y], segments: [] };
        subpaths.push(current);
        // Further pairs after a moveto are implicit linetos.
        command = rel ? 'l' : 'L';
        break;
      }
      case 'L':
        lineTo(bx + num(), by + num());
        break;
      case 'H':
        lineTo(bx + num(), y);
        break;
      case 'V':
        lineTo(x, by + num());
        break;
      case 'C': {
        const c1x = bx + num();
        const c1y = by + num();
        const c2x = bx + num();
        const c2y = by + num();
        const ex = bx + num();
        const ey = by + num();
        current!.segments.push([c1x - x, c1y - y, c2x - x, c2y - y, ex - x, ey - y]);
        x = ex;
        y = ey;
        break;
      }
      case 'Q': {
        const qx = bx + num();
        const qy = by + num();
        const ex = bx + num();
        const ey = by + num();
        // Degree elevation: the cubic's controls sit two thirds of the way to the quadratic's.
        const c1x = x + ((qx - x) * 2) / 3;
        const c1y = y + ((qy - y) * 2) / 3;
        const c2x = ex + ((qx - ex) * 2) / 3;
        const c2y = ey + ((qy - ey) * 2) / 3;
        current!.segments.push([c1x - x, c1y - y, c2x - x, c2y - y, ex - x, ey - y]);
        x = ex;
        y = ey;
        break;
      }
      case 'Z':
        if (current) {
          x = current.start[0];
          y = current.start[1];
        }
        break;
      default:
        throw new Error(`Unsupported path command ${command}`);
    }
  }
  return subpaths;
}
