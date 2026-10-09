/**
 * Describes twelve monthly professional tax deductions in a phrase: "₹200 a month, ₹300 in
 * February", "₹2,500 in September", "₹625 in June, September, December and March".
 *
 * States collect professional tax on very different calendars (monthly, half-yearly, quarterly,
 * once a year, or with one month adjusted to land on the annual total), so a single amount per
 * month would mislead. The page, the exports and the state guides all describe it the same way.
 */

import { FY_MONTHS } from './tax/professional-tax';

const MONTH_NAMES: Record<(typeof FY_MONTHS)[number], string> = {
  Apr: 'April',
  May: 'May',
  Jun: 'June',
  Jul: 'July',
  Aug: 'August',
  Sep: 'September',
  Oct: 'October',
  Nov: 'November',
  Dec: 'December',
  Jan: 'January',
  Feb: 'February',
  Mar: 'March',
};

const OCTOBER = FY_MONTHS.indexOf('Oct');

const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * Returns undefined when every month is the same, since "₹X a month" adds nothing to an annual
 * figure. Pass `always` to get that phrase anyway.
 */
export function describePtPattern(
  monthly: readonly number[],
  money: (amount: number) => string,
  always = false,
): string | undefined {
  const distinct = new Set(monthly);
  if (distinct.size <= 1) return always ? `${money(monthly[0] ?? 0)} a month` : undefined;

  const charged = monthly.map((amount, i) => ({ amount, i })).filter((x) => x.amount > 0);
  const name = (i: number) => MONTH_NAMES[FY_MONTHS[i]];

  // Charged in only some months, the same amount each time: Bihar, Jharkhand, Kerala, Chennai.
  if (charged.length < 12 && new Set(charged.map((x) => x.amount)).size === 1) {
    return `${money(charged[0].amount)} in ${list(charged.map((x) => name(x.i)))}`;
  }

  // One month differs from all the others: February in Maharashtra and Karnataka, March in
  // Madhya Pradesh.
  for (let i = 0; i < 12; i++) {
    const rest = new Set(monthly.filter((_, j) => j !== i));
    if (rest.size === 1 && monthly[i] !== [...rest][0]) {
      return `${money([...rest][0])} a month, ${money(monthly[i])} in ${name(i)}`;
    }
  }

  // A mid-year change of schedule: West Bengal from 1 October 2026.
  const firstHalf = new Set(monthly.slice(0, OCTOBER));
  const secondHalf = new Set(monthly.slice(OCTOBER));
  if (firstHalf.size === 1 && secondHalf.size === 1) {
    const to = monthly[OCTOBER] === 0 ? 'nothing' : `${money(monthly[OCTOBER])} a month`;
    return `${money(monthly[0])} a month until September, then ${to}`;
  }

  return 'Varies during the year';
}

/**
 * Describes a deduction that steps up during the year, such as provident fund after the wage
 * ceiling rose on 17 September 2026: "₹1,800 a month until August, ₹2,360 in September, then
 * ₹3,000 a month". Undefined when every month is the same.
 */
export function describeSteps(
  monthly: readonly number[],
  money: (amount: number) => string,
): string | undefined {
  const runs: { value: number; start: number; end: number }[] = [];
  monthly.forEach((raw, i) => {
    const value = Math.round(raw);
    const last = runs[runs.length - 1];
    if (last && last.value === value) last.end = i;
    else runs.push({ value, start: i, end: i });
  });
  if (runs.length <= 1) return undefined;

  const name = (i: number) => MONTH_NAMES[FY_MONTHS[i]];
  return runs
    .map((run, i) => {
      const single = run.start === run.end;
      if (i === 0) {
        return single
          ? `${money(run.value)} in ${name(run.start)}`
          : `${money(run.value)} a month until ${name(run.end)}`;
      }
      if (i === runs.length - 1) {
        return single
          ? `then ${money(run.value)} in ${name(run.start)}`
          : `then ${money(run.value)} a month`;
      }
      return single
        ? `${money(run.value)} in ${name(run.start)}`
        : `${money(run.value)} a month from ${name(run.start)} to ${name(run.end)}`;
    })
    .join(', ');
}
