/**
 * In-hand to CTC: the smallest CTC whose fixed monthly in-hand pay reaches a target, on the
 * calculator's Quick-mode structure for the chosen state, city and rent, taking the cheaper regime.
 *
 * In-hand pay rises with CTC everywhere except just above ₹12 lakh of taxable income, where the
 * new regime's rebate tapers off (marginal relief) and in-hand dips slightly. So the search bisects
 * first and then looks a little below the answer for a smaller CTC that also reaches the target.
 *
 * Shared by the page's build-time render and its browser script, so both show the same thing.
 */

import { formatCompactRupees, formatRupees } from './format';
import { calculate, type CalculationResult, type CalculatorInput } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import type { Regime } from './tax/rates';
import { encodeState } from './url-state';

export interface ReverseQuery {
  /** The fixed in-hand pay wanted each month. */
  inHand: number | null;
  stateCode: string;
  city: string;
  monthlyRent: number;
  /** Variable pay as a percentage of CTC, paid separately and left out of monthly in-hand. */
  variablePercent: number;
}

export interface ReverseOutcome {
  /** The CTC to ask for: the smallest one that reaches the target, rounded up to ₹1,000. */
  ctc: number;
  variable: number;
  monthly: number;
  annual: number;
  tax: number;
  regime: Regime;
  /** True when the answer sits in the band where a little more CTC adds almost nothing in hand. */
  inReliefBand: boolean;
}

/** Above this the calculator is not a sensible guide (10 crore a year). */
const MAX_CTC = 10_00_00_000;
/** How far below the first answer to look for the marginal-relief dip, and in what steps. */
const DIP_WINDOW = 2_00_000;
const DIP_STEP = 1_000;

export function reverseInput(ctc: number, q: Omit<ReverseQuery, 'inHand'>): CalculatorInput {
  return {
    ...DEFAULT_INPUT,
    ctc,
    stateCode: q.stateCode,
    city: q.city,
    monthlyRent: q.monthlyRent,
    variable: { unit: 'percent', value: q.variablePercent },
  };
}

export function ctcForInHand(q: ReverseQuery): ReverseOutcome | null {
  const target = q.inHand;
  if (target === null || target <= 0) return null;
  const at = (ctc: number): CalculationResult | null => {
    const result = calculate(reverseInput(ctc, q));
    return result.errors.length ? null : result;
  };
  const reaches = (ctc: number) => {
    const result = at(ctc);
    return result !== null && result.regimes[result.better].monthlyTakeHome >= target;
  };

  // In-hand pay can never exceed the CTC, so a year of the target is a safe lower bound.
  const floor = Math.ceil(target * 12);
  if (floor > MAX_CTC) return null;
  if (reaches(floor)) return outcome(floor);
  let lo = floor;
  let hi = floor * 2;
  while (!reaches(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > MAX_CTC * 2) return null;
  }
  const smallest = (low: number, high: number) => {
    // `high` reaches the target and `low` does not; narrow to the rupee.
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (reaches(mid)) high = mid;
      else low = mid;
    }
    return high;
  };
  let ctc = smallest(lo, hi);
  for (let c = Math.max(floor, ctc - DIP_WINDOW); c < ctc; c += DIP_STEP) {
    if (reaches(c)) {
      ctc = smallest(Math.max(floor, c - DIP_STEP), c);
      break;
    }
  }
  return outcome(ctc);

  function outcome(exact: number): ReverseOutcome | null {
    // Round up, so the CTC to ask for always reaches the target. Inside the marginal-relief dip a
    // round number above can fall short again, so step up until it reaches.
    let ask = Math.ceil(exact / 1_000) * 1_000;
    while (!reaches(ask) && ask <= MAX_CTC) ask += 1_000;
    const result = at(ask);
    if (!result) return null;
    const best = result.regimes[result.better];
    return {
      ctc: ask,
      variable: result.structure.annual.variable,
      monthly: best.monthlyTakeHome,
      annual: best.annualTakeHome,
      tax: best.tax.totalTax,
      regime: result.better,
      inReliefBand: result.better === 'new' && result.regimes.new.tax.rebateIsMarginalRelief,
    };
  }
}

/** Link to the full calculator with this CTC, state, city, rent and variable pay filled in. */
export function reverseCalculatorLink(ctc: number, q: Omit<ReverseQuery, 'inHand'>): string {
  const input = reverseInput(ctc, q);
  const query = encodeState({ mode: q.variablePercent > 0 ? 'advanced' : 'quick', input });
  return query ? `/?${query}` : '/';
}

const REGIME: Record<Regime, string> = { new: 'new regime', old: 'old regime' };
const LINK = 'font-medium text-accent-ink underline underline-offset-4';
const message = (text: string) => `<p class="text-sm text-ink-2">${text}</p>`;

/** "12.5 LPA", from a CTC in rupees. */
export const lpaLabel = (ctc: number) =>
  `${(Math.round(ctc / 1_000) / 100).toFixed(2).replace(/\.?0+$/, '')} LPA`;

export function renderReverse(q: ReverseQuery): string {
  if (q.inHand === null || q.inHand < 1_000) {
    return message('Enter the in-hand salary you want each month.');
  }
  if (q.inHand > 50_00_000) return message('That is beyond what the calculator covers.');
  if (q.variablePercent < 0 || q.variablePercent >= 100) {
    return message('Variable pay has to be less than 100% of the CTC.');
  }
  const o = ctcForInHand(q);
  if (!o) return message('No CTC on the standard structure gives that in-hand pay.');

  const fixed = o.ctc - o.variable;
  const figure = `${formatRupees(o.ctc)}<span class="ml-2 text-2xl font-semibold tracking-normal text-ink-3">a year</span>`;
  const card = (title: string, value: string, caption: string) =>
    `<div class="rounded-md border border-line bg-surface p-4">
      <p class="text-sm font-medium text-ink-2">${title}</p>
      <p class="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-ink">${value}</p>
      <p class="text-xs text-ink-3">${caption}</p>
    </div>`;

  const notes: string[] = [];
  if (o.variable > 0) {
    notes.push(
      `${formatRupees(o.variable)} of this is variable pay, paid only if earned and never part of your monthly salary. The fixed part is ${formatRupees(fixed)}.`,
    );
  }
  if (o.inReliefBand) {
    notes.push(
      `This lands just above ₹12 lakh of taxable income, where marginal relief applies: a slightly higher CTC adds almost nothing in hand here. <a href="/marginal-relief" class="${LINK}">How marginal relief works</a>.`,
    );
  }

  return `<p class="text-sm font-medium text-ink-2">Ask for a CTC of at least</p>
    <p class="mt-2 text-figure font-semibold tabular-nums text-ink">${figure}</p>
    <p class="mt-2 text-sm text-ink-2">That is <strong class="text-ink">${lpaLabel(o.ctc)}</strong>, and gives about ${formatRupees(o.monthly)} a month in hand under the ${REGIME[o.regime]}.</p>
    <div class="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      ${card('In hand a month', formatRupees(o.monthly), 'fixed pay, what lands each month')}
      ${card('In hand a year', formatRupees(o.annual), o.variable > 0 ? 'fixed pay, before variable' : 'twelve months of fixed pay')}
      ${card('Income tax a year', formatRupees(o.tax), REGIME[o.regime])}
    </div>
    ${notes.map((n) => `<p class="callout mt-5 p-3 text-sm text-ink-2">${n}</p>`).join('')}
    <p class="mt-5 text-sm"><a href="${reverseCalculatorLink(o.ctc, q)}" class="${LINK}">See the full breakdown at ${formatCompactRupees(o.ctc)}</a></p>`;
}
