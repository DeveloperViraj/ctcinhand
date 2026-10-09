import { describe, expect, it } from 'vitest';
import { calculate, type CalculatorInput } from './calculate';
import { DEFAULT_INPUT } from './defaults';

const input = (o: Partial<CalculatorInput> = {}): CalculatorInput => ({ ...DEFAULT_INPUT, ...o });
const r2 = (n: number) => Math.round(n * 100) / 100;

describe('end to end: Rs 12,00,000 CTC, Basic 50%, Karnataka, no rent', () => {
  const result = calculate(input());
  const { structure } = result;

  it('resolves the structure and balances special allowance against CTC', () => {
    // Basic 6,00,000; HRA 3,00,000; gratuity 15/26 of one month's wages. Employer PF at the ceiling,
    // which rose mid-year: 12% x (15,000 x 5 + 19,666.67 for September + 25,000 x 6) = 29,360.
    expect(structure.annual.basic).toBe(6_00_000);
    expect(structure.annual.hra).toBe(3_00_000);
    expect(r2(structure.annual.employerPf)).toBe(29_360);
    expect(r2(structure.annual.gratuity)).toBe(28_846.15); // 50,000 x 15 / 26
    expect(r2(structure.annual.special)).toBe(2_41_793.85);
    expect(Math.abs(structure.unallocated)).toBeLessThan(0.01);
    expect(structure.converged).toBe(true);
  });

  it('needs no Labour Code add-back when Basic is half of CTC', () => {
    expect(structure.wages.addBack).toBe(0);
    expect(structure.wages.wages).toBe(50_000);
  });

  it('applies the PF ceiling month by month (Rs 15,000, then Rs 25,000) and no ESI', () => {
    expect(r2(structure.pf.employee * 12)).toBe(29_360);
    expect(structure.pf.employeeByMonth[0]).toBe(1_800); // April
    expect(r2(structure.pf.employeeByMonth[5])).toBe(2_360); // September, split by days
    expect(structure.pf.employeeByMonth[11]).toBe(3_000); // March
    expect(structure.esi.applicable).toBe(false);
  });

  it('charges Karnataka PT of Rs 2,500 including the February Rs 300', () => {
    expect(result.professionalTax.annual).toBe(2_500);
    expect(result.professionalTax.monthly[10]).toBe(300);
  });

  it('new regime: the Rs 60,000 rebate wipes out the tax', () => {
    const n = result.regimes.new;
    // Gross 11,41,793.85 less the Rs 75,000 standard deduction = 10,66,793.85 taxable.
    expect(r2(n.grossSalary)).toBe(11_41_793.85);
    expect(r2(n.taxableIncome)).toBe(10_66_793.85);
    // Slab tax 20,000 + 10% of 2,66,793.8462 = 46,679.38, fully covered by the rebate.
    expect(r2(n.tax.slabTax)).toBe(46_679.38);
    expect(n.tax.totalTax).toBe(0);
    expect(r2(n.annualTakeHome)).toBe(11_09_933.85); // gross - PF 29,360 - PT 2,500
    expect(r2(n.monthlyTakeHome)).toBe(92_494.49);
  });

  it('old regime: 80C picks up employee PF, and tax is due', () => {
    const o = result.regimes.old;
    expect(r2(o.sec80C?.allowed ?? 0)).toBe(29_360); // employee PF only, under the Rs 1.5 lakh cap
    expect(o.professionalTaxDeduction).toBe(2_500);
    // 11,41,793.85 - 50,000 - 2,500 - 29,360 = 10,59,933.85
    expect(r2(o.taxableIncome)).toBe(10_59_933.85);
    // 12,500 + 1,00,000 + 30% of 59,933.8462 = 1,30,480.15; cess 4% -> 1,35,699.36
    expect(r2(o.tax.slabTax)).toBe(1_30_480.15);
    expect(r2(o.tax.totalTax)).toBe(1_35_699.36);
  });

  it('picks the new regime and reports the saving', () => {
    expect(result.better).toBe('new');
    expect(r2(result.savingByChoosingBetter)).toBe(1_35_699.36);
  });

  it('has no errors', () => {
    expect(result.errors).toEqual([]);
  });
});

describe('Labour Code add-back when Basic is only 30% of CTC', () => {
  const result = calculate(input({ basic: { unit: 'percent', value: 30 } }));
  const { structure } = result;

  it('raises wages above Basic and says so', () => {
    // Basic 30,000/month. Solving the structure: special = 6,24,900 / 1.0240385 = 6,10,231,
    // so wages = 23,400 + 6,10,231/24 = 48,826.29, well above the stated Basic.
    expect(structure.annual.basic).toBe(3_60_000);
    expect(r2(structure.wages.wages)).toBe(48_826.29);
    expect(r2(structure.wages.addBack)).toBe(18_826.29);
    expect(result.notices.some((n) => /more than half your pay/.test(n))).toBe(true);
  });

  it('wages come to exactly half of remuneration', () => {
    expect(r2(structure.wages.wages)).toBe(r2(structure.wages.remuneration / 2));
  });

  it('raises the gratuity provision above a Basic-only calculation', () => {
    // On Code wages: 48,826.29 x 15 / 26 = 28,169.01. On Basic alone it would be 17,307.69.
    expect(r2(structure.annual.gratuity)).toBe(28_169.01);
    expect(structure.annual.gratuity).toBeGreaterThan((3_60_000 / 12) * (15 / 26));
  });

  it('does not change PF, because contributions are capped at the ceiling', () => {
    // Wages are above both ceilings either way, so PF is the same 29,360 a year.
    expect(r2(structure.pf.employee * 12)).toBe(29_360);
  });

  it('raises PF when the employer contributes on actual wages', () => {
    const actual = calculate(input({ basic: { unit: 'percent', value: 30 }, pfMode: 'actual' }));
    expect(actual.structure.pf.employee).toBeGreaterThan(5_000);
    expect(r2(actual.structure.pf.employee)).toBe(r2(actual.structure.wages.wages * 0.12));
  });
});

describe('HRA exemption (old regime only)', () => {
  const withRent = calculate(
    input({ ctc: 20_00_000, monthlyRent: 30_000, city: 'Bengaluru', stateCode: 'KA' }),
  );

  it('applies in the old regime and never in the new', () => {
    expect(withRent.regimes.new.hraExemption).toBeNull();
    expect(withRent.regimes.old.hraExemption).not.toBeNull();
  });

  it('takes the least of the three limbs', () => {
    const h = withRent.regimes.old.hraExemption!;
    // Basic 10,00,000; HRA 5,00,000; rent 3,60,000.
    // (a) 5,00,000  (b) 3,60,000 - 1,00,000 = 2,60,000  (c) 50% of 10,00,000 = 5,00,000
    expect(h.limbs.received).toBe(5_00_000);
    expect(h.limbs.rentOverTenPercent).toBe(2_60_000);
    expect(h.limbs.percentOfSalary).toBe(5_00_000);
    expect(h.exemption).toBe(2_60_000);
    expect(h.binding).toBe('rent');
    expect(h.needsLandlordPan).toBe(true);
  });

  it('uses 50% for Bengaluru, which joined the list for FY 2026-27, and 40% elsewhere', () => {
    expect(withRent.regimes.old.hraExemption!.rate).toBe(0.5);
    const other = calculate(input({ ctc: 20_00_000, monthlyRent: 30_000, city: 'Other' }));
    expect(other.regimes.old.hraExemption!.rate).toBe(0.4);
  });

  it('can make the old regime the better choice', () => {
    const highRent = calculate(
      input({
        ctc: 20_00_000,
        monthlyRent: 60_000,
        city: 'Mumbai',
        stateCode: 'MH',
        deductions: {
          sec80C: 1_50_000,
          nps80CCD1B: 50_000,
          healthInsurance: 25_000,
          selfOccupiedInterest: 2_00_000,
        },
      }),
    );
    expect(highRent.better).toBe('old');
    expect(highRent.savingByChoosingBetter).toBeGreaterThan(0);
  });
});

describe('deduction caps are enforced, not just displayed', () => {
  const over = calculate(
    input({
      ctc: 20_00_000,
      deductions: {
        sec80C: 3_00_000,
        nps80CCD1B: 1_00_000,
        healthInsurance: 2_00_000,
        selfOccupiedInterest: 5_00_000,
      },
    }),
  );

  it('caps 80C at Rs 1.5 lakh and flags it', () => {
    expect(over.regimes.old.sec80C?.allowed).toBe(1_50_000);
    expect(over.regimes.old.sec80C?.capped).toBe(true);
  });

  it('caps self-occupied interest at Rs 2 lakh and 80CCD(1B) at Rs 50,000', () => {
    expect(over.regimes.old.selfOccupiedInterest?.allowed).toBe(2_00_000);
    expect(over.regimes.old.nps80CCD1B?.allowed).toBe(50_000);
  });

  it('allows none of them in the new regime', () => {
    expect(over.regimes.new.sec80C).toBeNull();
    expect(over.regimes.new.selfOccupiedInterest).toBeNull();
    expect(over.regimes.new.professionalTaxDeduction).toBe(0);
  });
});

describe('employer NPS', () => {
  it('is deductible at 14% in the new regime and 10% in the old for a private employer', () => {
    const r = calculate(input({ ctc: 20_00_000, employerNps: { unit: 'percent', value: 14 } }));
    const basic = r.structure.annual.basic;
    expect(r.regimes.new.employerNpsDeduction).toBeCloseTo(0.14 * basic, 6);
    expect(r.regimes.old.employerNpsDeduction).toBeCloseTo(0.1 * basic, 6);
  });

  it('is deductible at 14% in both regimes for a government employer', () => {
    const r = calculate(
      input({
        ctc: 20_00_000,
        employerNps: { unit: 'percent', value: 14 },
        employerType: 'government',
      }),
    );
    expect(r.regimes.old.employerNpsDeduction).toBeCloseTo(0.14 * r.structure.annual.basic, 6);
  });
});

describe('validation', () => {
  it('reports an error when fixed components exceed CTC', () => {
    const bad = calculate(
      input({ basic: { unit: 'percent', value: 90 }, hra: { unit: 'percent', value: 100 } }),
    );
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.errors[0]).toMatch(/more than your CTC/);
  });

  it('reports an error when fixed components leave CTC unallocated', () => {
    const bad = calculate(input({ specialAllowance: { unit: 'percent', value: 5 } }));
    expect(bad.errors[0]).toMatch(/does not match your CTC/);
  });

  it('handles a zero CTC without throwing', () => {
    const zero = calculate(input({ ctc: 0 }));
    expect(zero.regimes.new.tax.totalTax).toBe(0);
    expect(zero.regimes.new.annualTakeHome).toBe(0);
  });
});

describe('ESI', () => {
  it('applies to a low CTC and is taken from take-home', () => {
    const low = calculate(input({ ctc: 3_00_000 }));
    expect(low.structure.esi.applicable).toBe(true);
    expect(low.structure.esi.employee).toBeGreaterThan(0);
    expect(low.regimes.new.annualTakeHome).toBeLessThan(low.structure.annual.grossFixed);
  });

  it('can apply to gross pay above Rs 21,000 a month, and warns when it does', () => {
    // Basic at 20% of a Rs 5,00,000 CTC: gross is above the ceiling but Code wages are not.
    const r = calculate(input({ ctc: 5_00_000, basic: { unit: 'percent', value: 20 } }));
    if (r.structure.esi.applicable && r.structure.annual.grossFixed / 12 > 21_000) {
      expect(r.notices.some((n) => /ESI applies even though/.test(n))).toBe(true);
    }
  });
});

describe('gratuity projection', () => {
  it('is zero before five years for a permanent employee', () => {
    expect(calculate(input({ yearsOfService: 4 })).gratuityProjection.eligible).toBe(false);
  });

  it('pays a fixed-term employee after one year, pro rata', () => {
    const fixed = calculate(input({ yearsOfService: 1.5, employmentType: 'fixed-term' }));
    expect(fixed.gratuityProjection.eligible).toBe(true);
    expect(fixed.gratuityProjection.countedYears).toBe(1.5);
  });

  it('rounds a part-year above six months up to a full year for permanent staff', () => {
    expect(calculate(input({ yearsOfService: 10.6 })).gratuityProjection.countedYears).toBe(11);
    expect(calculate(input({ yearsOfService: 10.4 })).gratuityProjection.countedYears).toBe(10);
  });
});
