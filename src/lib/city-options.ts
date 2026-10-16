/**
 * The "City you live in" list, arranged by the work state: that state's 50% HRA cities first, then
 * "elsewhere", then the other states' cities for people who live across a border (work in Gurugram,
 * live in Delhi). Every city stays selectable, so a saved or shared choice is never lost.
 */

import { HRA_FIFTY_PERCENT_CITIES, type HraCity } from './tax/hra';
import { STATES } from './tax/professional-tax';

const CITY_STATE: Record<(typeof HRA_FIFTY_PERCENT_CITIES)[number], string> = {
  Ahmedabad: 'GJ',
  Bengaluru: 'KA',
  Chennai: 'TN',
  Delhi: 'DL',
  Hyderabad: 'TS',
  Kolkata: 'WB',
  Mumbai: 'MH',
  Pune: 'MH',
};

export const citiesInState = (stateCode: string): HraCity[] =>
  HRA_FIFTY_PERCENT_CITIES.filter((c) => CITY_STATE[c] === stateCode);

const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? 'your state';

/** What the 40% option is called for this state. */
export function elsewhereLabel(stateCode: string): string {
  if (stateCode === 'DL') return 'Outside Delhi';
  return citiesInState(stateCode).length > 0
    ? `Elsewhere in ${stateName(stateCode)}`
    : `Anywhere in ${stateName(stateCode)}`;
}

/** The city to show after the work state changes: keep a city in that state, else its first one. */
export function cityForState(stateCode: string, current: string): string {
  const local = citiesInState(stateCode);
  if ((local as string[]).includes(current)) return current;
  return local[0] ?? 'Other';
}

const option = (value: string, label: string, selected: string) =>
  `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;

/** The `<option>` and `<optgroup>` markup for the city select. */
export function cityOptionsHtml(stateCode: string, selected: string): string {
  const local = citiesInState(stateCode);
  const others = HRA_FIFTY_PERCENT_CITIES.filter((c) => !(local as string[]).includes(c));
  return [
    ...local.map((c) => option(c, c, selected)),
    option('Other', elsewhereLabel(stateCode), selected),
    `<optgroup label="Live in another state?">${others.map((c) => option(c, c, selected)).join('')}</optgroup>`,
  ].join('');
}
