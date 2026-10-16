import { describe, expect, it } from 'vitest';
import {
  decodeOffers,
  encodeOffers,
  renderComparison,
  summarizeOffer,
  type OfferInput,
  type OfferSummary,
} from './offers';
import { calculate } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';

const lakh = (n: number) => Math.round(n * 1_00_000);
const offer = (overrides: Partial<OfferInput> = {}): OfferInput => ({
  name: 'Offer',
  ctc: lakh(12),
  variable: { unit: 'percent', value: 0 },
  joiningBonus: 0,
  basicPercent: 50,
  pfMode: 'ceiling',
  stateCode: 'KA',
  city: 'Bengaluru',
  monthlyRent: 0,
  ...overrides,
});
const summary = (o: OfferInput) => {
  const r = summarizeOffer(o);
  if (!r.ok) throw new Error(r.problem);
  return r.offer as OfferSummary;
};

describe('summarizeOffer', () => {
  it('matches the main calculator for the standard structure', () => {
    const s = summary(offer({ ctc: lakh(18), stateCode: 'MH', city: 'Mumbai' }));
    const r = calculate({ ...DEFAULT_INPUT, ctc: lakh(18), stateCode: 'MH', city: 'Mumbai' });
    expect(s.monthly).toBeCloseTo(r.regimes[r.better].monthlyTakeHome, 6);
    expect(s.annual).toBeCloseTo(r.regimes[r.better].annualTakeHome, 6);
  });

  it('keeps variable pay out of the monthly figure but in the annual one', () => {
    const fixed = summary(offer({ ctc: lakh(20) }));
    const withVariable = summary(
      offer({ ctc: lakh(20), variable: { unit: 'percent', value: 10 } }),
    );
    expect(withVariable.variable).toBe(lakh(2));
    expect(withVariable.monthly).toBeLessThan(fixed.monthly);
    expect(withVariable.annual).toBeGreaterThan(withVariable.monthly * 12);
  });

  it('taxes a joining bonus at the marginal rate and adds it to the first year only', () => {
    const s = summary(offer({ ctc: lakh(30), joiningBonus: lakh(2) }));
    expect(s.joiningNet).toBeLessThan(lakh(2));
    // Taxable income at a 30 lakh CTC is well inside the 30% slab: 30% plus 4% cess.
    expect(s.joiningNet).toBeCloseTo(lakh(2) * (1 - 0.3 * 1.04), 0);
    expect(s.firstYear).toBeCloseTo(s.annual + s.joiningNet, 6);
  });

  it('explains what is wrong instead of guessing', () => {
    expect(summarizeOffer(offer({ ctc: null }))).toEqual({
      ok: false,
      problem: 'Enter the CTC, a year.',
    });
    expect(summarizeOffer(offer({ basicPercent: 5 })).ok).toBe(false);
    expect(summarizeOffer(offer({ variable: { unit: 'percent', value: 90 } })).ok).toBe(false);
  });
});

describe('renderComparison', () => {
  it('names the offer that pays more each month, and by how much', () => {
    const html = renderComparison([
      offer({ name: 'Current job' }),
      offer({ name: 'New offer', ctc: lakh(15) }),
    ]);
    expect(html).toContain('New offer puts more in your bank');
    expect(html).toContain('more a month');
    expect(html).toContain('Full breakdown of Current job');
  });

  it('points out when a joining bonus flips the first year', () => {
    const html = renderComparison([
      offer({ name: 'A', ctc: lakh(15), joiningBonus: lakh(3) }),
      offer({ name: 'B', ctc: lakh(15.5) }),
    ]);
    expect(html).toContain('B puts more in your bank');
    expect(html).toContain('In the first year, though, A comes out');
  });

  it('escapes offer names', () => {
    const html = renderComparison([
      offer({ name: '<img src=x onerror=alert(1)>' }),
      offer({ name: 'B' }),
    ]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('reports a problem with either offer', () => {
    expect(renderComparison([offer({ name: 'A' }), offer({ name: 'B', ctc: null })])).toContain(
      'Enter the CTC',
    );
  });
});

describe('offer links', () => {
  it('round-trips both offers', () => {
    const offers: [OfferInput, OfferInput] = [
      offer({ name: 'Current job', ctc: lakh(12) }),
      offer({
        name: 'New offer',
        ctc: lakh(18),
        variable: { unit: 'rupees', value: 1_50_000 },
        joiningBonus: lakh(1),
        basicPercent: 40,
        pfMode: 'actual',
        stateCode: 'MH',
        city: 'Pune',
        monthlyRent: 25_000,
      }),
    ];
    expect(decodeOffers(encodeOffers(offers), [offer(), offer()])).toEqual(offers);
  });

  it('keeps the defaults for anything invalid', () => {
    const fallback: [OfferInput, OfferInput] = [offer({ name: 'A' }), offer({ name: 'B' })];
    const decoded = decodeOffers('ac=1500000&ast=ZZ&aci=Atlantis&apf=x&bn=B', fallback);
    expect(decoded[0].ctc).toBe(lakh(15));
    expect(decoded[0].stateCode).toBe('KA');
    expect(decoded[0].city).toBe('Bengaluru');
    expect(decoded[0].pfMode).toBe('ceiling');
    expect(decoded[1]).toEqual(fallback[1]);
  });
});
