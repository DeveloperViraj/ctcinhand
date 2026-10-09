import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT } from './tax/defaults';
import {
  decodeState,
  effectiveInput,
  encodeState,
  DEFAULT_STATE,
  type CalculatorState,
} from './url-state';

const state = (
  o: Partial<CalculatorState['input']> = {},
  mode: CalculatorState['mode'] = 'quick',
) => ({
  mode,
  input: { ...DEFAULT_STATE.input, ...o },
});

describe('URL encoding', () => {
  it('produces an empty query for the defaults', () => {
    expect(encodeState(DEFAULT_STATE)).toBe('');
  });

  it('writes only what differs from the defaults', () => {
    expect(encodeState(state({ ctc: 25_00_000 }))).toBe('c=2500000');
    expect(encodeState(state({ monthlyRent: 30_000 }))).toBe('rt=30000');
  });

  it('round-trips a fully customised state', () => {
    const custom = state(
      {
        ctc: 34_50_000,
        basic: { unit: 'percent', value: 42.5 },
        hra: { unit: 'rupees', value: 4_80_000 },
        lta: { unit: 'percent', value: 8 },
        variable: { unit: 'percent', value: 15 },
        employerNps: { unit: 'percent', value: 10 },
        specialAllowance: 'balance',
        pfMode: 'actual',
        employerPfInCtc: false,
        employerEsiInCtc: false,
        gratuityInCtc: false,
        specialAllowanceAsWages: true,
        age: 61,
        resident: false,
        employerType: 'government',
        employmentType: 'fixed-term',
        yearsOfService: 2.5,
        disabled: true,
        stateCode: 'WB',
        city: 'Kolkata',
        monthlyRent: 45_000,
        ptCategory: 'women',
        ptOverrideMonthly: 150,
        deductions: {
          sec80C: 1_50_000,
          nps80CCD1B: 50_000,
          healthInsurance: 25_000,
          selfOccupiedInterest: 2_00_000,
        },
      },
      'advanced',
    );
    expect(decodeState(encodeState(custom))).toEqual(custom);
  });

  it('leaves hidden Advanced settings out of a Quick-mode link', () => {
    const quick = state({
      ctc: 18_00_000,
      basic: { unit: 'percent', value: 40 },
      pfMode: 'actual',
    });
    expect(encodeState(quick)).toBe('c=1800000');
    // Storage keeps them, so Advanced comes back as it was left.
    expect(decodeState(encodeState(quick, true)).input).toEqual(quick.input);
  });

  it('keeps shared links short', () => {
    const typical = state({ ctc: 18_00_000, stateCode: 'MH', city: 'Mumbai', monthlyRent: 35_000 });
    expect(encodeState(typical).length).toBeLessThan(60);
  });
});

describe('URL decoding is defensive, because a link is untrusted input', () => {
  it('falls back to defaults for an empty or junk query', () => {
    expect(decodeState('')).toEqual(DEFAULT_STATE);
    expect(decodeState('c=not-a-number&st=ZZ&ci=Atlantis')).toEqual(DEFAULT_STATE);
  });

  it('rejects unknown states and cities rather than passing them through', () => {
    expect(decodeState('st=XX').input.stateCode).toBe(DEFAULT_STATE.input.stateCode);
    expect(decodeState('ci=Gotham').input.city).toBe(DEFAULT_STATE.input.city);
    expect(decodeState('st=TS').input.stateCode).toBe('TS');
  });

  it('clamps out-of-range numbers', () => {
    expect(decodeState('c=-5000').input.ctc).toBe(0);
    expect(decodeState('c=999999999999').input.ctc).toBe(1e10);
    expect(decodeState('a=3').input.age).toBe(15);
    expect(decodeState('a=250').input.age).toBe(100);
    expect(decodeState('b=900p').input.basic).toEqual({ unit: 'percent', value: 100 });
  });

  it('rejects invalid enum values', () => {
    expect(decodeState('pf=whatever').input.pfMode).toBe(DEFAULT_STATE.input.pfMode);
    expect(decodeState('em=slave').input.employmentType).toBe('permanent');
    expect(decodeState('m=sideways').mode).toBe('quick');
    expect(decodeState('m=advanced').mode).toBe('advanced');
  });

  it('treats a missing PT override as null, not zero', () => {
    expect(decodeState('').input.ptOverrideMonthly).toBeNull();
    expect(decodeState('po=0').input.ptOverrideMonthly).toBe(0);
  });
});

describe('effectiveInput', () => {
  it('uses the defaults for everything Quick mode does not show', () => {
    const quick = state({
      ctc: 18_00_000,
      stateCode: 'MH',
      city: 'Mumbai',
      monthlyRent: 30_000,
      basic: { unit: 'percent', value: 40 },
      deductions: { ...DEFAULT_INPUT.deductions, sec80C: 1_50_000 },
    });
    expect(effectiveInput(quick)).toEqual({
      ...DEFAULT_INPUT,
      ctc: 18_00_000,
      stateCode: 'MH',
      city: 'Mumbai',
      monthlyRent: 30_000,
    });
  });

  it('uses every setting in Advanced mode', () => {
    const advanced = state({ basic: { unit: 'percent', value: 40 } }, 'advanced');
    expect(effectiveInput(advanced)).toBe(advanced.input);
  });
});
