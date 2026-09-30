// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderDetails, renderSummary } from './render-result';
import { calculate, type CalculatorInput } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';

const scenario = (overrides: Partial<CalculatorInput>): CalculatorInput => ({
  ...DEFAULT_INPUT,
  ...overrides,
  deductions: { ...DEFAULT_INPUT.deductions, ...overrides.deductions },
});

const SCENARIOS: Record<string, CalculatorInput> = {
  default: DEFAULT_INPUT,
  'marginal relief': scenario({ ctc: 14_00_000 }),
  'employer PF, ESI and gratuity outside CTC': scenario({
    ctc: 3_00_000,
    stateCode: 'WB',
    employerPfInCtc: false,
    gratuityInCtc: false,
    employerEsiInCtc: false,
  }),
  'old regime with deductions': scenario({
    ctc: 30_00_000,
    stateCode: 'MH',
    city: 'Mumbai',
    monthlyRent: 50_000,
    deductions: {
      sec80C: 1_50_000,
      nps80CCD1B: 50_000,
      healthInsurance: 25_000,
      selfOccupiedInterest: 2_00_000,
    },
  }),
  'surcharge and variable pay': scenario({
    ctc: 60_00_000,
    variable: { unit: 'percent', value: 15 },
    employerNps: { unit: 'percent', value: 10 },
  }),
  'Labour Code add-back': scenario({ ctc: 18_00_000, basic: { unit: 'percent', value: 30 } }),
};

/** "₹12,00,000" -> 1200000, "−₹21,600" -> -21600 */
const amount = (text: string) => {
  const negative = /^[−-]/.test(text.trim());
  const digits = Number(text.replace(/[^\d]/g, ''));
  return negative ? -digits : digits;
};

describe('renderDetails', () => {
  for (const [name, input] of Object.entries(SCENARIOS)) {
    it(`every ledger adds up to its total (${name})`, () => {
      const result = calculate(input);
      expect(result.errors).toEqual([]);
      document.body.innerHTML = renderDetails(result);

      const ledgers = [...document.querySelectorAll('table.ledger')];
      expect(ledgers.length).toBeGreaterThanOrEqual(3);
      for (const table of ledgers) {
        const total = table.querySelector('tfoot td');
        if (!total) continue;
        const rows = [...table.querySelectorAll('tbody td')].map((td) => amount(td.textContent!));
        const sum = rows.reduce((a, b) => a + b, 0);
        // Each row is rounded to the rupee on its own, so the sum may drift by a rupee per row.
        expect(Math.abs(sum - amount(total.textContent!))).toBeLessThanOrEqual(rows.length);
      }
    });
  }

  it('mentions employer contributions paid on top of CTC instead of listing them', () => {
    const result = calculate(SCENARIOS['employer PF, ESI and gratuity outside CTC']);
    document.body.innerHTML = renderDetails(result);
    const text = document.body.textContent!;
    expect(text).toContain('On top of your CTC, your employer also pays');
    expect(text).not.toMatch(/Employer PF\s*Yours/);
  });
});

describe('renderSummary', () => {
  it('shows the cheaper regime’s monthly figure as the headline', () => {
    for (const input of Object.values(SCENARIOS)) {
      const result = calculate(input);
      document.body.innerHTML = renderSummary(result);
      const shown = amount(document.querySelector('[data-headline-num]')!.textContent!);
      expect(shown).toBe(Math.round(result.regimes[result.better].monthlyTakeHome));
    }
  });

  it('shows an error instead of figures when the structure does not add up', () => {
    const result = calculate(scenario({ basic: { unit: 'percent', value: 120 } }));
    document.body.innerHTML = renderSummary(result);
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.querySelector('[data-headline-num]')).toBeNull();
  });
});
