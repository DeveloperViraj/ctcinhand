import { describe, expect, it } from 'vitest';
import { formatRupees } from './format';
import { describePtPattern } from './pt-pattern';
import { computeProfessionalTax, type PtInput } from './tax/professional-tax';

const input = (overrides: Partial<PtInput> = {}): PtInput => ({
  monthlyGross: 50_000,
  annualBonus: 0,
  age: 30,
  category: 'men',
  liableToIncomeTax: true,
  ...overrides,
});

const describeState = (code: string, overrides: Partial<PtInput> = {}) =>
  describePtPattern(computeProfessionalTax(code, input(overrides)).monthly, formatRupees);

describe('describePtPattern', () => {
  it('says nothing for a flat monthly amount unless asked', () => {
    expect(describeState('GJ')).toBeUndefined();
    expect(
      describePtPattern(computeProfessionalTax('GJ', input()).monthly, formatRupees, true),
    ).toBe('₹200 a month');
  });

  it('names the February month in Maharashtra and Karnataka', () => {
    expect(describeState('MH')).toBe('₹200 a month, ₹300 in February');
    expect(describeState('KA')).toBe('₹200 a month, ₹300 in February');
  });

  it('names the larger twelfth instalment in Madhya Pradesh', () => {
    expect(describeState('MP')).toBe('₹208 a month, ₹212 in March');
  });

  it('describes a single annual deduction in Bihar', () => {
    expect(describeState('BR')).toBe('₹2,000 in September');
  });

  it('lists the quarters in Jharkhand', () => {
    expect(describeState('JH', { monthlyGross: 1_00_000 })).toBe(
      '₹625 in June, September, December and March',
    );
  });

  it('lists the two half-years in Kerala and Chennai', () => {
    expect(describeState('KL')).toBe('₹1,250 in September and March');
    expect(describeState('TN', { city: 'Chennai' })).toBe('₹1,250 in September and March');
  });

  it('describes West Bengal’s mid-year change', () => {
    expect(describeState('WB', { monthlyGross: 50_000 })).toBe(
      '₹200 a month until September, then ₹140 a month',
    );
  });

  it('formats with whatever money function the caller passes', () => {
    const rs = (n: number) => `Rs ${n}`;
    expect(describePtPattern(computeProfessionalTax('MH', input()).monthly, rs)).toBe(
      'Rs 200 a month, Rs 300 in February',
    );
  });
});
