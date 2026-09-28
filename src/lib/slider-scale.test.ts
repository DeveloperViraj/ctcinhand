import { describe, expect, it } from 'vitest';
import { fromPosition, niceRound, POSITIONS, toPosition, type SliderScale } from './slider-scale';

const CTC: SliderScale = { kind: 'log', min: 1_00_000, max: 2_00_00_000 };
const SEC_80C: SliderScale = { kind: 'linear', min: 0, max: 1_50_000, step: 1_000 };

describe('niceRound', () => {
  it('rounds to a step that grows with the amount', () => {
    expect(niceRound(6_43_210)).toBe(6_45_000);
    expect(niceRound(14_12_345)).toBe(14_10_000);
    expect(niceRound(73_20_000)).toBe(73_00_000);
    expect(niceRound(1_23_45_678)).toBe(1_23_00_000);
  });
});

describe('log scale (CTC)', () => {
  it('pins the ends of the track to the ends of the range', () => {
    expect(fromPosition(0, CTC)).toBe(1_00_000);
    expect(fromPosition(POSITIONS, CTC)).toBe(2_00_00_000);
    expect(toPosition(1_00_000, CTC)).toBe(0);
    expect(toPosition(2_00_00_000, CTC)).toBe(POSITIONS);
  });

  it('puts about ₹14 lakh at the middle of the track', () => {
    const middle = fromPosition(POSITIONS / 2, CTC);
    expect(middle).toBeGreaterThan(13_50_000);
    expect(middle).toBeLessThan(14_50_000);
  });

  it('clamps values outside the range instead of running off the track', () => {
    expect(toPosition(50_000, CTC)).toBe(0);
    expect(toPosition(5_00_00_000, CTC)).toBe(POSITIONS);
    expect(toPosition(Number.NaN, CTC)).toBe(0);
  });

  it('round-trips a typed CTC to within one rounding step', () => {
    for (const ctc of [3_00_000, 7_50_000, 12_00_000, 18_00_000, 45_00_000, 1_20_00_000]) {
      const back = fromPosition(toPosition(ctc, CTC), CTC);
      expect(Math.abs(back - ctc) / ctc).toBeLessThan(0.01);
    }
  });

  it('never goes backwards as the thumb moves right', () => {
    let previous = 0;
    for (let p = 0; p <= POSITIONS; p++) {
      const value = fromPosition(p, CTC);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('linear scale (80C)', () => {
  it('maps the track evenly and rounds to the step', () => {
    expect(fromPosition(0, SEC_80C)).toBe(0);
    expect(fromPosition(POSITIONS / 2, SEC_80C)).toBe(75_000);
    expect(fromPosition(POSITIONS, SEC_80C)).toBe(1_50_000);
    expect(fromPosition(333, SEC_80C)).toBe(50_000);
  });

  it('keeps an over-cap claim at the end of the track', () => {
    expect(toPosition(2_00_000, SEC_80C)).toBe(POSITIONS);
  });
});
