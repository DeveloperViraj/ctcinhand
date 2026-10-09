/**
 * The gratuity guide's calculator. Recomputes on every keystroke with the same renderer the page
 * was built with.
 */

import { parseRupees } from '../lib/format';
import { renderGratuity } from '../lib/gratuity-result';
import type { EmploymentType } from '../lib/tax/gratuity';

export function mountGratuity(): void {
  const form = document.getElementById('gratuity') as HTMLFormElement | null;
  const output = document.getElementById('g-result');
  const wages = document.getElementById('g-wages') as HTMLInputElement | null;
  const years = document.getElementById('g-years') as HTMLInputElement | null;
  const months = document.getElementById('g-months') as HTMLInputElement | null;
  if (!form || !output || !wages || !years || !months) return;

  const whole = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  };

  const render = () => {
    const employment = (form.elements.namedItem('g-type') as RadioNodeList).value as EmploymentType;
    output.innerHTML = renderGratuity({
      wages: parseRupees(wages.value),
      years: whole(years.value),
      months: whole(months.value),
      employment,
    });
  };

  form.addEventListener('input', render);
  form.addEventListener('submit', (event) => event.preventDefault());
  wages.addEventListener('change', () => {
    const n = parseRupees(wages.value);
    if (n !== null) wages.value = n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  });
  render();
}
