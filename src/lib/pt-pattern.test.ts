import { describe, expect, it } from 'vitest';
import { formatRupees } from './format';
import { describePtPattern, describeSteps } from './pt-pattern';
import { computeProvidentFund } from './tax/provident-fund';
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

describe('describeSteps', () => {
  it('describes provident fund stepping up with the September 2026 ceiling', () => {
    const pf = computeProvidentFund(50_000, 'ceiling');
    expect(describeSteps(pf.employeeByMonth, formatRupees)).toBe(
      '₹1,800 a month until August, ₹2,360 in September, then ₹3,000 a month',
    );
  });

  it('merges September into the later months when wages sit between the two ceilings', () => {
    // Wages of 18,000: 1,800 to August, then 12% of 18,000 = 2,160 from September on.
    const pf = computeProvidentFund(18_000, 'ceiling');
    expect(describeSteps(pf.employeeByMonth, formatRupees)).toBe(
      '₹1,800 a month until August, then ₹2,160 a month',
    );
  });

  it('says nothing when every month is the same', () => {
    expect(
      describeSteps(computeProvidentFund(12_000, 'ceiling').employeeByMonth, formatRupees),
    ).toBe(undefined);
  });
});
