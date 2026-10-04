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

const months = (code: string, overrides: Partial<PtInput>) =>
  computeProfessionalTax(code, input(overrides)).monthly;
const SEP = FY_MONTHS.indexOf('Sep');
const MAR = FY_MONTHS.indexOf('Mar');

describe('Gujarat (rates from 1 April 2022)', () => {
  it('nil up to Rs 12,000 a month, then a flat Rs 200 with no February change', () => {
    expect(computeProfessionalTax('GJ', input({ monthlyGross: 12_000 })).annual).toBe(0);
    const r = computeProfessionalTax('GJ', input({ monthlyGross: 12_001 }));
    expect(r.status).toBe('calculated');
    expect(new Set(r.monthly)).toEqual(new Set([200]));
    expect(r.annual).toBe(2_400);
  });
});

describe('Madhya Pradesh: slabs on annual salary', () => {
  it('nil up to Rs 2,25,000 a year', () => {
    expect(computeProfessionalTax('MP', input({ monthlyGross: 18_750 })).annual).toBe(0);
  });

  it('Rs 125 a month between Rs 2.25 and 3 lakh', () => {
    const r = computeProfessionalTax('MP', input({ monthlyGross: 20_000 }));
    expect(new Set(r.monthly)).toEqual(new Set([125]));
    expect(r.annual).toBe(1_500);
  });

  it('Rs 166 x 11 + Rs 174 in March between Rs 3 and 4 lakh', () => {
    const m = months('MP', { monthlyGross: 30_000 });
    expect(m[MAR]).toBe(174);
    expect(m[0]).toBe(166);
    expect(m.reduce((a, b) => a + b, 0)).toBe(2_000);
  });

  it('Rs 208 x 11 + Rs 212 in March above Rs 4 lakh', () => {
    const m = months('MP', { monthlyGross: 50_000 });
    expect(m[MAR]).toBe(212);
    expect(m[FEB]).toBe(208);
    expect(m.reduce((a, b) => a + b, 0)).toBe(2_500);
  });
});

describe('Assam (Gazette of 2 April 2025)', () => {
  it('nil up to Rs 15,000, Rs 180 below Rs 25,000, Rs 208 from Rs 25,000', () => {
    expect(computeProfessionalTax('AS', input({ monthlyGross: 15_000 })).annual).toBe(0);
    expect(months('AS', { monthlyGross: 15_001 })[0]).toBe(180);
    expect(months('AS', { monthlyGross: 24_999 })[0]).toBe(180);
    expect(months('AS', { monthlyGross: 25_000 })[0]).toBe(208);
    expect(computeProfessionalTax('AS', input({ monthlyGross: 25_000 })).annual).toBe(2_496);
  });

  it('exempts people over 60 only while gross income stays within Rs 5 lakh', () => {
    expect(computeProfessionalTax('AS', input({ age: 65, monthlyGross: 30_000 })).annual).toBe(0);
    expect(computeProfessionalTax('AS', input({ age: 65, monthlyGross: 50_000 })).annual).toBe(
      2_496,
    );
    expect(computeProfessionalTax('AS', input({ age: 59, monthlyGross: 30_000 })).annual).toBe(
      2_496,
    );
  });
});

describe('Bihar: annual slabs, deducted from September salary', () => {
  it('nil up to Rs 3 lakh a year', () => {
    expect(computeProfessionalTax('BR', input({ monthlyGross: 25_000 })).annual).toBe(0);
  });

  it.each([
    [30_000, 1_000],
    [50_000, 2_000],
    [1_00_000, 2_500],
  ])('monthly Rs %i pays Rs %i, all of it in September', (monthlyGross, annual) => {
    const m = months('BR', { monthlyGross });
    expect(m[SEP]).toBe(annual);
    expect(m.filter((x) => x > 0)).toHaveLength(1);
  });
});

describe('Jharkhand: annual slabs, deducted quarterly', () => {
  it.each([
    [25_000, 0],
    [30_000, 1_200],
    [60_000, 1_800],
    [80_000, 2_100],
    [1_00_000, 2_500],
  ])('monthly Rs %i pays Rs %i a year', (monthlyGross, annual) => {
    expect(computeProfessionalTax('JH', input({ monthlyGross })).annual).toBe(annual);
  });

  it('splits the year into four equal quarterly deductions', () => {
    const m = months('JH', { monthlyGross: 1_00_000 });
    expect(m.filter((x) => x > 0)).toEqual([625, 625, 625, 625]);
    expect(m[MAR]).toBe(625);
  });

  it('ignores bonus, which the Act excludes from salary', () => {
    expect(
      computeProfessionalTax('JH', input({ monthlyGross: 25_000, annualBonus: 3_00_000 })).annual,
    ).toBe(0);
  });
});

describe('Kerala: half-yearly slabs revised from 1 October 2024', () => {
  it.each([
    [1_999, 0],
    [2_500, 640],
    [6_000, 1_200],
    [10_000, 1_500],
    [20_000, 2_000],
    [21_000, 2_500],
  ])('monthly Rs %i pays Rs %i a year', (monthlyGross, annual) => {
    expect(computeProfessionalTax('KL', input({ monthlyGross })).annual).toBe(annual);
  });

  it('charges once in each half-year', () => {
    const m = months('KL', { monthlyGross: 50_000 });
    expect(m[SEP]).toBe(1_250);
    expect(m[MAR]).toBe(1_250);
    expect(m.filter((x) => x > 0)).toHaveLength(2);
  });
});

describe('Tamil Nadu: set by each local body', () => {
  it('calculates Greater Chennai Corporation rates for Chennai', () => {
    const r = computeProfessionalTax('TN', input({ city: 'Chennai', monthlyGross: 50_000 }));
    expect(r.status).toBe('calculated');
    expect(r.annual).toBe(2_500);
    expect(r.monthly[SEP]).toBe(1_250);
  });

  it.each([
    [3_500, 0],
    [5_000, 360],
    [7_500, 850],
    [10_000, 1_860],
    [12_500, 2_050],
    [12_501, 2_500],
  ])('Chennai, monthly Rs %i pays Rs %i a year', (monthlyGross, annual) => {
    expect(computeProfessionalTax('TN', input({ city: 'Chennai', monthlyGross })).annual).toBe(
      annual,
    );
  });

  it('stays unverified for the rest of Tamil Nadu, and says why', () => {
    const r = computeProfessionalTax('TN', input({ city: 'Other' }));
    expect(r.status).toBe('unverified');
    expect(r.note).toMatch(/each town sets its own/);
  });
});

describe('Odisha', () => {
  it('levies nothing from April 2026, after the repeal', () => {
    const r = computeProfessionalTax('OR', input({ monthlyGross: 1_00_000 }));
    expect(r.status).toBe('not-levied');
    expect(r.annual).toBe(0);
    expect(r.note).toMatch(/abolished professional tax from 1 April 2026/);
    // Surfaced as a caveat so the calculator explains the zero.
    expect(r.caveat).toMatch(/Repeal Ordinance/);
  });
});

describe('the newly verified states', () => {
  it('never exceed the Rs 2,500 constitutional cap at any salary or age', () => {
    for (const state of ['GJ', 'MP', 'AS', 'BR', 'JH', 'KL', 'TN']) {
      for (const age of [30, 65]) {
        for (let gross = 0; gross <= 3_00_000; gross += 1_250) {
          const r = computeProfessionalTax(
            state,
            input({ monthlyGross: gross, age, city: 'Chennai' }),
          );
          expect(r.annual).toBeLessThanOrEqual(2_500);
        }
      }
    }
  });
});

describe('Tripura (Gazette of 25 July 2018)', () => {
  it.each([
    [7_500, 0],
    [7_501, 150],
    [15_000, 150],
    [15_001, 208],
  ])('monthly Rs %i pays Rs %i a month', (monthlyGross, perMonth) => {
    expect(new Set(months('TR', { monthlyGross }))).toEqual(new Set([perMonth]));
  });
});

describe('Sikkim (Act of 2006)', () => {
  it.each([
    [20_000, 0],
    [20_001, 125],
    [30_000, 125],
    [30_001, 150],
    [40_001, 200],
  ])('monthly Rs %i pays Rs %i a month', (monthlyGross, perMonth) => {
    expect(new Set(months('SK', { monthlyGross }))).toEqual(new Set([perMonth]));
  });

  it('tops out at Rs 2,400 a year', () => {
    expect(computeProfessionalTax('SK', input({ monthlyGross: 1_00_000 })).annual).toBe(2_400);
  });
});

describe('Manipur: annual slabs (Eighth Amendment Act 2012)', () => {
  it.each([
    [4_000, 0],
    [6_000, 1_200],
    [8_000, 2_000],
    [10_000, 2_400],
    [50_000, 2_500],
  ])('monthly Rs %i pays Rs %i a year', (monthlyGross, annual) => {
    expect(computeProfessionalTax('MN', input({ monthlyGross })).annual).toBe(annual);
  });

  it('spreads Rs 2,500 as Rs 208 a month and Rs 212 in March', () => {
    const m = months('MN', { monthlyGross: 50_000 });
    expect(m[0]).toBe(208);
    expect(m[MAR]).toBe(212);
  });
});

describe('Mizoram (notification of 11 July 2024)', () => {
  it.each([
    [5_000, 0],
    [8_000, 75],
    [10_000, 120],
    [12_000, 150],
    [15_000, 180],
    [20_000, 195],
    [20_001, 208],
  ])('monthly Rs %i pays Rs %i a month', (monthlyGross, perMonth) => {
    expect(new Set(months('MZ', { monthlyGross }))).toEqual(new Set([perMonth]));
  });
});

describe('Nagaland', () => {
  it.each([
    [3_999, 0],
    [4_500, 35],
    [6_000, 75],
    [8_000, 110],
    [10_000, 180],
    [12_000, 208],
  ])('monthly Rs %i pays Rs %i a month', (monthlyGross, perMonth) => {
    expect(new Set(months('NL', { monthlyGross }))).toEqual(new Set([perMonth]));
  });
});

describe('Puducherry: minimum half-yearly rates (2017)', () => {
  it.each([
    [16_000, 0],
    [20_000, 500],
    [50_000, 1_000],
    [60_000, 1_500],
    [80_000, 2_000],
    [1_00_000, 2_500],
  ])('monthly Rs %i pays Rs %i a year', (monthlyGross, annual) => {
    expect(computeProfessionalTax('PY', input({ monthlyGross })).annual).toBe(annual);
  });

  it('says the rates are minimums', () => {
    expect(computeProfessionalTax('PY', input({})).caveat).toMatch(/minimum/);
  });
});

describe('Meghalaya', () => {
  it('stays unverified and explains why', () => {
    const r = computeProfessionalTax('ML', input({}));
    expect(r.status).toBe('unverified');
    expect(r.annual).toBe(0);
    expect(r.note).toMatch(/by notification/);
  });
});

describe('the north-eastern states and Puducherry', () => {
  it('never exceed the Rs 2,500 constitutional cap', () => {
    for (const state of ['TR', 'SK', 'MN', 'MZ', 'NL', 'PY']) {
      for (let gross = 0; gross <= 3_00_000; gross += 750) {
        expect(
          computeProfessionalTax(state, input({ monthlyGross: gross })).annual,
        ).toBeLessThanOrEqual(2_500);
      }
    }
  });
});
