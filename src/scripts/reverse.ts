/**
 * The in-hand to CTC calculator. Every change re-runs the search after the keystroke has painted;
 * the inputs live in the address so a result can be shared.
 */

import { CITY_VALUES } from '../lib/city-options';
import { parseRupees } from '../lib/format';
import { renderReverse } from '../lib/reverse';
import { STATES } from '../lib/tax/professional-tax';
import { bindCityToState, refreshCities } from './city-select';

const STATE_CODES = new Set(STATES.map((s) => s.code));
const CITIES = new Set(CITY_VALUES);

export function mountReverse(): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const form = $<HTMLFormElement>('reverse');
  const output = $('r-result');
  const inHand = $<HTMLInputElement>('r-inhand');
  const variable = $<HTMLInputElement>('r-var');
  const rent = $<HTMLInputElement>('r-rent');
  const state = $<HTMLSelectElement>('r-state');
  const city = $<HTMLSelectElement>('r-city');
  if (!form || !output || !inHand || !variable || !rent || !state || !city) return;
  bindCityToState(state, city);

  const grouped = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const percent = (raw: string): number => {
    const n = Number(raw.trim().replace(/%$/, ''));
    return raw.trim() !== '' && Number.isFinite(n) ? n : 0;
  };

  // A shared link sets the fields; anything missing or invalid keeps the page's defaults.
  const params = new URLSearchParams(window.location.search);
  const ih = parseRupees(params.get('ih') ?? '');
  if (ih !== null && ih > 0) inHand.value = grouped(ih);
  const st = params.get('st');
  const ci = params.get('ci');
  if (st && STATE_CODES.has(st)) {
    state.value = st;
    refreshCities(city, st, ci && CITIES.has(ci) ? ci : city.value);
  }
  const r = parseRupees(params.get('r') ?? '');
  if (r !== null && r >= 0) rent.value = grouped(r);
  const v = params.get('v');
  if (v !== null) variable.value = String(Math.min(99, Math.max(0, percent(v))));

  let frame = 0;
  let timer: number | undefined;
  const render = () => {
    const query = {
      inHand: parseRupees(inHand.value),
      stateCode: state.value,
      city: city.value,
      monthlyRent: Math.max(0, parseRupees(rent.value) ?? 0),
      variablePercent: percent(variable.value),
    };
    output.innerHTML = renderReverse(query);
    const p = new URLSearchParams();
    if (query.inHand !== null) p.set('ih', String(Math.round(query.inHand)));
    p.set('st', query.stateCode);
    p.set('ci', query.city);
    if (query.monthlyRent > 0) p.set('r', String(Math.round(query.monthlyRent)));
    if (query.variablePercent > 0) p.set('v', String(query.variablePercent));
    window.history.replaceState(null, '', `?${p}`);
  };
  /** After the keystroke has painted, and once typing pauses, so typing never waits on the search. */
  const schedule = (wait: number) => {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    frame = requestAnimationFrame(() => {
      timer = window.setTimeout(render, wait);
    });
  };

  form.addEventListener('input', () => schedule(150));
  form.addEventListener('change', () => schedule(0));
  form.addEventListener('submit', (event) => event.preventDefault());
  // Money is regrouped in lakh and crore once you leave the field, never while you type.
  for (const field of [inHand, rent]) {
    field.addEventListener('focusout', () => {
      const n = parseRupees(field.value);
      if (n !== null) field.value = grouped(n);
    });
  }
  if (window.location.search.length > 1) render();
}
