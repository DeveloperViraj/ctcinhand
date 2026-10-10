/**
 * The site's ornament, generated at build time.
 *
 * - The rosette is guilloche: families of fine wavy rings whose phase shifts from line to line,
 *   the same technique as the security printing on rupee notes and cheques.
 * - The band is a strip of the same linework, like the top edge of a cheque.
 * - The kolam tile is a lattice of dots with loops drawn around them, after the threshold
 *   drawings made fresh each morning across South India.
 *
 * Every piece is drawn in black and used as a CSS mask, so the page colours it per theme with a
 * gradient and one cached file serves light and dark alike.
 */

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * A smooth closed path through points, as cubic Béziers (Catmull-Rom). Far fewer points than a
 * polyline for the same smoothness, which keeps the files small.
 */
function closedCurve(points: [number, number][]): string {
  const n = points.length;
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d}Z`;
}

/** An open smooth path through points (used for the band). */
function openCurve(points: [number, number][]): string {
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d += `C${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)} ${fmt(
      p2[0] - (p3[0] - p1[0]) / 6,
    )} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}

interface RingBand {
  /** Radius of the first line. */
  radius: number;
  /** Lines in the band and the gap between them. */
  lines: number;
  spacing: number;
  /** Wave height and how many waves go round the circle. */
  amplitude: number;
  waves: number;
  /** Phase added per line, as a fraction of one wave: this is what makes the moiré. */
  phaseStep: number;
  /** A second, slower wave that makes the band breathe. */
  swell?: { amplitude: number; waves: number };
}

function ringBand(b: RingBand): string[] {
  // Copies of one wavy ring, each turned by a fraction of a wave. Where they cross they weave the
  // diamond net of banknote guilloche; a small radius step per copy gives the band its depth.
  const paths: string[] = [];
  const samples = Math.max(36, b.waves * 3);
  for (let j = 0; j < b.lines; j++) {
    const turn = (j * b.phaseStep * Math.PI * 2) / b.waves;
    const points: [number, number][] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const r =
        b.radius +
        j * b.spacing +
        b.amplitude * Math.sin(b.waves * (t + turn)) +
        (b.swell ? b.swell.amplitude * Math.sin(b.swell.waves * t) : 0);
      points.push([r * Math.cos(t), r * Math.sin(t)]);
    }
    paths.push(closedCurve(points));
  }
  return paths;
}

/** The rosette: three bands of guilloche rings around a petalled centre. */
export function rosetteSvg(): string {
  const paths = [
    ...ringBand({ radius: 186, lines: 4, spacing: 0.5, amplitude: 4, waves: 72, phaseStep: 1 / 4 }),
    ...ringBand({
      radius: 160,
      lines: 8,
      spacing: 0.6,
      amplitude: 11,
      waves: 36,
      phaseStep: 1 / 8,
      swell: { amplitude: 3, waves: 6 },
    }),
    ...ringBand({
      radius: 112,
      lines: 8,
      spacing: 0.6,
      amplitude: 15,
      waves: 24,
      phaseStep: 1 / 8,
    }),
    ...ringBand({ radius: 66, lines: 6, spacing: 0.6, amplitude: 14, waves: 12, phaseStep: 1 / 6 }),
  ];
  // Petals: a twelve-lobed rose drawn several times at rotating offsets.
  for (let k = 0; k < 4; k++) {
    const points: [number, number][] = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const r = 14 + 26 * Math.abs(Math.cos(6 * t + (k * Math.PI) / 24));
      points.push([r * Math.cos(t), r * Math.sin(t)]);
    }
    paths.push(closedCurve(points));
  }
  return svg(
    '-210 -210 420 420',
    `<g fill="none" stroke="#000" stroke-width="0.7">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`,
  );
}

/** A horizontal strip of interleaved waves that tiles seamlessly left to right. */
export function bandSvg(): string {
  const width = 240;
  const height = 24;
  const paths: string[] = [];
  const lines = 7;
  for (let j = 0; j < lines; j++) {
    const points: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * width;
      const y =
        height / 2 +
        7 * Math.sin((x / width) * Math.PI * 2 * 6 + (j / lines) * Math.PI * 2) +
        2.5 * Math.sin((x / width) * Math.PI * 2 * 2);
      points.push([x, y]);
    }
    paths.push(openCurve(points));
  }
  return svg(
    `0 0 ${width} ${height}`,
    `<g fill="none" stroke="#000" stroke-width="0.6">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    { width, height },
  );
}

/**
 * One kolam tile: a dot with a rounded loop around it, and arcs that join each loop to its
 * neighbours so the lattice reads as one continuous line when the tile repeats.
 */
export function kolamSvg(): string {
  const s = 32;
  const c = s / 2;
  const r = 9;
  const loop = `M${c} ${c - r}Q${c + r} ${c - r} ${c + r} ${c}Q${c + r} ${c + r} ${c} ${c + r}Q${c - r} ${c + r} ${c - r} ${c}Q${c - r} ${c - r} ${c} ${c - r}Z`;
  // Arcs from each loop's corners out to the tile edges, meeting the next tile's arcs.
  const arcs = [
    `M${c + r * 0.7} ${c - r * 0.7}Q${s} ${c - r} ${s} 0`,
    `M${c + r * 0.7} ${c + r * 0.7}Q${s} ${c + r} ${s} ${s}`,
    `M${c - r * 0.7} ${c + r * 0.7}Q0 ${c + r} 0 ${s}`,
    `M${c - r * 0.7} ${c - r * 0.7}Q0 ${c - r} 0 0`,
  ];
  return svg(
    `0 0 ${s} ${s}`,
    `<g fill="none" stroke="#000" stroke-width="1" stroke-linecap="round"><path d="${loop}"/>${arcs
      .map((d) => `<path d="${d}"/>`)
      .join(
        '',
      )}</g><circle cx="${c}" cy="${c}" r="1.6" fill="#000"/><circle cx="0" cy="0" r="1.6"/><circle cx="${s}" cy="0" r="1.6"/><circle cx="0" cy="${s}" r="1.6"/><circle cx="${s}" cy="${s}" r="1.6"/>`,
    { width: s, height: s },
  );
}

function svg(viewBox: string, body: string, size?: { width: number; height: number }): string {
  const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${dims}>${body}</svg>`;
}

/** A tapered brush stroke, for underlining a phrase the way you would with a marker. */
export function brushSvg(): string {
  return svg(
    '0 0 240 22',
    '<path d="M3 13.5C58 6.5 142 3.6 235 8.4c4 .2 4.3 4.6.3 5.1C150 12.6 72 14.7 5.6 19.2 1 19.6-.6 14.2 3 13.5z"/>',
    { width: 240, height: 22 },
  );
}

export const ART = {
  rosette: rosetteSvg,
  band: bandSvg,
  kolam: kolamSvg,
  brush: brushSvg,
} as const;
export type ArtName = keyof typeof ART;
