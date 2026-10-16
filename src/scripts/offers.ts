/**
 * The compare-offers tool. Both offers are read from the form on every change and rendered with
 * the same function the page was built with. The address bar always carries both offers, so a
 * comparison can be reopened or sent to someone.
 */

import { parseRupees } from '../lib/format';
import { decodeOffers, DEFAULT_OFFERS, encodeOffers, renderComparison } from '../lib/offers';
import type { OfferInput } from '../lib/offers';
import type { PfMode } from '../lib/tax/provident-fund';
import { bindCityToState, refreshCities } from './city-select';

type Key = 'a' | 'b';
const KEYS: Key[] = ['a', 'b'];

export function mountOffers(): void {
  const form = document.getElementById('offers') as HTMLFormElement | null;
  const output = document.getElementById('offers-result');
  const share = document.getElementById('offers-share');
  if (!form || !output) return;

  const input = (k: Key, f: string) =>
    form.elements.namedItem(`${k}-${f}`) as HTMLInputElement | HTMLSelectElement | null;
  const radio = (name: string) => form.elements.namedItem(name) as RadioNodeList | null;
  const grouped = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  // An empty optional field means nothing, not an error.
  const orZero = (raw: string) => (raw.trim() === '' ? 0 : parseRupees(raw));

  const read = (k: Key): OfferInput => {
    const unit = radio(`${k}-var-unit`)?.value === 'rupees' ? 'rupees' : 'percent';
    const rawVariable = (input(k, 'var')?.value ?? '').replace(/%/g, '');
    return {
      name: input(k, 'name')?.value ?? '',
      ctc: parseRupees(input(k, 'ctc')?.value ?? ''),
      variable: { unit, value: Math.max(0, orZero(rawVariable) ?? 0) },
      joiningBonus: orZero(input(k, 'bonus')?.value ?? ''),
      basicPercent: parseRupees((input(k, 'basic')?.value ?? '').replace(/%/g, '')),
      pfMode: (radio(`${k}-pf`)?.value || 'ceiling') as PfMode,
      stateCode: input(k, 'state')?.value ?? 'KA',
      city: input(k, 'city')?.value ?? 'Other',
      monthlyRent: orZero(input(k, 'rent')?.value ?? ''),
    };
  };

  const write = (k: Key, o: OfferInput) => {
    const set = (f: string, value: string) => {
      const el = input(k, f);
      if (el) el.value = value;
    };
    set('name', o.name);
    set('ctc', grouped(o.ctc ?? 0));
    set('var', o.variable.unit === 'rupees' ? grouped(o.variable.value) : String(o.variable.value));
    set('bonus', grouped(o.joiningBonus ?? 0));
    set('basic', String(o.basicPercent ?? 50));
    set('state', o.stateCode);
    const citySelect = input(k, 'city');
    if (citySelect instanceof HTMLSelectElement) refreshCities(citySelect, o.stateCode, o.city);
    set('rent', grouped(o.monthlyRent ?? 0));
    const unit = radio(`${k}-var-unit`);
    if (unit) unit.value = o.variable.unit;
    const pf = radio(`${k}-pf`);
    if (pf) pf.value = o.pfMode;
  };

  let urlTimer: number | undefined;
  const offers = (): [OfferInput, OfferInput] => [read('a'), read('b')];
  const syncUrl = () => {
    window.history.replaceState(null, '', `?${encodeOffers(offers())}`);
  };
  const draw = () => {
    output.innerHTML = renderComparison(offers());
  };
  // The address only changes once the reader changes something, so a plain visit keeps a clean URL.
  const render = () => {
    draw();
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(syncUrl, 300);
  };

  for (const k of KEYS) {
    const state = input(k, 'state');
    const city = input(k, 'city');
    if (state instanceof HTMLSelectElement && city instanceof HTMLSelectElement) {
      bindCityToState(state, city);
    }
  }

  if (new URLSearchParams(window.location.search).has('ac')) {
    const linked = decodeOffers(window.location.search, DEFAULT_OFFERS);
    KEYS.forEach((k, i) => write(k, linked[i]));
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (event) => event.preventDefault());
  // Money is regrouped in lakh and crore once you leave the field, never while you type.
  form.addEventListener('focusout', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement) || !el.matches('[data-money]')) return;
    if (el.name.endsWith('-var') && radio(`${el.name}-unit`)?.value !== 'rupees') return;
    const n = parseRupees(el.value);
    if (n !== null) el.value = grouped(n);
  });

  share?.addEventListener('click', async () => {
    window.clearTimeout(urlTimer);
    syncUrl();
    const label = share.querySelector('[data-share-label]');
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (label) label.textContent = 'Link copied';
    } catch {
      window.prompt('Copy this link', window.location.href);
    }
    window.setTimeout(() => {
      if (label) label.textContent = 'Copy link to this comparison';
    }, 2000);
  });

  draw();
}
