import { describe, expect, it } from 'vitest';
import { computeEsi } from './esi';
import { computeProvidentFund } from './provident-fund';

describe('provident fund', () => {
  it('ceiling mode follows the ceiling month by month: Rs 15,000, then Rs 25,000 from 17 September', () => {
    const pf = computeProvidentFund(40_000, 'ceiling');
    // 12% of 15,000 for April to August, of 19,666.67 for September (16 days at 15,000 and 14 at
    // 25,000), and of 25,000 for October to March: 29,360 a year for each share.
    expect(pf.employeeByMonth.slice(0, 5)).toEqual([1_800, 1_800, 1_800, 1_800, 1_800]);
    expect(pf.employeeByMonth[5]).toBeCloseTo(2_360, 6);
    expect(pf.employeeByMonth.slice(6)).toEqual([3_000, 3_000, 3_000, 3_000, 3_000, 3_000]);
    expect(pf.employee * 12).toBeCloseTo(29_360, 6);
    expect(pf.employerTotal * 12).toBeCloseTo(29_360, 6);
  });

  it('between the two ceilings only the new one binds from October', () => {
    // Wages of 20,000. September by days: (16 x 15,000 + 14 x 20,000) / 30 = 17,333.33.
    // 15,000 x 5 + 17,333.33 + 20,000 x 6 = 2,12,333.33; 12% = 25,480.
    expect(computeProvidentFund(20_000, 'ceiling').employee * 12).toBeCloseTo(25_480, 6);
    expect(computeProvidentFund(20_000, 'ceiling').employeeByMonth[5]).toBeCloseTo(2_080, 6);
  });

  it('splits September by days, not by a blended ceiling', () => {
    // Wages of 18,000: (16 x 15,000 + 14 x 18,000) / 30 = 16,400, so 1,968 rather than 2,160.
    expect(computeProvidentFund(18_000, 'ceiling').employeeByMonth[5]).toBeCloseTo(1_968, 6);
    // At or above 25,000 both parts are capped: (16 x 15,000 + 14 x 25,000) / 30 = 19,666.67.
    expect(computeProvidentFund(40_000, 'ceiling').employeeByMonth[5]).toBeCloseTo(2_360, 6);
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

  it("EPS is 8.33% of wages capped at the month's ceiling, even when contributing on actual wages", () => {
    // 8.33% of 2,44,666.67 of ceiling-capped wages over the year = 20,380.73.
    for (const mode of ['ceiling', 'actual'] as const) {
      const pf = computeProvidentFund(50_000, mode);
      expect(pf.employerEps * 12).toBeCloseTo(20_380.73, 2);
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
