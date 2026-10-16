import { describe, expect, it } from 'vitest';
import { citiesInState, cityForState, cityOptionsHtml, elsewhereLabel } from './city-options';
import { calculate } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { HRA_CITY_OPTIONS } from './tax/hra';
import { decodeState, encodeState } from './url-state';

describe('city options by state', () => {
  it("lists a state's own 50% cities first", () => {
    expect(citiesInState('MH')).toEqual(['Mumbai', 'Pune']);
    expect(citiesInState('KA')).toEqual(['Bengaluru']);
    expect(citiesInState('HR')).toEqual([]);
  });

  it('names the 40% option for the state', () => {
    expect(elsewhereLabel('MH')).toBe('Elsewhere in Maharashtra');
    expect(elsewhereLabel('HR')).toBe('Anywhere in Haryana');
    expect(elsewhereLabel('DL')).toBe('Outside Delhi');
  });

  it('moves to the new state when the old city is not in it, and keeps it otherwise', () => {
    expect(cityForState('MH', 'Bengaluru')).toBe('Mumbai');
    expect(cityForState('MH', 'Pune')).toBe('Pune');
    expect(cityForState('HR', 'Bengaluru')).toBe('Other');
  });

  it('keeps every city selectable, once each, with the chosen one selected', () => {
    const html = cityOptionsHtml('MH', 'Delhi');
    for (const city of HRA_CITY_OPTIONS) {
      expect(html.match(new RegExp(`value="${city}"`, 'g'))).toHaveLength(1);
    }
    expect(html).toContain('<option value="Delhi" selected>');
    expect(html.indexOf('Mumbai')).toBeLessThan(html.indexOf('Live in another state?'));
  });
});

describe('joining bonus inside the CTC', () => {
  const lakh = (n: number) => n * 1_00_000;

  it('is left out of every figure', () => {
    const withBonus = calculate({ ...DEFAULT_INPUT, ctc: lakh(13), joiningBonus: lakh(1) });
    const without = calculate({ ...DEFAULT_INPUT, ctc: lakh(12) });
    expect(withBonus.errors).toEqual([]);
    expect(withBonus.regimes.new.monthlyTakeHome).toBeCloseTo(
      without.regimes.new.monthlyTakeHome,
      6,
    );
    expect(withBonus.structure.input.ctcAnnual).toBe(lakh(12));
  });

  it('cannot be the whole CTC', () => {
    const r = calculate({ ...DEFAULT_INPUT, ctc: lakh(5), joiningBonus: lakh(5) });
    expect(r.errors.join(' ')).toContain('joining bonus is more than the CTC');
  });

  it('travels in a share link, in Quick mode too', () => {
    const state = {
      mode: 'quick' as const,
      input: { ...DEFAULT_INPUT, ctc: lakh(14), joiningBonus: 75_000 },
    };
    const query = encodeState(state);
    expect(new URLSearchParams(query).get('jb')).toBe('75000');
    expect(decodeState(query).input.joiningBonus).toBe(75_000);
    expect(
      new URLSearchParams(encodeState({ mode: 'quick', input: DEFAULT_INPUT })).has('jb'),
    ).toBe(false);
  });
});
