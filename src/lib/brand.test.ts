import { describe, expect, it } from 'vitest';
import { faviconSvg, HAND_PATH, logoSvg, pathToSubpaths, RUPEE_PATH } from './brand';

describe('pathToSubpaths', () => {
  it('turns lines and cubics into relative segments', () => {
    const [p] = pathToSubpaths('M10 10L20 10C25 10 30 15 30 20Z');
    expect(p.start).toEqual([10, 10]);
    expect(p.segments).toEqual([
      [10, 0],
      [5, 0, 10, 5, 10, 10],
    ]);
  });

  it('handles implicit linetos, H, V and relative commands', () => {
    const [p] = pathToSubpaths('M0 0 10 0V10h-10z');
    expect(p.segments).toEqual([
      [10, 0],
      [0, 10],
      [-10, 0],
    ]);
  });

  it('raises quadratics to the equivalent cubic', () => {
    const [p] = pathToSubpaths('M0 0Q30 30 60 0');
    // Controls at two thirds of the way to the quadratic control: (20, 20) and (40, 20).
    expect(p.segments[0].map((v) => Math.round(v * 1000) / 1000)).toEqual([20, 20, 40, 20, 60, 0]);
  });

  it('splits several outlines', () => {
    expect(pathToSubpaths(RUPEE_PATH)).toHaveLength(3);
    expect(pathToSubpaths(HAND_PATH)).toHaveLength(1);
  });
});

describe('logoSvg', () => {
  it('drops the rim and rupee sign for favicons', () => {
    expect(logoSvg()).toContain(RUPEE_PATH);
    expect(logoSvg({ detail: false })).not.toContain(RUPEE_PATH);
    expect(logoSvg({ rx: 0 })).toContain('rx="0"');
  });
});

describe('faviconSvg', () => {
  it('keeps the rupee sign, enlarged, with the hand', () => {
    const svg = faviconSvg();
    expect(svg).toContain(RUPEE_PATH);
    expect(svg).toContain('scale(1.62)');
    expect(svg).toContain(HAND_PATH);
  });
});
