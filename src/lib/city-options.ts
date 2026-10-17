/**
 * The "City you live in" list, arranged by the work state: that state's cities first (the 50% HRA
 * cities, then other big job cities), then "elsewhere", then the other states' cities for people who
 * live across a border (work in Gurugram, live in Delhi). Every city stays selectable, so a saved or
 * shared choice is never lost.
 *
 * Only the eight cities in src/lib/tax/hra.ts get the 50% HRA limit. The others are named so people
 * can find their own city; they calculate exactly like "elsewhere" (40%), except that a Tamil Nadu
 * city other than Chennai keeps Tamil Nadu's town-by-town professional tax note.
 */

import { STATES } from './tax/professional-tax';

interface City {
  /** Stored in inputs and share links. */
  value: string;
  /** Shown in the list, with the old name where people still search for it. */
  label: string;
  state: string;
}

const city = (value: string, state: string, label = value): City => ({ value, label, state });

/** The eight 50% cities, then the 40% ones, each state's in order of how many people work there. */
export const CITIES: readonly City[] = [
  city('Ahmedabad', 'GJ'),
  city('Bengaluru', 'KA'),
  city('Chennai', 'TN'),
  city('Delhi', 'DL'),
  city('Hyderabad', 'TS'),
  city('Kolkata', 'WB'),
  city('Mumbai', 'MH'),
  city('Pune', 'MH'),

  city('Gurugram', 'HR', 'Gurugram (Gurgaon)'),
  city('Faridabad', 'HR'),
  city('Noida', 'UP'),
  city('Ghaziabad', 'UP'),
  city('Lucknow', 'UP'),
  city('Chandigarh', 'CH'),
  city('Mohali', 'PB'),
  city('Ludhiana', 'PB'),
  city('Jaipur', 'RJ'),
  city('Indore', 'MP'),
  city('Bhopal', 'MP'),
  city('Nagpur', 'MH'),
  city('Nashik', 'MH'),
  city('Surat', 'GJ'),
  city('Vadodara', 'GJ'),
  city('Mysuru', 'KA', 'Mysuru (Mysore)'),
  city('Mangaluru', 'KA', 'Mangaluru (Mangalore)'),
  city('Coimbatore', 'TN'),
  city('Kochi', 'KL', 'Kochi (Cochin)'),
  city('Thiruvananthapuram', 'KL', 'Thiruvananthapuram (Trivandrum)'),
  city('Visakhapatnam', 'AP', 'Visakhapatnam (Vizag)'),
  city('Vijayawada', 'AP'),
  city('Bhubaneswar', 'OR'),
  city('Patna', 'BR'),
  city('Ranchi', 'JH'),
  city('Guwahati', 'AS'),
  city('Dehradun', 'UK'),
];

/** Every value the city field can hold: the named cities and "Other" (elsewhere, 40%). */
export const CITY_VALUES: readonly string[] = [...CITIES.map((c) => c.value), 'Other'];

export const citiesInState = (stateCode: string): string[] =>
  CITIES.filter((c) => c.state === stateCode).map((c) => c.value);

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
  if (local.includes(current)) return current;
  return local[0] ?? 'Other';
}

const option = (c: { value: string; label: string }, selected: string) =>
  `<option value="${c.value}"${c.value === selected ? ' selected' : ''}>${c.label}</option>`;

/** The `<option>` and `<optgroup>` markup for the city select. */
export function cityOptionsHtml(stateCode: string, selected: string): string {
  const local = CITIES.filter((c) => c.state === stateCode);
  // Other states' cities alphabetically, so a long list is easy to scan.
  const others = CITIES.filter((c) => c.state !== stateCode).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  return [
    ...local.map((c) => option(c, selected)),
    option({ value: 'Other', label: elsewhereLabel(stateCode) }, selected),
    `<optgroup label="Live in another state?">${others.map((c) => option(c, selected)).join('')}</optgroup>`,
  ].join('');
}
