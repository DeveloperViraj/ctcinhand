import { describe, expect, it } from 'vitest';
import {
  formatMonthYear,
  formatCompactRupees,
  formatNumber,
  formatPercent,
  formatRupees,
  parseRupees,
} from './format';

describe('Indian digit grouping', () => {
  it('groups in lakhs and crores, not thousands', () => {
    expect(formatNumber(1_234_567)).toBe('12,34,567');
    expect(formatNumber(100_000)).toBe('1,00,000');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats rupees, including negatives', () => {
    expect(formatRupees(1_234_567)).toBe('₹12,34,567');
    expect(formatRupees(-45_000)).toBe('-₹45,000');
    expect(formatRupees(1234.56, true)).toBe('₹1,234.56');
  });

  it('never renders NaN or Infinity to the user', () => {
    expect(formatRupees(Number.NaN)).toBe('₹0');
    expect(formatRupees(Number.POSITIVE_INFINITY)).toBe('₹0');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });

  it('uses lakh and crore for compact figures', () => {
    expect(formatCompactRupees(12_50_000)).toBe('₹12.5 L');
    expect(formatCompactRupees(1_00_000)).toBe('₹1 L');
    expect(formatCompactRupees(1_25_00_000)).toBe('₹1.25 Cr');
    expect(formatCompactRupees(45_000)).toBe('₹45,000');
  });
});

describe('parsing what people actually type', () => {
  it('accepts plain numbers and grouped numbers', () => {
    expect(parseRupees('1200000')).toBe(12_00_000);
    expect(parseRupees('12,00,000')).toBe(12_00_000);
    expect(parseRupees('₹12,00,000')).toBe(12_00_000);
    expect(parseRupees(' 1200000 ')).toBe(12_00_000);
  });

  it('accepts the shorthand people use for salaries', () => {
    expect(parseRupees('18L')).toBe(18_00_000);
    expect(parseRupees('12.5 lpa')).toBe(12_50_000);
    expect(parseRupees('7lakh')).toBe(7_00_000);
    expect(parseRupees('1.2cr')).toBe(1_20_00_000);
    expect(parseRupees('50k')).toBe(50_000);
  });

  it('returns null for anything it cannot read, rather than guessing zero', () => {
    expect(parseRupees('')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('12L4')).toBeNull();
    expect(parseRupees('-5000')).toBeNull();
  });
});

describe('month and year', () => {
  it('reads the month from the date string', () => {
    expect(formatMonthYear('2026-10-09')).toBe('October 2026');
    expect(formatMonthYear('2027-01-01')).toBe('January 2027');
    expect(formatMonthYear('2026-12-31')).toBe('December 2026');
  });
});
