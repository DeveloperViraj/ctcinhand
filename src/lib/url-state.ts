/**
 * Encodes the calculator inputs into a query string so a result can be shared as a link, and reads
 * one back safely.
 *
 * Only values that differ from the defaults are written, which keeps shared links short. Every
 * value read back is validated and clamped: a link is untrusted input, and a malformed one should
 * fall back to the default rather than produce a nonsense salary.
 */

import type { CalculatorInput, ComponentValue } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { HRA_CITY_OPTIONS } from './tax/hra';
import { STATES } from './tax/professional-tax';

export type Mode = 'quick' | 'advanced';

export interface CalculatorState {
  mode: Mode;
  input: CalculatorInput;
}

export const DEFAULT_STATE: CalculatorState = { mode: 'quick', input: DEFAULT_INPUT };

const STATE_CODES = new Set(STATES.map((s) => s.code));
const CITY_NAMES = new Set<string>(HRA_CITY_OPTIONS);

/** Percent values are written as "50p", rupee values as plain numbers. */
function encodeComponent(v: ComponentValue | 'balance'): string {
  if (v === 'balance') return 'b';
  return v.unit === 'percent' ? `${round(v.value)}p` : `${round(v.value)}`;
}

function decodeComponent(
  raw: string | null,
  fallback: ComponentValue | 'balance',
  maxPercent = 100,
) {
  if (!raw) return fallback;
  if (raw === 'b') return 'balance' as const;
  const percent = raw.endsWith('p');
  const value = Number.parseFloat(percent ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return percent
    ? ({ unit: 'percent', value: Math.min(value, maxPercent) } as ComponentValue)
    : ({ unit: 'rupees', value: Math.min(value, 1e10) } as ComponentValue);
}

const round = (n: number) => Math.round(n * 100) / 100;
const num = (raw: string | null, fallback: number, min: number, max: number) => {
  if (raw === null) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
};
const bool = (raw: string | null, fallback: boolean) => (raw === null ? fallback : raw === '1');

export function encodeState(state: CalculatorState): string {
  const p = new URLSearchParams();
  const d = DEFAULT_STATE.input;
  const i = state.input;
  const put = (key: string, value: string, fallback: string) => {
    if (value !== fallback) p.set(key, value);
  };

  if (state.mode !== DEFAULT_STATE.mode) p.set('m', state.mode);
  put('c', String(round(i.ctc)), String(d.ctc));
  put('b', encodeComponent(i.basic), encodeComponent(d.basic));
  put('h', encodeComponent(i.hra), encodeComponent(d.hra));
  put('l', encodeComponent(i.lta), encodeComponent(d.lta));
  put('v', encodeComponent(i.variable), encodeComponent(d.variable));
  put('n', encodeComponent(i.employerNps), encodeComponent(d.employerNps));
  put('s', encodeComponent(i.specialAllowance), encodeComponent(d.specialAllowance));

  put('pf', i.pfMode, d.pfMode);
  put('pi', i.employerPfInCtc ? '1' : '0', d.employerPfInCtc ? '1' : '0');
  put('ei', i.employerEsiInCtc ? '1' : '0', d.employerEsiInCtc ? '1' : '0');
  put('gi', i.gratuityInCtc ? '1' : '0', d.gratuityInCtc ? '1' : '0');
  put('sw', i.specialAllowanceAsWages ? '1' : '0', d.specialAllowanceAsWages ? '1' : '0');

  put('a', String(i.age), String(d.age));
  put('r', i.resident ? '1' : '0', d.resident ? '1' : '0');
  put('et', i.employerType, d.employerType);
  put('em', i.employmentType, d.employmentType);
  put('y', String(round(i.yearsOfService)), String(d.yearsOfService));
  put('di', i.disabled ? '1' : '0', d.disabled ? '1' : '0');

  put('st', i.stateCode, d.stateCode);
  put('ci', i.city, d.city);
  put('rt', String(round(i.monthlyRent)), String(d.monthlyRent));
  put('pc', i.ptCategory, d.ptCategory);
  if (i.ptOverrideMonthly !== null) p.set('po', String(round(i.ptOverrideMonthly)));

  put('d1', String(round(i.deductions.sec80C)), String(d.deductions.sec80C));
  put('d2', String(round(i.deductions.nps80CCD1B)), String(d.deductions.nps80CCD1B));
  put('d3', String(round(i.deductions.healthInsurance)), String(d.deductions.healthInsurance));
  put(
    'd4',
    String(round(i.deductions.selfOccupiedInterest)),
    String(d.deductions.selfOccupiedInterest),
  );

  return p.toString();
}

export function decodeState(search: string): CalculatorState {
  const p = new URLSearchParams(search);
  const d = DEFAULT_STATE.input;
  const stateCode = p.get('st');
  const city = p.get('ci');
  const pfMode = p.get('pf');
  const employerType = p.get('et');
  const employmentType = p.get('em');
  const ptCategory = p.get('pc');
  const mode = p.get('m');
  const ptOverride = p.get('po');

  return {
    mode: mode === 'advanced' || mode === 'quick' ? mode : DEFAULT_STATE.mode,
    input: {
      ctc: num(p.get('c'), d.ctc, 0, 1e10),
      basic: decodeComponent(p.get('b'), d.basic) as ComponentValue,
      hra: decodeComponent(p.get('h'), d.hra, 200) as ComponentValue,
      lta: decodeComponent(p.get('l'), d.lta, 200) as ComponentValue,
      variable: decodeComponent(p.get('v'), d.variable) as ComponentValue,
      employerNps: decodeComponent(p.get('n'), d.employerNps, 100) as ComponentValue,
      specialAllowance: decodeComponent(p.get('s'), d.specialAllowance),

      pfMode: pfMode === 'ceiling' || pfMode === 'actual' || pfMode === 'none' ? pfMode : d.pfMode,
      employerPfInCtc: bool(p.get('pi'), d.employerPfInCtc),
      employerEsiInCtc: bool(p.get('ei'), d.employerEsiInCtc),
      gratuityInCtc: bool(p.get('gi'), d.gratuityInCtc),
      specialAllowanceAsWages: bool(p.get('sw'), d.specialAllowanceAsWages),

      age: Math.round(num(p.get('a'), d.age, 15, 100)),
      resident: bool(p.get('r'), d.resident),
      employerType:
        employerType === 'government' || employerType === 'other' ? employerType : d.employerType,
      employmentType:
        employmentType === 'permanent' || employmentType === 'fixed-term'
          ? employmentType
          : d.employmentType,
      yearsOfService: num(p.get('y'), d.yearsOfService, 0, 60),
      disabled: bool(p.get('di'), d.disabled),

      stateCode: stateCode && STATE_CODES.has(stateCode) ? stateCode : d.stateCode,
      city: city && CITY_NAMES.has(city) ? city : d.city,
      monthlyRent: num(p.get('rt'), d.monthlyRent, 0, 1e7),
      ptCategory: ptCategory === 'men' || ptCategory === 'women' ? ptCategory : d.ptCategory,
      ptOverrideMonthly: ptOverride === null ? null : num(ptOverride, 0, 0, 1_000),

      deductions: {
        sec80C: num(p.get('d1'), d.deductions.sec80C, 0, 1e8),
        nps80CCD1B: num(p.get('d2'), d.deductions.nps80CCD1B, 0, 1e8),
        healthInsurance: num(p.get('d3'), d.deductions.healthInsurance, 0, 1e8),
        selfOccupiedInterest: num(p.get('d4'), d.deductions.selfOccupiedInterest, 0, 1e8),
      },
    },
  };
}
