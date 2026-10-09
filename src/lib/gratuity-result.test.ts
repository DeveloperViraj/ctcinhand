import { describe, expect, it } from 'vitest';
import { describeService, renderGratuity, type GratuityQuery } from './gratuity-result';

const text = (q: Partial<GratuityQuery>) =>
  renderGratuity({ wages: 50_000, years: 5, months: 0, employment: 'permanent', ...q })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('describeService', () => {
  it('names years and months', () => {
    expect(describeService(4, 7)).toBe('4 years 7 months');
    expect(describeService(1, 0)).toBe('1 year');
    expect(describeService(0, 1)).toBe('1 month');
  });
});

describe('renderGratuity', () => {
  it('works out five years for a permanent employee', () => {
    expect(text({})).toContain('₹1,44,231');
    expect(text({})).toContain('15/26 of ₹50,000 is ₹28,846 for each year, for 5 years.');
  });

  it('counts a part year only when it is over six months', () => {
    expect(text({ months: 6 })).toContain('₹1,44,231');
    expect(text({ months: 6 })).toContain('a part year counts only above six months');
    expect(text({ months: 7 })).toContain('₹1,73,077');
    expect(text({ months: 7 })).toContain('6 years (5 years 7 months');
  });

  it('says how long a permanent employee has to go', () => {
    const t = text({ years: 4, months: 11 });
    expect(t).toContain('₹0');
    expect(t).toContain('after 5 years of continuous service');
    expect(t).toContain('1 month to go');
  });

  it('pays fixed-term staff pro rata from one year', () => {
    expect(text({ years: 0, months: 11, employment: 'fixed-term' })).toContain('1 month to go');
    const t = text({ years: 2, months: 6, employment: 'fixed-term' });
    expect(t).toContain('₹72,115');
    expect(t).toContain('2 years 6 months, pro rata');
  });

  it('applies the Rs 20 lakh maximum', () => {
    const t = text({ wages: 2_08_333, years: 20 });
    expect(t).toContain('₹20,00,000');
    expect(t).toContain('above the ₹20,00,000 maximum');
  });

  it('asks for usable input', () => {
    expect(text({ wages: null })).toContain('Enter your monthly wages');
    expect(text({ years: 2.5 })).toContain('whole number');
    expect(text({ months: 12 })).toContain('from 0 to 11');
  });
});
