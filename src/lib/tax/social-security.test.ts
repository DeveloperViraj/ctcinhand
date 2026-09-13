import { describe, expect, it } from 'vitest';
import { computeEsi } from './esi';
import { computeProvidentFund } from './provident-fund';

describe('provident fund', () => {
  it('ceiling mode caps both shares at 12% of Rs 15,000 = Rs 1,800', () => {
    const pf = computeProvidentFund(40_000, 'ceiling');
    expect(pf.contributionWage).toBe(15_000);
    expect(pf.employee).toBe(1_800);
    expect(pf.employerTotal).toBe(1_800);
  });

  it('actual mode uses full wages', () => {
    const pf = computeProvidentFund(40_000, 'actual');
    expect(pf.employee).toBe(4_800);
    expect(pf.employerTotal).toBe(4_800);
  });

  it('below the ceiling both modes agree', () => {
    expect(computeProvidentFund(12_000, 'ceiling')).toEqual(computeProvidentFund(12_000, 'actual'));
    expect(computeProvidentFund(12_000, 'ceiling').employee).toBe(1_440);
  });

  it('EPS is 8.33% of wages capped at Rs 15,000, even when contributing on actual wages', () => {
    // 8.33% x 15,000 = 1,249.50; the rest of the employer's share goes to EPF.
    for (const mode of ['ceiling', 'actual'] as const) {
      const pf = computeProvidentFund(50_000, mode);
      expect(pf.employerEps).toBeCloseTo(1_249.5, 6);
      expect(pf.employerEps + pf.employerEpf).toBeCloseTo(pf.employerTotal, 6);
    }
    // Below the ceiling: 12,000 x 8.33% = 999.60 EPS and 12,000 x 3.67% = 440.40 EPF.
    const low = computeProvidentFund(12_000, 'ceiling');
    expect(low.employerEps).toBeCloseTo(999.6, 6);
    expect(low.employerEpf).toBeCloseTo(440.4, 6);
  });

  it("'none' contributes nothing", () => {
    expect(computeProvidentFund(40_000, 'none').employee).toBe(0);
  });
});

describe('ESI', () => {
  it('applies at exactly Rs 21,000 and not above', () => {
    const at = computeEsi(21_000);
    expect(at.applicable).toBe(true);
    expect(at.employee).toBe(157.5); // 0.75%
    expect(at.employer).toBe(682.5); // 3.25%
    expect(computeEsi(21_001).applicable).toBe(false);
    expect(computeEsi(21_001).employee).toBe(0);
  });

  it('uses the Rs 25,000 ceiling for persons with disabilities', () => {
    expect(computeEsi(24_000, true).applicable).toBe(true);
    expect(computeEsi(24_000, false).applicable).toBe(false);
    expect(computeEsi(25_001, true).applicable).toBe(false);
  });

  it('never applies to zero wages', () => {
    expect(computeEsi(0).applicable).toBe(false);
  });
});
