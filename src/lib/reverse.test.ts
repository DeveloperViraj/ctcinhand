import { describe, expect, it } from 'vitest';
import { lakhs } from './brackets';
import { ctcForInHand, lpaLabel, renderReverse, reverseInput, type ReverseQuery } from './reverse';
import { calculate } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';

const base: Omit<ReverseQuery, 'inHand'> = {
  stateCode: DEFAULT_INPUT.stateCode,
  city: DEFAULT_INPUT.city,
  monthlyRent: 0,
  variablePercent: 0,
};
const monthlyAt = (ctc: number, q = base) => {
  const r = calculate(reverseInput(ctc, q));
  return r.regimes[r.better].monthlyTakeHome;
};

describe('in-hand to CTC', () => {
  it.each([20_000, 30_000, 50_000, 75_000, 1_00_000, 1_50_000, 2_50_000])(
    'finds the smallest CTC that pays at least %i a month',
    (target) => {
      const o = ctcForInHand({ ...base, inHand: target })!;
      expect(o.ctc % 1_000).toBe(0);
      expect(o.monthly).toBeGreaterThanOrEqual(target);
      // The next round number down falls short, so nothing cheaper would do.
      expect(monthlyAt(o.ctc - 1_000)).toBeLessThan(target);
    },
  );

  it('round-trips with the per-salary pages: the in-hand at 12 LPA needs exactly 12 LPA', () => {
    const monthly = Math.floor(monthlyAt(lakhs(12)));
    expect(ctcForInHand({ ...base, inHand: monthly })!.ctc).toBe(lakhs(12));
  });

  it('finds the cheaper CTC before the marginal-relief dip', () => {
    // In-hand peaks near 13.4 LPA and dips just after, so a target above the dip's floor is
    // reached twice. The answer must be the first, smaller CTC.
    const peak = monthlyAt(lakhs(13.4));
    const later = monthlyAt(lakhs(13.9));
    expect(later).toBeLessThan(peak);
    const target = Math.round((peak + later) / 2);
    const o = ctcForInHand({ ...base, inHand: target })!;
    expect(o.ctc).toBeLessThanOrEqual(lakhs(13.4));
    expect(o.monthly).toBeGreaterThanOrEqual(target);
    expect(monthlyAt(o.ctc - 1_000)).toBeLessThan(target);
  });

  it('adds variable pay on top of the fixed pay that reaches the target', () => {
    const q = { ...base, variablePercent: 10 };
    const o = ctcForInHand({ ...q, inHand: 1_00_000 })!;
    expect(o.variable).toBeCloseTo(o.ctc * 0.1, 0);
    expect(o.monthly).toBeGreaterThanOrEqual(1_00_000);
    expect(o.ctc).toBeGreaterThan(ctcForInHand({ ...base, inHand: 1_00_000 })!.ctc);
  });

  it('labels CTCs in LPA without trailing zeros', () => {
    expect(lpaLabel(lakhs(12))).toBe('12 LPA');
    expect(lpaLabel(12_34_000)).toBe('12.34 LPA');
    expect(lpaLabel(12_30_000)).toBe('12.3 LPA');
  });

  it('asks for a usable number instead of guessing', () => {
    expect(renderReverse({ ...base, inHand: null })).toContain('Enter the in-hand salary');
    expect(renderReverse({ ...base, inHand: 30_000, variablePercent: 100 })).toContain(
      'less than 100%',
    );
    const html = renderReverse({ ...base, inHand: 30_000 });
    expect(html).toContain('Ask for a CTC of at least');
    expect(html).toContain('LPA');
  });
});
