/**
 * Compare two job offers: each offer's CTC, structure and city through the same engine, side by
 * side, with a plain verdict on which puts more in your bank.
 *
 * The monthly figure is fixed pay only, because variable pay is not guaranteed and is usually paid
 * once or twice a year. A joining bonus sits outside CTC; it is taxed at the offer's marginal rate
 * and shown as a one-time amount, counted only in the first-year total.
 *
 * Shared by the page's build-time render and its browser script, so both show the same thing.
 */

import { CITY_VALUES } from './city-options';
import { formatCompactRupees, formatRupees } from './format';
import { calculate, type CalculatorInput, type ComponentValue } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { computeIncomeTax } from './tax/income-tax';
import { STATES } from './tax/professional-tax';
import type { PfMode } from './tax/provident-fund';
import type { Regime } from './tax/rates';
import { encodeState } from './url-state';

export interface OfferInput {
  name: string;
  ctc: number | null;
  /** Variable pay inside CTC, as a percent of CTC or rupees a year. */
  variable: ComponentValue;
  /** One-time joining bonus, paid on top of CTC. */
  joiningBonus: number | null;
  /** Basic + DA as a percent of CTC. */
  basicPercent: number | null;
  pfMode: PfMode;
  stateCode: string;
  city: string;
  monthlyRent: number | null;
}

export interface OfferSummary {
  name: string;
  ctc: number;
  /** Fixed monthly in-hand under the cheaper regime. */
  monthly: number;
  /** A year's in-hand, with variable pay counted in full. */
  annual: number;
  variable: number;
  joiningBonus: number;
  /** The joining bonus after the extra income tax it brings. */
  joiningNet: number;
  /** A year's in-hand plus the joining bonus after tax. */
  firstYear: number;
  tax: number;
  /** The employee's own PF contribution in a year. */
  employeePf: number;
  /** Employer PF, employer NPS and the gratuity provision in a year. */
  employerSavings: number;
  regime: Regime;
  /** The full calculator, set to this offer. */
  link: string;
}

/** The pair the page opens with: staying put against a better-paid move to another city. */
export const DEFAULT_OFFERS: [OfferInput, OfferInput] = [
  {
    name: 'Current job',
    ctc: 12_00_000,
    variable: { unit: 'percent', value: 0 },
    joiningBonus: 0,
    basicPercent: 50,
    pfMode: 'ceiling',
    stateCode: 'KA',
    city: 'Bengaluru',
    monthlyRent: 0,
  },
  {
    name: 'New offer',
    ctc: 15_00_000,
    variable: { unit: 'percent', value: 10 },
    joiningBonus: 1_00_000,
    basicPercent: 50,
    pfMode: 'ceiling',
    stateCode: 'MH',
    city: 'Pune',
    monthlyRent: 0,
  },
];

export type OfferResult = { ok: true; offer: OfferSummary } | { ok: false; problem: string };

const REGIME: Record<Regime, string> = { new: 'New', old: 'Old' };
const STATE_CODES = new Set(STATES.map((s) => s.code));
const CITIES = new Set<string>(CITY_VALUES);

export function toCalculatorInput(o: OfferInput): CalculatorInput {
  return {
    ...DEFAULT_INPUT,
    ctc: o.ctc ?? 0,
    basic: { unit: 'percent', value: o.basicPercent ?? 50 },
    variable: o.variable,
    pfMode: o.pfMode,
    stateCode: o.stateCode,
    city: o.city,
    monthlyRent: Math.max(0, o.monthlyRent ?? 0),
  };
}

export function summarizeOffer(o: OfferInput): OfferResult {
  if (o.ctc === null || o.ctc < 1_00_000) return { ok: false, problem: 'Enter the CTC, a year.' };
  if (o.ctc > 50_00_00_000) return { ok: false, problem: 'That CTC is beyond what this covers.' };
  if (o.basicPercent === null || o.basicPercent < 10 || o.basicPercent > 100) {
    return { ok: false, problem: 'Enter Basic as a percent of CTC, between 10 and 100.' };
  }
  if (o.joiningBonus === null || o.joiningBonus < 0) {
    return { ok: false, problem: 'Enter the joining bonus, or 0.' };
  }

  const input = toCalculatorInput(o);
  const result = calculate(input);
  if (result.errors.length > 0) return { ok: false, problem: result.errors[0] };

  const best = result.regimes[result.better];
  const a = result.structure.annual;
  const bonus = o.joiningBonus;
  const bonusTax =
    bonus > 0
      ? computeIncomeTax(result.better, best.taxableIncome + bonus, {
          age: input.age,
          resident: input.resident,
        }).totalTax - best.tax.totalTax
      : 0;
  const joiningNet = bonus - bonusTax;
  const query = encodeState({ mode: 'advanced', input });

  return {
    ok: true,
    offer: {
      name: o.name.trim() || 'Offer',
      ctc: o.ctc,
      monthly: best.monthlyTakeHome,
      annual: best.annualTakeHome,
      variable: a.variable,
      joiningBonus: bonus,
      joiningNet,
      firstYear: best.annualTakeHome + joiningNet,
      tax: best.tax.totalTax,
      employeePf: result.structure.pf.employee * 12,
      employerSavings: a.employerPf + a.employerNps + a.gratuity,
      regime: result.better,
      link: query ? `/?${query}` : '/',
    },
  };
}

/* Links ------------------------------------------------------------------------------------- */

const PF_CODES: Record<PfMode, string> = { ceiling: 'c', actual: 'a', none: 'n' };
const PF_MODES: Record<string, PfMode> = { c: 'ceiling', a: 'actual', n: 'none' };

/** Both offers as a short query string, so a comparison can be reopened or shared. */
export function encodeOffers(offers: [OfferInput, OfferInput]): string {
  const p = new URLSearchParams();
  offers.forEach((o, i) => {
    const k = i === 0 ? 'a' : 'b';
    p.set(`${k}n`, o.name.trim().slice(0, 40));
    p.set(`${k}c`, String(Math.round(o.ctc ?? 0)));
    p.set(
      `${k}v`,
      o.variable.unit === 'percent' ? `${o.variable.value}p` : String(Math.round(o.variable.value)),
    );
    p.set(`${k}j`, String(Math.round(o.joiningBonus ?? 0)));
    p.set(`${k}b`, String(o.basicPercent ?? 50));
    p.set(`${k}pf`, PF_CODES[o.pfMode]);
    p.set(`${k}st`, o.stateCode);
    p.set(`${k}ci`, o.city);
    p.set(`${k}r`, String(Math.round(o.monthlyRent ?? 0)));
  });
  return p.toString();
}

/** Reads offers back from a query string, keeping `fallback` for anything missing or invalid. */
export function decodeOffers(
  search: string,
  fallback: [OfferInput, OfferInput],
): [OfferInput, OfferInput] {
  const p = new URLSearchParams(search);
  const num = (v: string | null, d: number | null, max = 50_00_00_000) => {
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : d;
  };
  return fallback.map((d, i): OfferInput => {
    const k = i === 0 ? 'a' : 'b';
    if (!p.has(`${k}c`)) return d;
    const v = p.get(`${k}v`) ?? '';
    const variable: ComponentValue = v.endsWith('p')
      ? { unit: 'percent', value: num(v.slice(0, -1), 0, 100) ?? 0 }
      : { unit: 'rupees', value: num(v, 0) ?? 0 };
    const state = p.get(`${k}st`) ?? '';
    const city = p.get(`${k}ci`) ?? '';
    return {
      name: (p.get(`${k}n`) ?? d.name).slice(0, 40),
      ctc: num(p.get(`${k}c`), d.ctc),
      variable,
      joiningBonus: num(p.get(`${k}j`), 0),
      basicPercent: num(p.get(`${k}b`), 50, 100),
      pfMode: PF_MODES[p.get(`${k}pf`) ?? ''] ?? d.pfMode,
      stateCode: STATE_CODES.has(state) ? state : d.stateCode,
      city: CITIES.has(city) ? city : d.city,
      monthlyRent: num(p.get(`${k}r`), 0),
    };
  }) as [OfferInput, OfferInput];
}

/* Rendering --------------------------------------------------------------------------------- */

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const LINK = 'font-medium text-accent-ink underline underline-offset-4';

export function renderComparison(inputs: [OfferInput, OfferInput]): string {
  const results = inputs.map(summarizeOffer);
  const problems = results
    .map((r, i) =>
      r.ok
        ? null
        : `<strong class="text-ink">${escape(inputs[i].name.trim() || (i === 0 ? 'Offer A' : 'Offer B'))}:</strong> ${escape(r.problem)}`,
    )
    .filter(Boolean);
  if (problems.length > 0) {
    return problems.map((p) => `<p class="text-sm text-ink-2">${p}</p>`).join('');
  }
  const [a, b] = results.map((r) => (r as { ok: true; offer: OfferSummary }).offer);
  const names = [escape(a.name), escape(b.name)];

  const diff = b.monthly - a.monthly;
  const winner = diff >= 0 ? 1 : 0;
  const verdict =
    Math.abs(diff) < 1
      ? `<p class="text-xl font-semibold tracking-tight text-ink">Both put the same amount in your bank each month.</p>`
      : `<p class="text-sm font-medium text-ink-2">${names[winner]} puts more in your bank</p>
         <p class="mt-2 text-figure font-semibold tabular-nums text-ink">${formatRupees(Math.abs(Math.round(diff)))}<span class="ml-2 text-2xl font-semibold tracking-normal text-ink-3">more a month</span></p>
         <p class="mt-2 text-sm text-ink-2">That is ${formatRupees(Math.abs(Math.round(diff * 12)))} a year of fixed pay, after income tax, PF and professional tax.</p>`;

  const notes: string[] = [];
  const firstYearDiff = b.firstYear - a.firstYear;
  if (
    Math.abs(diff) >= 1 &&
    Math.abs(firstYearDiff) >= 1 &&
    Math.sign(firstYearDiff) !== Math.sign(diff)
  ) {
    const ahead = firstYearDiff > 0 ? 1 : 0;
    notes.push(
      `In the first year, though, ${names[ahead]} comes out ${formatRupees(Math.abs(Math.round(firstYearDiff)))} ahead, once variable pay at 100% and the joining bonus are counted.`,
    );
  }
  if (a.variable > 0 || b.variable > 0) {
    notes.push(
      'Variable pay is left out of the monthly figure: it is not guaranteed and is usually paid once or twice a year.',
    );
  }
  if (a.joiningBonus > 0 || b.joiningBonus > 0) {
    notes.push(
      'A joining bonus is paid once and is often taken back if you leave within a year. Check the clawback clause.',
    );
  }

  type Row = {
    label: string;
    hint?: string;
    values: [number, number] | [string, string];
    best?: 'high';
  };
  const rows: Row[] = [
    { label: 'CTC', values: [a.ctc, b.ctc] },
    {
      label: 'In hand a month',
      hint: 'Fixed pay, what lands each month',
      values: [a.monthly, b.monthly],
      best: 'high',
    },
    {
      label: 'Variable pay a year',
      hint: 'Paid separately, if earned',
      values: [a.variable, b.variable],
    },
    {
      label: 'In hand a year',
      hint: 'With variable pay at 100%',
      values: [a.annual, b.annual],
      best: 'high',
    },
    { label: 'Joining bonus after tax', hint: 'Once', values: [a.joiningNet, b.joiningNet] },
    { label: 'First-year total', values: [a.firstYear, b.firstYear], best: 'high' },
    { label: 'Income tax a year', values: [a.tax, b.tax] },
    { label: 'Your PF a year', hint: 'Yours, paid in later', values: [a.employeePf, b.employeePf] },
    {
      label: 'Employer PF and gratuity a year',
      hint: 'Long-term, inside CTC',
      values: [a.employerSavings, b.employerSavings],
    },
    { label: 'Cheaper regime', values: [REGIME[a.regime], REGIME[b.regime]] },
  ];
  const cell = (row: Row, i: 0 | 1) => {
    const v = row.values[i];
    const text =
      typeof v === 'number'
        ? v === 0 && row.label.startsWith('Joining')
          ? '–'
          : formatRupees(v)
        : v;
    const other = row.values[i === 0 ? 1 : 0];
    const wins =
      row.best === 'high' && typeof v === 'number' && typeof other === 'number' && v - other >= 1;
    return `<td${wins ? ' class="text-accent-ink font-semibold"' : ''}>${text}${wins ? ' <span class="sr-only">(higher)</span>' : ''}</td>`;
  };
  const table = `<div class="mt-6 overflow-x-auto"><table class="ledger [&_td]:px-3 [&_th]:px-3">
      <thead><tr><th scope="col">Per offer</th><th scope="col" class="text-right">${names[0]}</th><th scope="col" class="text-right">${names[1]}</th></tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr><th scope="row">${row.label}${row.hint ? `<span class="ledger-note">${row.hint}</span>` : ''}</th>${cell(row, 0)}${cell(row, 1)}</tr>`,
        )
        .join('')}</tbody>
    </table></div>`;

  const links = `<p class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">${[a, b]
    .map(
      (o, i) =>
        `<a href="${o.link}" class="${LINK}">Full breakdown of ${names[i]}, ${formatCompactRupees(o.ctc)}</a>`,
    )
    .join('')}</p>`;

  return `${verdict}
    ${notes.map((n) => `<p class="callout mt-4 p-3 text-sm text-ink-2">${n}</p>`).join('')}
    ${table}
    ${links}`;
}
