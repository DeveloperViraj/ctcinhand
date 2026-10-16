import { describe, expect, it } from 'vitest';
import { calculatorLink, compareHike, ctcAfterHike, hikePercent, renderHike } from './hike';

const lakh = (n: number) => Math.round(n * 1_00_000);
const at = (ctc: number, newCtc: number) => compareHike(ctc, newCtc, 'KA', 'Bengaluru')!;

describe('hike arithmetic', () => {
  it('converts between a percentage and a new CTC', () => {
    expect(hikePercent(lakh(10), lakh(12))).toBe(20);
    expect(ctcAfterHike(lakh(10), 20)).toBe(lakh(12));
    expect(hikePercent(lakh(9), lakh(10))).toBe(11.1);
  });
});

describe('compareHike', () => {
  it('splits the extra CTC into in-hand, tax and the rest, adding up exactly', () => {
    for (const [from, to] of [
      [6, 7],
      [10, 12],
      [15, 18],
      [30, 36],
      [60, 75],
    ]) {
      const o = at(lakh(from), lakh(to));
      const total = o.split.inHand + o.split.tax + o.split.rest;
      expect(total).toBeCloseTo(lakh(to) - lakh(from), 0);
      expect(o.hike).toBeCloseTo(to / from - 1, 10);
    }
  });

  it('shows tax taking part of a raise at higher salaries', () => {
    const o = at(lakh(30), lakh(36));
    expect(o.monthlyGain).toBeGreaterThan(0);
    expect(o.split.tax).toBeGreaterThan(0);
    expect(o.inHandHike).toBeLessThan(o.hike);
  });

  it('finds the band just above Rs 12 lakh where a raise leaves less in hand', () => {
    let drop: ReturnType<typeof at> | null = null;
    for (let ctc = lakh(13); ctc < lakh(14.5) && !drop; ctc += 10_000) {
      const o = at(ctc, ctc + 10_000);
      if (o.monthlyGain < -0.5) drop = o;
    }
    expect(drop).not.toBeNull();
    expect(drop!.split.tax).toBeGreaterThan(drop!.after.ctc - drop!.before.ctc - drop!.split.rest);
  });
});

describe('renderHike', () => {
  const q = { stateCode: 'KA', city: 'Bengaluru' };

  it('asks for what is missing', () => {
    expect(renderHike({ ...q, ctc: null, newCtc: lakh(12) })).toContain('current CTC');
    expect(renderHike({ ...q, ctc: lakh(10), newCtc: null })).toContain('the hike');
    expect(renderHike({ ...q, ctc: lakh(10), newCtc: lakh(10) })).toContain('the same');
  });

  it('reports the monthly change and links to the full breakdown', () => {
    const html = renderHike({ ...q, ctc: lakh(10), newCtc: lakh(12) });
    expect(html).toContain('Your in-hand goes up by');
    expect(html).toContain('20% hike on CTC');
    expect(html).toContain(calculatorLink(lakh(12), 'KA', 'Bengaluru'));
  });

  it('says so plainly when a raise lowers in-hand pay', () => {
    let html = '';
    for (let ctc = lakh(13); ctc < lakh(14.5) && !html.includes('goes down'); ctc += 10_000) {
      html = renderHike({ ...q, ctc, newCtc: ctc + 10_000 });
    }
    expect(html).toContain('Your in-hand goes down by');
    expect(html).toContain('/marginal-relief');
  });
});

describe('calculatorLink', () => {
  it('carries the new CTC and location in a Quick-mode link', () => {
    const link = calculatorLink(lakh(18), 'MH', 'Mumbai');
    expect(link.startsWith('/?')).toBe(true);
    const params = new URLSearchParams(link.slice(2));
    expect(params.get('c')).toBe(String(lakh(18)));
    expect(params.get('m')).toBeNull();
  });
});
