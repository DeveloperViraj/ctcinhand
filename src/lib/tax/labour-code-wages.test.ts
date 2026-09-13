import { describe, expect, it } from 'vitest';
import { computeCodeWages } from './labour-code-wages';

const base = { basicDa: 0, testedAllowances: 0, allowancesAsWages: 0, employerPf: 0 };

describe('Labour Code wages: the 50% rule', () => {
  it('Ministry of Labour illustration, with remuneration per the 16.03.2026 FAQ (gratuity excluded)', () => {
    // Basic+DA 20,000; allowances 40,000. Remuneration 60,000; half is 30,000.
    // Allowances exceed half by 10,000, so wages = 20,000 + 10,000 = 30,000.
    const w = computeCodeWages({ ...base, basicDa: 20_000, testedAllowances: 40_000 });
    expect(w.remuneration).toBe(60_000);
    expect(w.addBack).toBe(10_000);
    expect(w.wages).toBe(30_000);
  });

  it('no add-back when Basic+DA is already half or more', () => {
    const w = computeCodeWages({ ...base, basicDa: 30_000, testedAllowances: 30_000 });
    expect(w.addBack).toBe(0);
    expect(w.wages).toBe(30_000);
  });

  it('employer PF counts toward both the test and the total', () => {
    // Basic 25,000; HRA 12,500 + special 22,500 = 35,000 tested; employer PF 1,800.
    // Excluded = 36,800; remuneration = 61,800; half = 30,900; add-back = 5,900; wages = 30,900.
    const w = computeCodeWages({
      ...base,
      basicDa: 25_000,
      testedAllowances: 35_000,
      employerPf: 1_800,
    });
    expect(w.excludedPayments).toBe(36_800);
    expect(w.remuneration).toBe(61_800);
    expect(w.addBack).toBe(5_900);
    expect(w.wages).toBe(30_900);
  });

  it('whenever the add-back applies, wages are exactly half of remuneration', () => {
    for (const basicDa of [5_000, 12_000, 20_000, 33_000]) {
      for (const testedAllowances of [40_000, 55_555, 80_000]) {
        const w = computeCodeWages({ ...base, basicDa, testedAllowances, employerPf: 1_800 });
        if (w.addBack > 0) expect(w.wages).toBeCloseTo(w.remuneration / 2, 9);
        else expect(w.wages).toBe(basicDa);
      }
    }
  });

  it("statute's literal reading: allowances treated as wages are not in the test", () => {
    // Special allowance 22,500 moves into wages; only HRA 12,500 + PF 1,800 are tested.
    // Remuneration 61,800, half 30,900; excluded 14,300 is below half, so no add-back.
    const w = computeCodeWages({
      basicDa: 25_000,
      allowancesAsWages: 22_500,
      testedAllowances: 12_500,
      employerPf: 1_800,
    });
    expect(w.addBack).toBe(0);
    expect(w.wages).toBe(47_500);
  });

  it('the rule only ever raises wages, never lowers them below Basic+DA', () => {
    for (let testedAllowances = 0; testedAllowances <= 2_00_000; testedAllowances += 7_500) {
      const w = computeCodeWages({ ...base, basicDa: 18_000, testedAllowances });
      expect(w.wages).toBeGreaterThanOrEqual(18_000);
    }
  });

  it('handles an all-zero structure without dividing by zero', () => {
    const w = computeCodeWages(base);
    expect(w.wages).toBe(0);
    expect(w.excludedShare).toBe(0);
  });
});
