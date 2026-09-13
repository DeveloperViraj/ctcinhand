import { describe, expect, it } from 'vitest';
import { computeIncomeTax, slabTax, standardDeduction } from './income-tax';
import { NEW_REGIME_SLABS, OLD_REGIME_SLABS } from './rates';

/**
 * Expected values are worked by hand from the statutory tables, with the arithmetic in each
 * comment so a reviewer can check them without trusting the implementation. Where an external
 * calculator publishes the same example, it is noted.
 */

const resident = (age = 30) => ({ age, resident: true });
const r = (n: number) => Math.round(n);

describe('slab tax', () => {
  it('new regime cumulative tax at each slab boundary', () => {
    expect(slabTax(4_00_000, NEW_REGIME_SLABS)).toBe(0);
    expect(slabTax(8_00_000, NEW_REGIME_SLABS)).toBe(20_000); // 4L x 5%
    expect(slabTax(12_00_000, NEW_REGIME_SLABS)).toBe(60_000); // 20,000 + 4L x 10%
    expect(slabTax(16_00_000, NEW_REGIME_SLABS)).toBe(1_20_000); // 60,000 + 4L x 15%
    expect(slabTax(20_00_000, NEW_REGIME_SLABS)).toBe(2_00_000); // 1,20,000 + 4L x 20%
    expect(slabTax(24_00_000, NEW_REGIME_SLABS)).toBe(3_00_000); // 2,00,000 + 4L x 25%
    expect(r(slabTax(30_00_000, NEW_REGIME_SLABS))).toBe(4_80_000); // 3,00,000 + 6L x 30%
  });

  it('old regime cumulative tax by age band', () => {
    expect(slabTax(5_00_000, OLD_REGIME_SLABS.below60)).toBe(12_500); // 2.5L x 5%
    expect(slabTax(10_00_000, OLD_REGIME_SLABS.below60)).toBe(1_12_500); // 12,500 + 5L x 20%
    expect(slabTax(8_00_000, OLD_REGIME_SLABS.senior)).toBe(70_000); // 2L x 5% + 3L x 20%
    expect(slabTax(8_00_000, OLD_REGIME_SLABS.superSenior)).toBe(60_000); // 3L x 20%
  });

  it('is zero for zero or negative income', () => {
    expect(slabTax(0, NEW_REGIME_SLABS)).toBe(0);
    expect(computeIncomeTax('new', -50_000).totalTax).toBe(0);
  });
});

describe('standard deduction (s.19)', () => {
  it('is Rs 75,000 new / Rs 50,000 old', () => {
    expect(standardDeduction('new', 10_00_000)).toBe(75_000);
    expect(standardDeduction('old', 10_00_000)).toBe(50_000);
  });
  it('never exceeds the salary itself', () => {
    expect(standardDeduction('new', 40_000)).toBe(40_000);
    expect(standardDeduction('old', 0)).toBe(0);
  });
});

describe('new regime rebate (s.156(2)) and the Rs 12 lakh marginal relief', () => {
  it('Rs 12,00,000 exactly is fully tax-free', () => {
    const t = computeIncomeTax('new', 12_00_000, resident());
    expect(t.slabTax).toBe(60_000);
    expect(t.rebate).toBe(60_000);
    expect(t.rebateIsMarginalRelief).toBe(false);
    expect(t.totalTax).toBe(0);
  });

  it('Rs 7,00,000 is tax-free (rebate limited to the tax itself)', () => {
    const t = computeIncomeTax('new', 7_00_000, resident());
    expect(t.slabTax).toBe(15_000); // 3L x 5%
    expect(t.rebate).toBe(15_000);
    expect(t.totalTax).toBe(0);
  });

  it('Rs 12,10,000: tax capped at the Rs 10,000 excess, cess added after', () => {
    // Slab tax 60,000 + 10,000 x 15% = 61,500. Excess over 12L = 10,000, so tax = 10,000.
    const t = computeIncomeTax('new', 12_10_000, resident());
    expect(t.slabTax).toBe(61_500);
    expect(t.rebate).toBe(51_500);
    expect(t.rebateIsMarginalRelief).toBe(true);
    expect(t.taxAfterRebate).toBe(10_000);
    expect(t.cess).toBe(400);
    expect(t.totalTax).toBe(10_400);
  });

  it('Rs 12,15,000 matches the ClearTax published example (Rs 15,600)', () => {
    // Slab tax 62,250; relief 47,250; tax 15,000; cess 600.
    const t = computeIncomeTax('new', 12_15_000, resident());
    expect(t.slabTax).toBe(62_250);
    expect(t.taxAfterRebate).toBe(15_000);
    expect(r(t.totalTax)).toBe(15_600);
  });

  it('relief switches off above ~Rs 12,70,588 (Rs 12,80,000 pays full slab tax)', () => {
    // Slab tax 60,000 + 80,000 x 15% = 72,000 < excess 80,000, so no relief. Cess 2,880.
    const t = computeIncomeTax('new', 12_80_000, resident());
    expect(t.rebate).toBe(0);
    expect(t.totalTax).toBe(74_880);
  });

  it('gross salary Rs 12,75,000 is tax-free after the standard deduction', () => {
    const taxable = 12_75_000 - standardDeduction('new', 12_75_000);
    expect(taxable).toBe(12_00_000);
    expect(computeIncomeTax('new', taxable, resident()).totalTax).toBe(0);
  });

  it('non-residents get no rebate', () => {
    // 3L x 5% = 15,000 + 4% cess.
    const t = computeIncomeTax('new', 7_00_000, { age: 30, resident: false });
    expect(t.rebate).toBe(0);
    expect(t.totalTax).toBe(15_600);
  });
});

describe('old regime rebate (s.156(1))', () => {
  it('Rs 5,00,000 exactly is tax-free', () => {
    const t = computeIncomeTax('old', 5_00_000, resident());
    expect(t.slabTax).toBe(12_500);
    expect(t.totalTax).toBe(0);
  });

  it('has no marginal relief: Rs 5,10,000 pays full slab tax', () => {
    // 12,500 + 10,000 x 20% = 14,500; cess 580.
    const t = computeIncomeTax('old', 5_10_000, resident());
    expect(t.rebate).toBe(0);
    expect(t.rebateIsMarginalRelief).toBe(false);
    expect(t.totalTax).toBe(15_080);
  });

  it('Rs 10,00,000 below 60', () => {
    expect(computeIncomeTax('old', 10_00_000, resident()).totalTax).toBe(1_17_000); // 1,12,500 + 4,500
  });

  it('senior (60-79) and super senior (80+) slabs', () => {
    expect(r(computeIncomeTax('old', 8_00_000, resident(65)).totalTax)).toBe(72_800); // 70,000 + 2,800
    expect(r(computeIncomeTax('old', 8_00_000, resident(80)).totalTax)).toBe(62_400); // 60,000 + 2,400
  });

  it('senior exemption limits do not apply to non-residents', () => {
    // Non-resident aged 65 uses the below-60 slabs and gets no rebate: 12,500 + 3L x 20% = 72,500.
    const t = computeIncomeTax('old', 8_00_000, { age: 65, resident: false });
    expect(t.slabTax).toBe(72_500);
  });

  it('age never changes new-regime tax', () => {
    const young = computeIncomeTax('new', 20_00_000, resident(25)).totalTax;
    const old = computeIncomeTax('new', 20_00_000, resident(85)).totalTax;
    expect(old).toBe(young);
  });
});

describe('surcharge and threshold marginal relief', () => {
  it('exactly Rs 50,00,000 carries no surcharge (tier applies only when income exceeds it)', () => {
    // New: 3,00,000 + 26L x 30% = 10,80,000; cess 43,200.
    const t = computeIncomeTax('new', 50_00_000, resident());
    expect(t.surchargeRate).toBe(0);
    expect(r(t.totalTax)).toBe(11_23_200);
  });

  it('new regime Rs 51,00,000 matches the ClearTax published example (Rs 12,27,200)', () => {
    // Slab 11,10,000; x1.10 = 12,21,000. Cap = 10,80,000 + 1,00,000 = 11,80,000. Relief 41,000.
    const t = computeIncomeTax('new', 51_00_000, resident());
    expect(r(t.slabTax)).toBe(11_10_000);
    expect(t.surchargeRate).toBe(0.1);
    expect(r(t.surchargeMarginalRelief)).toBe(41_000);
    expect(r(t.surcharge)).toBe(70_000);
    expect(r(t.cess)).toBe(47_200);
    expect(r(t.totalTax)).toBe(12_27_200);
  });

  it('relief never makes tax + surcharge exceed tax at threshold + excess income', () => {
    for (const regime of ['new', 'old'] as const) {
      for (const threshold of [50_00_000, 1_00_00_000, 2_00_00_000, 5_00_00_000]) {
        for (const over of [1, 1_000, 50_000, 1_00_000, 5_00_000]) {
          const above = computeIncomeTax(regime, threshold + over, resident());
          const at = computeIncomeTax(regime, threshold, resident());
          const beforeCess = (x: typeof at) => x.taxAfterRebate + x.surcharge;
          expect(beforeCess(above)).toBeLessThanOrEqual(beforeCess(at) + over + 1e-6);
        }
      }
    }
  });

  it('total tax never decreases as income rises (no cliffs anywhere)', () => {
    for (const regime of ['new', 'old'] as const) {
      let prev = -1;
      // Dense sweep around every rebate and surcharge threshold, plus a coarse sweep between.
      const points = new Set<number>();
      for (let x = 0; x <= 6_00_00_000; x += 2_50_000) points.add(x);
      for (const c of [5_00_000, 12_00_000, 50_00_000, 1_00_00_000, 2_00_00_000, 5_00_00_000]) {
        for (let d = -20_000; d <= 3_00_000; d += 1_000) points.add(c + d);
      }
      for (const x of [...points].sort((a, b) => a - b)) {
        // The old regime's Rs 5L rebate cliff is a jump UP, so it still satisfies this.
        const t = computeIncomeTax(regime, x, resident()).totalTax;
        expect(t).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = t;
      }
    }
  });

  it('new regime Rs 1,01,00,000: 15% tier with relief against U = 28,38,000', () => {
    // Slab 26,10,000; x1.15 = 30,01,500. U = T(1Cr) x 1.10 = 25,80,000 x 1.1 = 28,38,000.
    // Cap = 28,38,000 + 1,00,000 = 29,38,000. Cess 1,17,520.
    const t = computeIncomeTax('new', 1_01_00_000, resident());
    expect(t.surchargeRate).toBe(0.15);
    expect(r(t.taxAfterRebate + t.surcharge)).toBe(29_38_000);
    expect(r(t.totalTax)).toBe(30_55_520);
  });

  it('old regime Rs 51,00,000 with relief', () => {
    // Slab 1,12,500 + 41L x 30% = 13,42,500; x1.1 = 14,76,750. Cap = 13,12,500 + 1,00,000 = 14,12,500.
    const t = computeIncomeTax('old', 51_00_000, resident());
    expect(r(t.taxAfterRebate + t.surcharge)).toBe(14_12_500);
    expect(r(t.totalTax)).toBe(14_69_000);
  });

  it('above Rs 5 crore: new regime is capped at 25%, old regime goes to 37%', () => {
    // New 6Cr: slab 1,75,80,000; x1.25 = 2,19,75,000 (cap 64,17,000 + 4Cr does not bind); cess 8,79,000.
    const n = computeIncomeTax('new', 6_00_00_000, resident());
    expect(n.surchargeRate).toBe(0.25);
    expect(r(n.surchargeMarginalRelief)).toBe(0);
    expect(r(n.totalTax)).toBe(2_28_54_000);

    // Old 6Cr: slab 1,78,12,500; x1.37 = 2,44,03,125 (cap 1,85,15,625 + 1Cr does not bind); cess 9,76,125.
    const o = computeIncomeTax('old', 6_00_00_000, resident());
    expect(o.surchargeRate).toBe(0.37);
    expect(r(o.totalTax)).toBe(2_53_79_250);
  });

  it('marginal relief end points derived from the statutory formula', () => {
    // Just inside each relief band relief is positive; just past the end point it is zero.
    const cases: [regime: 'new' | 'old', inside: number, outside: number][] = [
      ['new', 51_61_000, 51_62_000],
      ['new', 1_01_96_000, 1_01_98_000],
      ['new', 2_08_92_000, 2_08_94_000],
      ['old', 51_95_000, 51_97_000],
      ['old', 5_30_17_000, 5_30_19_000],
    ];
    for (const [regime, inside, outside] of cases) {
      expect(computeIncomeTax(regime, inside, resident()).surchargeMarginalRelief).toBeGreaterThan(
        0,
      );
      expect(computeIncomeTax(regime, outside, resident()).surchargeMarginalRelief).toBe(0);
    }
  });
});
