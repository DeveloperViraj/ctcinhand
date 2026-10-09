import { describe, expect, it } from 'vitest';
import { gratuityData, labourCodeData, pfGuideData } from './explainers';

describe('labourCodeData', () => {
  const data = labourCodeData();
  const row = (percent: number) => data.rows.find((r) => r.basicPercent === percent)!;

  it('pulls wages up to half of remuneration however low Basic is set', () => {
    // 12 LPA: remuneration excludes the gratuity provision, so half of it is about 48,826.
    for (const percent of [25, 30, 40]) {
      expect(row(percent).wages).toBeCloseTo(48_826.29, 1);
      expect(row(percent).wages).toBeCloseTo(row(percent).remuneration / 2, 6);
    }
    expect(row(30).addBack).toBeCloseTo(18_826.29, 1);
  });

  it('adds nothing back when Basic is half of CTC', () => {
    expect(row(50).addBack).toBe(0);
    expect(row(50).wages).toBe(50_000);
    expect(row(50).excludedShare).toBeLessThan(0.5);
  });

  it('shows gratuity on Basic alone understating the Labour Code figure', () => {
    const twelve = data.gratuityShift.find((r) => r.lpa === 12)!;
    expect(twelve.onBasic).toBeCloseTo((30_000 * 15) / 26, 6);
    expect(twelve.onWages).toBeCloseTo(28_169.01, 1);
  });

  it('finds where ESI stops for the default structure', () => {
    // Wages are half of CTC a month, so 21,000 a month is reached at about 5.04 lakh.
    expect(data.esiEndsAt).toBe(5_05_000);
    expect(data.esi.find((r) => r.lpa === 5)!.covered).toBe(true);
    expect(data.esi.find((r) => r.lpa === 5)!.grossMonthly).toBeGreaterThan(data.esiCeiling);
    expect(data.esi.find((r) => r.lpa === 5.5)!.covered).toBe(false);
  });
});

describe('pfGuideData', () => {
  const data = pfGuideData();
  const row = (wages: number) => data.wageRows.find((r) => r.wages === wages)!;

  it('steps the deduction up with the September 2026 ceiling', () => {
    expect(row(20_000)).toMatchObject({
      beforeChange: 1_800,
      afterChange: 2_400,
      nextYear: 28_800,
    });
    expect(row(20_000).september).toBeCloseTo(2_080, 6);
    expect(row(20_000).thisYear).toBeCloseTo(25_480, 6);
    expect(row(40_000)).toMatchObject({ afterChange: 3_000, thisYear: 29_360, nextYear: 36_000 });
  });

  it('leaves wages at or under the old ceiling unchanged', () => {
    expect(row(15_000).thisYear).toBe(21_600);
    expect(row(15_000).nextYear).toBe(21_600);
  });

  it('gives the pension share at both ceilings', () => {
    expect(data.epsBefore).toBeCloseTo(1_249.5, 6);
    expect(data.epsAfter).toBeCloseTo(2_082.5, 6);
  });

  it('compares the two contribution bases', () => {
    const twenty = data.modeRows.find((r) => r.lpa === 20)!;
    expect(twenty.pfAtCeiling).toBeCloseTo(58_720, 6);
    expect(twenty.pfOnFull).toBeCloseTo(2_40_000, 6);
    expect(twenty.takeHomeOnFull).toBeLessThan(twenty.takeHomeAtCeiling);
  });

  it('finds where full-wage PF passes the Rs 2.5 lakh interest threshold', () => {
    // 2,50,000 / 12% / 12 = 1,73,611 of wages a month, which is half of a 41.67 lakh CTC.
    expect(data.interestThresholdCtc).toBe(41_67_000);
  });
});

describe('gratuityData', () => {
  const data = gratuityData();

  it('applies the Rs 20 lakh maximum', () => {
    const fifty = data.rows.find((r) => r.lpa === 50)!;
    expect(fifty.byYears.find((y) => y.years === 20)).toMatchObject({
      amount: 20_00_000,
      capped: true,
    });
    expect(data.capReachedAt20Years).toBe(41_61_000);
  });

  it('pays fixed-term staff from one year and permanent staff from five', () => {
    const at = (label: string) => data.service.find((s) => s.label === label)!;
    expect(data.serviceWages).toBe(50_000);
    expect(at('9 months')).toMatchObject({ permanent: 0, fixedTerm: 0 });
    expect(at('1 year').fixedTerm).toBeCloseTo((50_000 * 15) / 26, 6);
    expect(at('4 years').permanent).toBe(0);
    expect(at('5 years').permanent).toBeCloseTo(at('5 years').fixedTerm, 6);
  });

  it('rounds a part year up only when it is more than six months', () => {
    expect(data.rounding.atSixMonths).toBeCloseTo(((50_000 * 15) / 26) * 5, 6);
    expect(data.rounding.atSevenMonths).toBeCloseTo(((50_000 * 15) / 26) * 6, 6);
  });
});
