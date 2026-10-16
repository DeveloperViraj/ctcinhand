/**
 * The salary hike calculator. The hike and the new CTC are two views of one number: typing either
 * rewrites the other, and changing the current CTC keeps the hike and moves the new CTC.
 */

import { parseRupees } from '../lib/format';
import { ctcAfterHike, hikePercent, renderHike } from '../lib/hike';

export function mountHike(): void {
  const form = document.getElementById('hike') as HTMLFormElement | null;
  const output = document.getElementById('h-result');
  const ctc = document.getElementById('h-ctc') as HTMLInputElement | null;
  const pct = document.getElementById('h-pct') as HTMLInputElement | null;
  const next = document.getElementById('h-new') as HTMLInputElement | null;
  const state = document.getElementById('h-state') as HTMLSelectElement | null;
  const city = document.getElementById('h-city') as HTMLSelectElement | null;
  if (!form || !output || !ctc || !pct || !next || !state || !city) return;

  const grouped = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const percent = (raw: string): number | null => {
    const n = Number(raw.trim().replace(/%$/, ''));
    return raw.trim() !== '' && Number.isFinite(n) ? n : null;
  };

  const render = () => {
    output.innerHTML = renderHike({
      ctc: parseRupees(ctc.value),
      newCtc: parseRupees(next.value),
      stateCode: state.value,
      city: city.value,
    });
  };

  const fromHike = () => {
    const base = parseRupees(ctc.value);
    const p = percent(pct.value);
    if (base !== null && p !== null) next.value = grouped(ctcAfterHike(base, p));
  };

  const fromNewCtc = () => {
    const base = parseRupees(ctc.value);
    const target = parseRupees(next.value);
    if (base !== null && base > 0 && target !== null) pct.value = String(hikePercent(base, target));
  };

  form.addEventListener('input', (event) => {
    if (event.target === pct || event.target === ctc) fromHike();
    else if (event.target === next) fromNewCtc();
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('submit', (event) => event.preventDefault());
  // Money is regrouped in lakh and crore once you leave the field, never while you type.
  for (const field of [ctc, next]) {
    field.addEventListener('focusout', () => {
      const n = parseRupees(field.value);
      if (n !== null) field.value = grouped(n);
    });
  }
  render();
}
