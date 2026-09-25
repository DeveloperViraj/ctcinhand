import { describe, expect, it } from 'vitest';
import { computeProfessionalTax, FY_MONTHS, type PtInput } from './professional-tax';

const FEB = FY_MONTHS.indexOf('Feb');
const input = (overrides: Partial<PtInput>): PtInput => ({
  monthlyGross: 50_000,
  annualBonus: 0,
  age: 30,
  category: 'men',
  liableToIncomeTax: true,
  ...overrides,
});

describe('Maharashtra', () => {
  const mh = (o: Partial<PtInput>) => computeProfessionalTax('MH', input(o));

  it('men: nil up to Rs 7,500', () => {
    expect(mh({ monthlyGross: 7_500 }).annual).toBe(0);
  });

  it('men: Rs 175 every month for Rs 7,501-10,000, with no February adjustment', () => {
    for (const gross of [7_501, 10_000]) {
      const r = mh({ monthlyGross: gross });
      expect(r.monthly.every((m) => m === 175)).toBe(true);
      expect(r.annual).toBe(2_100); // 175 x 12
    }
  });

  it('men above Rs 10,000: Rs 200 x 11 + Rs 300 in February = Rs 2,500', () => {
    const r = mh({ monthlyGross: 10_001 });
    expect(r.monthly[FEB]).toBe(300);
    expect(r.monthly.filter((m) => m === 200)).toHaveLength(11);
    expect(r.annual).toBe(2_500);
  });

  it('women: nil up to Rs 25,000 (men pay at the same salary)', () => {
    expect(mh({ monthlyGross: 25_000, category: 'women' }).annual).toBe(0);
    expect(mh({ monthlyGross: 15_000, category: 'women' }).annual).toBe(0);
    expect(mh({ monthlyGross: 15_000, category: 'men' }).annual).toBe(2_500);
  });

  it('women above Rs 25,000 also pay Rs 300 in February', () => {
    const r = mh({ monthlyGross: 25_001, category: 'women' });
    expect(r.monthly[FEB]).toBe(300);
    expect(r.annual).toBe(2_500);
  });

  it('bonus is excluded from the salary test (s.2(h))', () => {
    // Rs 9,000/month is in the Rs 175 slab; a Rs 1,20,000 bonus must not move it up.
    expect(mh({ monthlyGross: 9_000, annualBonus: 1_20_000 }).annual).toBe(2_100);
  });

  it('people aged 65+ are exempt; 64 is not', () => {
    expect(mh({ age: 65 }).status).toBe('exempt');
    expect(mh({ age: 64 }).annual).toBe(2_500);
  });
});

describe('Karnataka', () => {
  const ka = (o: Partial<PtInput>) => computeProfessionalTax('KA', input(o));

  it('nil below Rs 25,000', () => {
    expect(ka({ monthlyGross: 24_999 }).annual).toBe(0);
    // The old Rs 15,000 threshold is obsolete since 1 April 2023.
    expect(ka({ monthlyGross: 20_000 }).annual).toBe(0);
  });

  it('Rs 25,000 exactly is taxable ("Rs 25,000 and above")', () => {
    expect(ka({ monthlyGross: 25_000 }).annual).toBe(2_500);
  });

  it('Rs 200 x 11 + Rs 300 in February (Act 33 of 2025), not a flat Rs 2,400', () => {
    const r = ka({ monthlyGross: 80_000 });
    expect(r.monthly[FEB]).toBe(300);
    expect(r.monthly.filter((m) => m === 200)).toHaveLength(11);
    expect(r.annual).toBe(2_500);
  });

  it('same rate for men and women', () => {
    expect(ka({ category: 'women' }).annual).toBe(ka({ category: 'men' }).annual);
  });

  it('bonus counts as salary, spread over 12 months (s.2(j))', () => {
    // 20,000 + 60,000 / 12 = 25,000, which crosses the threshold.
    expect(ka({ monthlyGross: 20_000, annualBonus: 60_000 }).annual).toBe(2_500);
    expect(ka({ monthlyGross: 20_000, annualBonus: 0 }).annual).toBe(0);
  });

  it('people aged 60+ are exempt; 59 is not', () => {
    expect(ka({ age: 60 }).status).toBe('exempt');
    expect(ka({ age: 59 }).annual).toBe(2_500);
  });
});

describe('Telangana and Andhra Pradesh', () => {
  for (const state of ['TS', 'AP']) {
    it(`${state}: nil to Rs 15,000, Rs 150 to Rs 20,000, then Rs 200, with no February change`, () => {
      const at = (gross: number) => computeProfessionalTax(state, input({ monthlyGross: gross }));
      expect(at(15_000).annual).toBe(0);
      expect(at(15_001).annual).toBe(1_800); // 150 x 12
      expect(at(20_001).annual).toBe(2_400); // 200 x 12
      expect(at(50_000).monthly[FEB]).toBe(200);
    });
  }
});

describe('West Bengal: schedule changes on 1 October 2026, mid-year', () => {
  const wb = (gross: number) => computeProfessionalTax('WB', input({ monthlyGross: gross }));
  const OCT = FY_MONTHS.indexOf('Oct');

  it('charges the old rate in April and the new one in October', () => {
    const r = wb(18_000);
    expect(r.monthly[0]).toBe(130); // old table: 15,001-25,000
    expect(r.monthly[OCT]).toBe(0); // new table: nil up to 20,000
    expect(r.annual).toBe(780); // 6 x 130
  });

  it('matches worked examples across the October boundary', () => {
    expect(wb(1_20_000).annual).toBe(2_448); // 6 x 200 + 6 x 208
    expect(wb(60_000).annual).toBe(2_220); // 6 x 200 + 6 x 170
    expect(wb(45_000).annual).toBe(2_040); // 6 x 200 + 6 x 140
    expect(wb(22_000).annual).toBe(1_380); // 6 x 130 + 6 x 100
  });

  it('carries a caveat because the new table is not gazette-confirmed', () => {
    expect(wb(50_000).caveat).toMatch(/1 October 2026/);
  });

  it('has no February variation', () => {
    expect(wb(50_000).monthly[FEB]).toBe(wb(50_000).monthly[OCT]);
  });
});

describe('Punjab State Development Tax', () => {
  it('is Rs 200 every month for an income-tax payer, Rs 2,400 a year', () => {
    const r = computeProfessionalTax('PB', input({ monthlyGross: 80_000 }));
    expect(r.annual).toBe(2_400);
    expect(r.monthly[FEB]).toBe(200); // no February variation
    expect(r.label).toBe('Punjab State Development Tax');
  });

  it('does not apply to someone not liable to income tax', () => {
    expect(computeProfessionalTax('PB', input({ liableToIncomeTax: false })).annual).toBe(0);
  });

  it('is not treated as a zero-tax state', () => {
    expect(computeProfessionalTax('PB', input({})).status).toBe('calculated');
  });
});

describe('states that levy nothing', () => {
  it.each(['DL', 'HR', 'UP', 'RJ', 'UK', 'HP', 'GA', 'JK', 'CH'])('%s returns zero', (code) => {
    const r = computeProfessionalTax(code, input({ monthlyGross: 2_00_000 }));
    expect(r.status).toBe('not-levied');
    expect(r.annual).toBe(0);
  });
});

describe('all states', () => {
  it('unknown or unverified states return 0 with status "unverified", never a guess', () => {
    const r = computeProfessionalTax('TN', input({}));
    expect(r.status).toBe('unverified');
    expect(r.annual).toBe(0);
    expect(r.note).toMatch(/payslip/);
  });

  it('never exceeds the Rs 2,500 constitutional cap for any salary', () => {
    for (const state of ['MH', 'KA', 'TS', 'AP', 'WB', 'PB']) {
      for (const category of ['men', 'women'] as const) {
        for (let gross = 0; gross <= 5_00_000; gross += 2_500) {
          expect(
            computeProfessionalTax(state, input({ monthlyGross: gross, category })).annual,
          ).toBeLessThanOrEqual(2_500);
        }
      }
    }
  });
});
