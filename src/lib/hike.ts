/**
 * The salary hike calculator: what a raise on CTC actually adds to monthly in-hand pay. Both sides
 * use the calculator's Quick-mode structure for the chosen state and city, and each side takes the
 * cheaper regime, which can differ before and after the hike.
 *
 * Shared by the page's build-time render and its browser script, so both show the same thing.
 */

import { formatCompactRupees, formatRupees } from './format';
import { calculate } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import type { Regime } from './tax/rates';
import { encodeState } from './url-state';

export interface HikeSide {
  ctc: number;
  /** Fixed monthly in-hand under the cheaper regime. */
  monthly: number;
  annual: number;
  tax: number;
  /** PF, gratuity, professional tax and anything else in CTC that is neither tax nor in-hand. */
  rest: number;
  regime: Regime;
}

export interface HikeOutcome {
  before: HikeSide;
  after: HikeSide;
  /** The raise on CTC, as a fraction: 0.2 is a 20% hike. */
  hike: number;
  /** The rise in annual in-hand pay, as a fraction of the old in-hand pay. */
  inHandHike: number;
  monthlyGain: number;
  /** Where the extra CTC goes in a year. The three parts add up to the CTC increase. */
  split: { inHand: number; tax: number; rest: number };
}

export interface HikeQuery {
  ctc: number | null;
  newCtc: number | null;
  stateCode: string;
  city: string;
}

/** The calculator's Quick-mode input at this CTC, state and city. */
const quickInput = (ctc: number, stateCode: string, city: string) => ({
  ...DEFAULT_INPUT,
  ctc,
  stateCode,
  city,
});

function side(ctc: number, stateCode: string, city: string): HikeSide | null {
  const result = calculate(quickInput(ctc, stateCode, city));
  if (result.errors.length > 0) return null;
  const best = result.regimes[result.better];
  const total = result.structure.annual.ctcComponents;
  return {
    ctc,
    monthly: best.monthlyTakeHome,
    annual: best.annualTakeHome,
    tax: best.tax.totalTax,
    rest: total - best.annualTakeHome - best.tax.totalTax,
    regime: result.better,
  };
}

export function compareHike(
  ctc: number,
  newCtc: number,
  stateCode: string,
  city: string,
): HikeOutcome | null {
  const before = side(ctc, stateCode, city);
  const after = side(newCtc, stateCode, city);
  if (!before || !after) return null;
  return {
    before,
    after,
    hike: newCtc / ctc - 1,
    inHandHike: before.annual > 0 ? after.annual / before.annual - 1 : 0,
    monthlyGain: after.monthly - before.monthly,
    split: {
      inHand: after.annual - before.annual,
      tax: after.tax - before.tax,
      rest: after.rest - before.rest,
    },
  };
}

/** The hike that turns `ctc` into `newCtc`, in percent, rounded to one place. */
export const hikePercent = (ctc: number, newCtc: number) =>
  Math.round((newCtc / ctc - 1) * 1000) / 10;

/** The new CTC after a hike of `percent`, to the nearest rupee. */
export const ctcAfterHike = (ctc: number, percent: number) => Math.round(ctc * (1 + percent / 100));

const pct = (fraction: number) => {
  const value = Math.round(fraction * 1000) / 10;
  return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}%`;
};

const signed = (amount: number) =>
  `${amount < 0 ? '−' : '+'}${formatRupees(Math.abs(Math.round(amount)))}`;

const REGIME: Record<Regime, string> = { new: 'new regime', old: 'old regime' };

/** Link to the full calculator, already set to the new CTC, state and city. */
export function calculatorLink(ctc: number, stateCode: string, city: string): string {
  const query = encodeState({ mode: 'quick', input: quickInput(ctc, stateCode, city) });
  return query ? `/?${query}` : '/';
}

// The result sits outside the article's prose styles, so links carry their own.
const LINK = 'font-medium text-accent-ink underline underline-offset-4';

const message = (text: string) => `<p class="text-sm text-ink-2">${text}</p>`;

export function renderHike(q: HikeQuery): string {
  if (q.ctc === null || q.ctc < 1_00_000) return message('Enter your current CTC, a year.');
  if (q.newCtc === null || q.newCtc <= 0) return message('Enter the hike, or your new CTC.');
  if (q.newCtc > 50_00_00_000) return message('That new CTC is beyond what the calculator covers.');
  if (q.newCtc === q.ctc) return message('Your new CTC is the same as the current one.');

  const o = compareHike(q.ctc, q.newCtc, q.stateCode, q.city);
  if (!o) return message('These figures do not make a salary the calculator can work out.');

  const { before, after, split } = o;
  const ctcGain = after.ctc - before.ctc;
  const down = o.monthlyGain < -0.5;
  const label = down ? 'Your in-hand goes down by' : 'Your in-hand goes up by';
  const figure = `${formatRupees(Math.abs(Math.round(o.monthlyGain)))}<span class="ml-2 text-2xl font-semibold tracking-normal text-ink-3">a month</span>`;

  const summary = `A ${pct(o.hike)} ${o.hike < 0 ? 'cut' : 'hike'} on CTC, from ${formatCompactRupees(before.ctc)} to ${formatCompactRupees(after.ctc)}, is a <strong class="text-ink">${pct(o.inHandHike)}</strong> change in what reaches your bank.`;

  const card = (
    title: string,
    s: HikeSide,
  ) => `<div class="rounded-md border border-line bg-surface p-4">
      <p class="text-sm font-medium text-ink-2">${title} · ${formatCompactRupees(s.ctc)}</p>
      <p class="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-ink">${formatRupees(s.monthly)}</p>
      <p class="text-xs text-ink-3">in hand a month, ${REGIME[s.regime]}</p>
    </div>`;

  const parts = [
    { label: 'Reaches your bank', value: split.inHand, color: 'var(--color-chart-take)' },
    { label: 'Income tax', value: split.tax, color: 'var(--color-chart-tax)' },
    { label: 'PF, gratuity, other', value: split.rest, color: 'var(--color-chart-save)' },
  ];
  const legend =
    ctcGain > 0
      ? `<div class="mt-5">
      <p class="text-sm font-semibold text-ink">Where the extra ${formatRupees(ctcGain)} a year goes</p>
      <ul class="mt-3 space-y-2 text-sm">${parts
        .map(
          (p) => `<li class="flex items-center gap-2.5">
          <span class="size-2.5 shrink-0 rounded-full" style="background:${p.color}" aria-hidden="true"></span>
          <span class="min-w-0 flex-1 text-ink-2">${p.label}</span>
          <span class="font-medium whitespace-nowrap tabular-nums text-ink">${signed(p.value)}</span>
          <span class="w-14 text-right text-xs whitespace-nowrap tabular-nums text-ink-3">${pct(p.value / ctcGain)}</span>
        </li>`,
        )
        .join('')}</ul>
    </div>`
      : '';

  const notes: string[] = [];
  if (down) {
    notes.push(
      `This raise lands in the band just above ₹12 lakh of taxable income where the rebate tapers off and the 4% cess applies on top, so the extra tax is more than the extra pay. <a href="/marginal-relief" class="${LINK}">How marginal relief works</a>.`,
    );
  }
  if (before.regime !== after.regime) {
    notes.push(
      `The cheaper regime changes from the ${REGIME[before.regime]} to the ${REGIME[after.regime]} with this raise.`,
    );
  }

  return `<p class="text-sm font-medium text-ink-2">${label}</p>
    <p class="mt-2 text-figure font-semibold tabular-nums ${down ? 'text-negative' : 'text-ink'}">${figure}</p>
    <p class="mt-2 text-sm text-ink-2">${summary}</p>
    <div class="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">${card('Now', before)}${card('After the hike', after)}</div>
    ${legend}
    ${notes.map((n) => `<p class="callout mt-5 p-3 text-sm text-ink-2">${n}</p>`).join('')}
    <p class="mt-5 text-sm"><a href="${calculatorLink(after.ctc, q.stateCode, q.city)}" class="${LINK}">See the full breakdown at ${formatCompactRupees(after.ctc)}</a></p>`;
}
