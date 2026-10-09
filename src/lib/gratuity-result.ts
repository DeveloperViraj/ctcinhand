/**
 * The gratuity guide's small calculator: wages, service and employment type in, an HTML result
 * out. Shared by the page's build-time render and its browser script, so both show the same thing.
 */

import { formatRupees } from './format';
import {
  annualGratuityProvision,
  estimateGratuity,
  GRATUITY,
  type EmploymentType,
} from './tax/gratuity';

export interface GratuityQuery {
  /** Labour Code wages a month. */
  wages: number | null;
  years: number | null;
  months: number | null;
  employment: EmploymentType;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "4 years 7 months", "1 year", "9 months". */
export function describeService(years: number, months: number): string {
  if (years === 0 && months === 0) return 'no service';
  return [years > 0 && plural(years, 'year'), months > 0 && plural(months, 'month')]
    .filter(Boolean)
    .join(' ');
}

const figure = (label: string, amount: string, detail: string) =>
  `<p class="text-sm text-ink-2">${label}</p>
   <p class="mt-1 text-figure font-medium tabular-nums text-ink">${amount}</p>
   <p class="mt-2 text-sm text-ink-2">${detail}</p>`;

export function renderGratuity(q: GratuityQuery): string {
  const years = q.years ?? NaN;
  const months = q.months ?? NaN;
  if (q.wages === null || q.wages <= 0) {
    return `<p class="text-sm text-ink-2">Enter your monthly wages to see your gratuity.</p>`;
  }
  if (!Number.isInteger(years) || years < 0 || years > 60) {
    return `<p class="text-sm text-ink-2">Enter your years of service as a whole number.</p>`;
  }
  if (!Number.isInteger(months) || months < 0 || months > 11) {
    return `<p class="text-sm text-ink-2">Enter the extra months as a number from 0 to 11.</p>`;
  }

  const service = years + months / 12;
  const g = estimateGratuity(q.wages, service, q.employment);
  const served = describeService(years, months);

  if (!g.eligible) {
    const short = Math.round((g.minimumYears - service) * 12);
    const toGo = describeService(Math.floor(short / 12), short % 12);
    const who = q.employment === 'fixed-term' ? 'A fixed-term employee' : 'A permanent employee';
    return figure(
      'Gratuity if you leave now',
      formatRupees(0),
      `${who} qualifies after ${plural(g.minimumYears, 'year')} of continuous service, so ${
        service > 0 ? `after ${served} ` : ''
      }nothing is due yet: ${toGo} to go. Gratuity is paid sooner on death or disablement.`,
    );
  }

  const perYear = annualGratuityProvision(q.wages);
  const counted =
    q.employment === 'fixed-term'
      ? `${served}, pro rata`
      : `${plural(g.countedYears, 'year')}${
          g.countedYears !== years
            ? ` (${served}, with the part year over six months counted as a full year)`
            : months > 0
              ? ` (${served}; a part year counts only above six months)`
              : ''
        }`;
  const formula = `15/26 of ${formatRupees(q.wages)} is ${formatRupees(perYear)} for each year, for ${counted}.`;
  const capped = g.capped
    ? ` That comes to ${formatRupees(perYear * g.countedYears)}, above the ${formatRupees(GRATUITY.maximum)} maximum, so ${formatRupees(GRATUITY.maximum)} is paid.`
    : '';
  return figure('Gratuity if you leave now', formatRupees(g.amount), formula + capped);
}
