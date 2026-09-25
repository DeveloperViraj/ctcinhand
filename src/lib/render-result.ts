/**
 * Renders a calculation into HTML.
 *
 * The same function runs at build time (so the page ships real numbers for crawlers and for anyone
 * without JavaScript) and in the browser on every keystroke. All values come from our own
 * calculation, so there is no untrusted content to escape here; `escape` guards the few strings
 * that originate in data tables.
 */

import type { CalculationResult, RegimeBreakdown } from './tax/calculate';
import { formatCompactRupees, formatRupees } from './format';
import { FY_MONTHS } from './tax/professional-tax';
import type { Regime } from './tax/rates';

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const REGIME_LABEL: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

/**
 * Engine messages are written with "Rs" because the same strings go into the PDF, whose built-in
 * fonts have no rupee glyph. On screen we can show the real symbol.
 */
const forScreen = (text: string) => escape(text).replace(/Rs (?=[\d₹])/g, '₹');

function row(
  label: string,
  value: string,
  opts: { muted?: boolean; strong?: boolean; hint?: string } = {},
) {
  return `<tr class="${opts.strong ? 'font-medium text-ink' : ''}">
    <th scope="row" class="py-1.5 pr-3 text-left font-normal ${opts.muted ? 'text-ink-3' : 'text-ink-2'}">${escape(label)}${
      opts.hint ? `<span class="block text-xs text-ink-3">${escape(opts.hint)}</span>` : ''
    }</th>
    <td class="py-1.5 text-right tabular-nums ${opts.strong ? 'text-ink' : ''}">${value}</td>
  </tr>`;
}

function sectionTable(title: string, rows: string, total?: { label: string; value: string }) {
  return `<section class="mt-6">
    <h3 class="text-xs font-semibold tracking-wide text-ink-3">${escape(title)}</h3>
    <table class="mt-2 w-full text-sm">
      <tbody class="divide-y divide-line">${rows}</tbody>
      ${
        total
          ? `<tfoot><tr class="border-t-2 border-line-strong font-semibold text-ink">
               <th scope="row" class="py-2 pr-3 text-left">${escape(total.label)}</th>
               <td class="py-2 text-right tabular-nums">${total.value}</td>
             </tr></tfoot>`
          : ''
      }
    </table>
  </section>`;
}

function regimeCard(r: RegimeBreakdown, isBetter: boolean, saving: number): string {
  return `<div class="relative rounded-lg border ${
    isBetter ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface'
  } p-4">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="text-sm font-medium text-ink">${REGIME_LABEL[r.regime]}</h3>
      ${
        isBetter
          ? `<span class="rounded-sm bg-accent px-1.5 py-0.5 text-xs font-medium text-on-accent">Lower tax</span>`
          : ''
      }
    </div>
    <p class="mt-2 text-xl font-semibold tabular-nums text-ink">${formatRupees(r.tax.totalTax)}</p>
    <p class="text-xs text-ink-3">total tax for the year</p>
    <dl class="mt-3 space-y-1 text-xs text-ink-2">
      <div class="flex justify-between gap-2"><dt>Taxable income</dt><dd class="tabular-nums">${formatRupees(r.taxableIncome)}</dd></div>
      <div class="flex justify-between gap-2"><dt>Monthly in-hand</dt><dd class="tabular-nums font-medium text-ink">${formatRupees(r.monthlyTakeHome)}</dd></div>
      ${
        isBetter && saving > 0
          ? `<div class="flex justify-between gap-2 pt-1 text-accent"><dt>You save</dt><dd class="tabular-nums font-medium">${formatRupees(saving)}/yr</dd></div>`
          : ''
      }
    </dl>
  </div>`;
}

function taxDetail(r: RegimeBreakdown): string {
  const rows = [
    row('Gross salary', formatRupees(r.grossSalary)),
    r.hraExemption
      ? row('HRA exemption', `-${formatRupees(r.hraExemption.exemption)}`, {
          hint:
            r.hraExemption.binding === 'rent'
              ? 'Limited by rent paid minus 10% of Basic'
              : r.hraExemption.binding === 'percent'
                ? `Limited to ${r.hraExemption.rate === 0.5 ? '50%' : '40%'} of Basic`
                : 'Limited to the HRA you receive',
        })
      : '',
    row('Standard deduction', `-${formatRupees(r.standardDeduction)}`),
    r.professionalTaxDeduction > 0
      ? row('Professional tax', `-${formatRupees(r.professionalTaxDeduction)}`)
      : '',
    r.employerNpsDeduction > 0
      ? row('Employer NPS (s.124)', `-${formatRupees(r.employerNpsDeduction)}`)
      : '',
    r.sec80C && r.sec80C.allowed > 0
      ? row('80C (s.123)', `-${formatRupees(r.sec80C.allowed)}`, {
          hint: r.sec80C.capped
            ? `Capped at ${formatRupees(r.sec80C.cap)}; you entered more`
            : undefined,
        })
      : '',
    r.nps80CCD1B && r.nps80CCD1B.allowed > 0
      ? row('NPS 80CCD(1B) (s.124(3))', `-${formatRupees(r.nps80CCD1B.allowed)}`, {
          hint: r.nps80CCD1B.capped ? 'Capped at ₹50,000' : undefined,
        })
      : '',
    r.healthInsurance && r.healthInsurance.allowed > 0
      ? row('Health insurance (s.126)', `-${formatRupees(r.healthInsurance.allowed)}`, {
          hint: r.healthInsurance.capped
            ? `Capped at ${formatRupees(r.healthInsurance.cap)}`
            : undefined,
        })
      : '',
    r.selfOccupiedInterest && r.selfOccupiedInterest.allowed > 0
      ? row('Home loan interest (s.22)', `-${formatRupees(r.selfOccupiedInterest.allowed)}`, {
          hint: r.selfOccupiedInterest.capped ? 'Capped at ₹2,00,000' : undefined,
        })
      : '',
  ]
    .filter(Boolean)
    .join('');

  const taxRows = [
    row('Tax at slab rates', formatRupees(r.tax.slabTax)),
    r.tax.rebate > 0
      ? row('Rebate (s.156)', `-${formatRupees(r.tax.rebate)}`, {
          hint: r.tax.rebateIsMarginalRelief ? 'Marginal relief above ₹12 lakh' : undefined,
        })
      : '',
    r.tax.surcharge > 0
      ? row(
          `Surcharge at ${(r.tax.surchargeRate * 100).toFixed(0)}%`,
          formatRupees(r.tax.surcharge),
          {
            hint:
              r.tax.surchargeMarginalRelief > 0
                ? `Marginal relief of ${formatRupees(r.tax.surchargeMarginalRelief)} applied`
                : undefined,
          },
        )
      : '',
    row('Health & education cess (4%)', formatRupees(r.tax.cess)),
  ]
    .filter(Boolean)
    .join('');

  return `${sectionTable('Taxable income', rows, {
    label: 'Taxable income',
    value: formatRupees(r.taxableIncome),
  })}
  ${sectionTable('Income tax', taxRows, { label: 'Total tax', value: formatRupees(r.tax.totalTax) })}`;
}

export function renderResult(result: CalculationResult): string {
  if (result.errors.length > 0) {
    return `<div role="alert" class="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm text-ink">
      <p class="font-medium">This structure does not add up</p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-ink-2">
        ${result.errors.map((e) => `<li>${forScreen(e)}</li>`).join('')}
      </ul>
    </div>`;
  }

  const best = result.regimes[result.better];
  const other = result.regimes[result.better === 'new' ? 'old' : 'new'];
  const s = result.structure;
  const a = s.annual;
  const pt = result.professionalTax;

  const earnings = [
    row('Basic + DA', formatRupees(a.basic)),
    a.hra > 0 ? row('House rent allowance', formatRupees(a.hra)) : '',
    a.lta > 0 ? row('Leave travel allowance', formatRupees(a.lta)) : '',
    row('Special allowance', formatRupees(a.special)),
  ]
    .filter(Boolean)
    .join('');

  const deductions = [
    s.pf.employee > 0
      ? row('Provident fund (employee)', `-${formatRupees(s.pf.employee * 12)}`, {
          hint:
            result.input.pfMode === 'ceiling'
              ? 'Capped at 12% of the ₹15,000 wage ceiling'
              : 'On full Labour Code wages',
        })
      : '',
    s.esi.applicable ? row('ESI (employee, 0.75%)', `-${formatRupees(s.esi.employee * 12)}`) : '',
    pt.annual > 0
      ? row(pt.label, `-${formatRupees(pt.annual)}`, {
          hint: ptHint(pt.monthly),
        })
      : '',
    row(
      `Income tax (${REGIME_LABEL[result.better].toLowerCase()})`,
      `-${formatRupees(best.tax.totalTax)}`,
    ),
  ]
    .filter(Boolean)
    .join('');

  // Each row says where the money actually goes: some of this is yours but not liquid (PF, NPS),
  // some is paid later (gratuity), some is cover rather than cash (ESI), and variable pay is paid
  // to you but separately. Lumping it all under "not your bank account" would be wrong.
  const restOfCtc = [
    a.variable > 0
      ? row('Variable pay', formatRupees(a.variable), {
          hint: 'Paid to you separately, if fully earned',
        })
      : '',
    a.employerPf > 0
      ? row('Employer PF', formatRupees(a.employerPf), {
          hint: 'Yours, but locked in your PF account',
        })
      : '',
    a.employerNps > 0
      ? row('Employer NPS', formatRupees(a.employerNps), {
          hint: 'Yours, but locked until retirement',
        })
      : '',
    a.gratuity > 0
      ? row('Gratuity provision', formatRupees(a.gratuity), {
          hint: 'Paid only when you leave, if eligible',
        })
      : '',
    a.employerEsi > 0
      ? row('Employer ESI (3.25%)', formatRupees(a.employerEsi), {
          hint: 'Buys insurance cover, not cash',
        })
      : '',
  ]
    .filter(Boolean)
    .join('');

  const notices = result.notices.length
    ? `<div class="mt-6 space-y-2">${result.notices
        .map(
          (n) =>
            `<p class="rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">${forScreen(n)}</p>`,
        )
        .join('')}</div>`
    : '';

  const gratuity = result.gratuityProjection;
  const gratuityNote = gratuity.eligible
    ? `You would receive about <strong class="text-ink">${formatRupees(gratuity.amount)}</strong> in gratuity after ${
        gratuity.countedYears
      } years, based on ${formatRupees(s.wages.wages)} a month of Labour Code wages.`
    : `Gratuity needs ${gratuity.minimumYears} years of service. It is part of your CTC but you receive nothing before then.`;

  return `
  <h2 class="sr-only">Your salary breakdown</h2>
  <div class="rounded-lg border border-line bg-surface p-5 sm:p-6">
    <p class="text-sm text-ink-2">Monthly in-hand</p>
    <p class="mt-1 text-figure font-semibold tabular-nums text-accent" data-headline>${formatRupees(best.monthlyTakeHome)}</p>
    <p class="mt-1 text-sm text-ink-2">
      ${formatRupees(best.annualTakeHome)} a year${a.variable > 0 ? ', including variable pay' : ''}
      from a ${formatCompactRupees(result.input.ctc)} CTC
    </p>
  </div>

  <div class="mt-4 grid gap-3 sm:grid-cols-2">
    ${regimeCard(best, true, result.savingByChoosingBetter)}
    ${regimeCard(other, false, 0)}
  </div>
  ${notices}

  ${sectionTable('What you are paid', earnings, {
    label: 'Gross salary (fixed)',
    value: formatRupees(a.grossFixed),
  })}
  ${sectionTable('What is deducted', deductions, {
    label: 'Annual in-hand',
    value: formatRupees(best.annualTakeHome - a.variable),
  })}
  ${
    restOfCtc
      ? sectionTable('The rest of your CTC, and where it goes', restOfCtc, {
          label: 'Total CTC',
          value: formatRupees(a.ctcComponents),
        })
      : ''
  }

  <p class="mt-6 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-ink-2">${gratuityNote}</p>

  <details class="mt-4 rounded-md border border-line bg-surface">
    <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-ink">How the tax was worked out</summary>
    <div class="border-t border-line px-4 pb-4">
      <div class="grid gap-6 sm:grid-cols-2">
        <div><p class="mt-4 text-sm font-medium text-ink">${REGIME_LABEL[best.regime]}</p>${taxDetail(best)}</div>
        <div><p class="mt-4 text-sm font-medium text-ink">${REGIME_LABEL[other.regime]}</p>${taxDetail(other)}</div>
      </div>
    </div>
  </details>`;
}

function ptHint(monthly: number[]): string | undefined {
  const unique = [...new Set(monthly)];
  if (unique.length <= 1) return undefined;
  const february = monthly[FY_MONTHS.indexOf('Feb')];
  const usual = monthly[0];
  if (
    february !== usual &&
    new Set(monthly.filter((_, i) => i !== FY_MONTHS.indexOf('Feb'))).size === 1
  ) {
    return `₹${usual} a month, ₹${february} in February`;
  }
  return 'Varies during the year';
}
