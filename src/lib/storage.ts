/**
 * Remembers the last inputs in localStorage. Everything is wrapped in try/catch: private windows
 * and blocked site data throw on access, and losing saved inputs must never break the calculator.
 *
 * The stored value is round-tripped through the URL codec, so it gets the same validation and
 * clamping as a shared link, and old saved data cannot inject unexpected shapes.
 */

import { decodeState, encodeState, type CalculatorState } from './url-state';

const KEY = 'inhand:inputs';

export function saveState(state: CalculatorState): void {
  try {
    localStorage.setItem(KEY, encodeState(state, true));
  } catch {
    /* storage unavailable: the calculator still works, it just will not remember */
  }
}

export function loadState(): CalculatorState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? decodeState(raw) : null;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
