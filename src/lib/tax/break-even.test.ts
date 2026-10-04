import { describe, expect, it } from 'vitest';
import { breakEven, rentToBreakEven } from './break-even';
import { calculate, type CalculatorInput } from './calculate';
import { DEFAULT_INPUT } from './defaults';
import { computeIncomeTax } from './income-tax';

const at = (ctc: number, overrides: Partial<CalculatorInput> = {}): CalculatorInput => ({
  ...DEFAULT_INPUT,
  ...overrides,
  ctc,
});

describe('breakEven', () => {
  it('has no break-even where the new regime is tax-free (about Rs 12.75 lakh of salary)', () => {
    const result = breakEven(at(12_00_000));
    expect(result.newTax).toBe(0);
    expect(result.reason).toBe('new-is-tax-free');
    expect(result.extraNeeded).toBeNull();
  });

  for (const ctc of [16_00_000, 20_00_000, 30_00_000, 60_00_000]) {
    it(`finds the exact tipping point at Rs ${ctc / 1_00_000} lakh`, () => {
      const input = at(ctc);
      const result = breakEven(input);
      expect(result.reason).toBe('needs-deductions');

      const taxable = Math.ceil(calculate(input).regimes.old.taxableIncome);
      const extra = result.extraNeeded!;
      const oldTaxAt = (t: number) => computeIncomeTax('old', t).totalTax;
      // With the extra claimed the old regime is cheaper; one rupee short and it is not.
      expect(oldTaxAt(taxable - extra)).toBeLessThan(result.newTax);
      expect(oldTaxAt(taxable - extra + 1)).toBeGreaterThanOrEqual(result.newTax);
    });
  }

  it('asks for more as salary rises, then plateaus once both regimes charge 30%', () => {
    const needed = (lakh: number) => breakEven(at(lakh * 1_00_000)).extraNeeded!;
    const rising = [14, 16, 20, 25].map(needed);
    for (let i = 1; i < rising.length; i++) expect(rising[i]).toBeGreaterThan(rising[i - 1]);
    // Above the new regime's Rs 24 lakh slab both charge 30% on the next rupee, so the tax gap,
    // and the deduction needed to close it, stops growing.
    expect(needed(40)).toBe(needed(30));
    expect(needed(50)).toBe(needed(30));
  });

  it('can need less where deductions pull old-regime income below the surcharge threshold', () => {
    expect(breakEven(at(60_00_000)).extraNeeded!).toBeLessThan(
      breakEven(at(40_00_000)).extraNeeded!,
    );
  });

  it('cannot be reached without HRA on a standard structure, even at 16 lakh', () => {
    // At 16 lakh the new regime charges about Rs 1.04 lakh. Maxing 80C, 80CCD(1B), 80D and home
    // loan interest still leaves old-regime tax above that, which is why HRA decides it.
    const result = breakEven(at(16_00_000));
    expect(result.extraNeeded!).toBeGreaterThan(result.cappedHeadroom);
    expect(result.reachableWithoutHra).toBe(false);
  });

  it('counts an HRA exemption when rent is given, which lowers the bar', () => {
    const base = { city: 'Mumbai', stateCode: 'MH' };
    const withoutRent = breakEven(at(20_00_000, base));
    const withRent = breakEven(at(20_00_000, { ...base, monthlyRent: 40_000 }));
    expect(withRent.extraNeeded!).toBeLessThan(withoutRent.extraNeeded!);
  });
});

describe('rentToBreakEven', () => {
  const metro = { city: 'Mumbai', stateCode: 'MH' };

  it('finds the rent at which the old regime starts to win', () => {
    const input = at(20_00_000, metro);
    const { monthlyRent, assumed } = rentToBreakEven(input);
    expect(monthlyRent).not.toBeNull();
    const wins = (rent: number) => {
      const r = calculate({
        ...input,
        monthlyRent: rent,
        deductions: { ...assumed, selfOccupiedInterest: 0 },
      });
      return r.regimes.old.tax.totalTax < r.regimes.new.tax.totalTax;
    };
    expect(wins(monthlyRent!)).toBe(true);
    // Rounded up to Rs 500, so Rs 500 less may or may not win, but Rs 1,000 less must not.
    expect(wins(monthlyRent! - 1_000)).toBe(false);
  });

  it('returns null where the new regime is tax-free', () => {
    expect(rentToBreakEven(at(12_00_000, metro)).monthlyRent).toBeNull();
  });
});
