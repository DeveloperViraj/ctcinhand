/**
 * Renders a calculation into HTML, in two parts: a compact summary that sits beside the inputs,
 * and the full breakdown below them.
 *
 * The same functions run at build time (so the page ships real numbers for crawlers and for anyone
 * without JavaScript) and in the browser on every keystroke, where the output is patched into the
 * page in place (see morph.ts). All values come from our own calculation, so there is no untrusted
 * content to escape here; `escape` guards the few strings that originate in data tables.
 */

import type { CalculationResult, RegimeBreakdown } from './tax/calculate';
import { formatCompactRupees, formatNumber, formatRupees } from './format';
import { describePtPattern } from './pt-pattern';
import { employerPfNote, pfCeilingNote } from './pf-note';
import type { Regime } from './tax/rates';

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const REGIME_LABEL: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

/**
 * Engine messages are written with "Rs" because the same strings go into exports whose fonts may
 * lack a rupee glyph. On screen we can show the real symbol.
 */
const forScreen = (text: string) => escape(text).replace(/Rs (?=[\d₹])/g, '₹');

/** A deduction, written with a real minus sign so it lines up with the digits above it. */
const minus = (amount: number) => `&minus;${formatRupees(amount)}`;

function row(label: string, value: string, note?: string, carry = false) {
  return `<tr${carry ? ' class="ledger-carry"' : ''}>
    <th scope="row">${escape(label)}${note ? `<span class="ledger-note">${escape(note)}</span>` : ''}</th>
    <td>${value}</td>
  </tr>`;
}

function ledger(
  title: string,
  rows: string,
  total?: { label: string; value: string },
  id?: string,
  /** Read only by screen readers, to tell apart two ledgers with the same visible title. */
  hiddenSuffix?: string,
): string {
  const headingId = id ?? `ledger-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const suffix = hiddenSuffix ? `<span class="sr-only">${escape(hiddenSuffix)}</span>` : '';
  return `<section aria-labelledby="${headingId}">
    <h3 id="${headingId}" class="text-base font-semibold text-ink">${escape(title)}${suffix}</h3>
    <table class="ledger mt-3">
      <thead><tr><th scope="col">Component</th><th scope="col">Per year</th></tr></thead>
      <tbody>${rows}</tbody>
      ${
        total
          ? `<tfoot><tr><th scope="row">${escape(total.label)}</th><td>${total.value}</td></tr></tfoot>`
          : ''
      }
    </table>
  </section>`;
}

/**
 * Both regimes, always in the same order so nothing jumps while you type. The cheaper one is
 * tagged; the saving is spelled out underneath in the money-went-up colour.
 */
export function regimeComparison(result: CalculationResult): string {
  const cell = (r: RegimeBreakdown) => {
    const isBetter = r.regime === result.better && result.savingByChoosingBetter > 0;
    return `<div class="relative rounded-md border p-4 transition-colors ${
      isBetter ? 'border-accent bg-surface shadow-sm' : 'border-line bg-surface/60'
    }">
      <span class="tag absolute -top-2.5 right-3 bg-accent text-on-accent shadow-xs" ${isBetter ? '' : 'hidden'}>Lower tax</span>
      <p class="text-sm font-medium whitespace-nowrap text-ink">${REGIME_LABEL[r.regime]}</p>
      <p class="mt-2.5 text-xl font-semibold tracking-tight tabular-nums text-ink">${formatRupees(r.monthlyTakeHome)}</p>
      <p class="text-xs text-ink-3">in hand a month</p>
      <p class="mt-2.5 border-t border-line pt-2.5 text-xs tabular-nums text-ink-2"><span class="font-medium text-ink">${formatRupees(r.tax.totalTax)}</span> tax a year</p>
    </div>`;
  };

  const verdict =
    result.savingByChoosingBetter > 0
      ? `The ${REGIME_LABEL[result.better].toLowerCase()} saves you <strong class="font-semibold text-positive">${formatRupees(
          result.savingByChoosingBetter,
        )}</strong> a year.`
      : 'Both regimes come to the same tax.';

  return `<section class="mt-7" aria-labelledby="regimes-heading">
    <h3 id="regimes-heading" class="text-sm font-semibold text-ink">Both tax regimes</h3>
    <div class="mt-3 grid grid-cols-2 gap-2.5">${cell(result.regimes.new)}${cell(result.regimes.old)}</div>
    <p class="mt-3 text-sm text-ink-2">${verdict}</p>
  </section>`;
}

/**
 * Where the CTC actually goes, as a donut with a direct-labelled legend.
 *
 * Three segments only, in an emphasis palette: the money you keep wears the accent, savings you
 * reach later (PF, gratuity) a light tint of it, and income tax a neutral slate. Every segment is
 * repeated in the legend with its amount and share, and again in the tables below.
 *
 * All three arcs are always rendered (an empty one has zero length) so the chart keeps its shape
 * between keystrokes and each arc can glide to its new share.
 */
export function compositionBar(result: CalculationResult): string {
  const total = result.structure.annual.ctcComponents;
  if (total <= 0) return '';

  const best = result.regimes[result.better];
  const takeHome = Math.max(0, best.annualTakeHome);
  const tax = Math.max(0, best.tax.totalTax);
  const rest = Math.max(0, total - takeHome - tax);

  const segments = [
    { label: 'Take-home', value: takeHome, color: 'var(--color-chart-take)' },
    { label: 'Income tax', value: tax, color: 'var(--color-chart-tax)' },
    { label: 'PF, gratuity, other', value: rest, color: 'var(--color-chart-save)' },
  ];

  const pct = (value: number) => (value / total) * 100;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const gap = 2.5;
  let offset = 0;
  const arcs = segments
    .map((seg) => {
      const length = (seg.value / total) * circumference;
      const visible = Math.max(0, length - (seg.value > 0 ? gap : 0));
      const arc = `<circle class="donut-seg" cx="64" cy="64" r="${radius}" fill="none" stroke="${seg.color}" stroke-width="16" stroke-dasharray="${visible.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"></circle>`;
      offset += length;
      return arc;
    })
    .join('');

  const legend = segments
    .map(
      (seg) => `<li class="flex items-center gap-2.5"${seg.value > 0 ? '' : ' hidden'}>
        <span class="size-2.5 shrink-0 rounded-full" style="background:${seg.color}" aria-hidden="true"></span>
        <span class="min-w-0 flex-1 truncate text-ink-2">${escape(seg.label)}</span>
        <span class="font-medium whitespace-nowrap tabular-nums text-ink">${formatRupees(seg.value)}</span>
      </li>`,
    )
    .join('');

  const kept = pct(takeHome);
  return `<section class="mt-7" aria-labelledby="composition-heading">
    <h3 id="composition-heading" class="text-sm font-semibold text-ink">Where your ${formatCompactRupees(total)} CTC goes</h3>
    <div class="mt-4 flex items-center gap-5">
      <div class="relative size-28 shrink-0 sm:size-32">
        <svg viewBox="0 0 128 128" class="size-full -rotate-90" role="img" aria-label="${escape(
          segments
            .filter((seg) => seg.value > 0)
            .map((seg) => `${seg.label} ${pct(seg.value).toFixed(0)} percent`)
            .join(', '),
        )}"><circle cx="64" cy="64" r="${radius}" fill="none" stroke="var(--color-sunken)" stroke-width="16"></circle>${arcs}</svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span class="text-lg font-semibold tracking-tight tabular-nums text-ink">${kept.toFixed(kept >= 99.95 ? 0 : 1)}%</span>
          <span class="text-[11px] text-ink-3">in hand</span>
        </div>
      </div>
      <ul class="min-w-0 flex-1 space-y-2.5 text-sm">${legend}</ul>
    </div>
  </section>`;
}

export function renderSummary(result: CalculationResult): string {
  if (result.errors.length > 0) {
    return `<div role="alert" class="p-6 sm:p-8">
      <p class="text-sm font-medium text-ink-2">In hand per month</p>
      <p class="mt-3 text-figure font-semibold tabular-nums text-ink-3" aria-hidden="true">&mdash;</p>
      <div class="mt-5 rounded-md border border-danger/30 bg-danger-soft p-4 text-sm text-ink">
        <p class="font-semibold">Check these figures</p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          ${result.errors.map((e) => `<li>${forScreen(e)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }

  const best = result.regimes[result.better];
  const a = result.structure.annual;
  const monthly = best.monthlyTakeHome;

  // Above Rs 12 lakh, section 156(2)(b) caps tax at the income above the threshold. Treating the
  // rebate as an on/off switch would show earning more as leaving you with less.
  const relief = best.tax.rebateIsMarginalRelief
    ? `<div class="callout mt-6 p-4">
        <p class="text-sm font-semibold text-ink">Marginal relief applied</p>
        <p class="mt-1 text-sm text-ink-2">
          Your income is just above &#8377;12 lakh, so your tax is capped at the amount by which it
          exceeds that. Without this relief you would pay
          <strong class="font-medium text-ink">${formatRupees(best.tax.rebate * 1.04)}</strong> more
          a year. The 4% cess still applies on top, so until your taxable income passes about
          &#8377;12.71 lakh each extra rupee costs &#8377;1.04 in tax.
          <a href="/marginal-relief" class="underline">Why</a>
        </p>
      </div>`
    : '<div class="callout mt-6 p-4" hidden></div>';

  const notes = `<p class="mt-4 text-sm"${
    result.notices.length ? '' : ' hidden'
  }><a href="#notes" class="text-warn-ink underline decoration-dashed underline-offset-4 hover:text-ink">${
    result.notices.length === 1
      ? 'One note about these numbers'
      : `${result.notices.length} notes about these numbers`
  }</a></p>`;

  return `<h2 class="sr-only">Your salary breakdown</h2>
  <div class="p-6 sm:p-8" data-result-card>
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-medium text-ink-2" id="headline-label">In hand per month</p>
      <p class="flex items-center gap-1.5 rounded-pill border border-line bg-surface/70 px-2.5 py-1 text-xs font-medium text-ink-3">
        <span class="live-dot size-1.5 rounded-full bg-accent" aria-hidden="true"></span>
        Updates as you type
      </p>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="relative font-display text-figure font-bold tabular-nums text-ink" data-headline data-morph-keep aria-labelledby="headline-label"><span class="cur">&#8377;</span><span data-headline-num>${formatNumber(
        monthly,
      )}</span></p>
      <span class="delta rounded-pill px-2 text-sm leading-6 font-semibold tabular-nums" data-delta data-morph-keep data-state="hidden" aria-hidden="true"></span>
    </div>
    <p class="mt-3 text-sm text-ink-2">
      ${formatRupees(best.annualTakeHome)} a year${
        a.variable > 0 ? `, including ${formatRupees(a.variable)} variable pay` : ''
      }, from a ${formatCompactRupees(result.input.ctc)} CTC under the ${REGIME_LABEL[
        result.better
      ].toLowerCase()}.
    </p>
    ${notes}
    ${relief}
    ${compositionBar(result)}
    ${regimeComparison(result)}
  </div>`;
}

function taxDetail(r: RegimeBreakdown): string {
  const rows = [
    row(
      'Gross salary',
      formatRupees(r.grossSalary),
      r.employerContributionPerquisite >= 1
        ? `Includes ${formatRupees(r.employerContributionPerquisite)} of employer PF and NPS above ₹7.5 lakh`
        : undefined,
    ),
    r.hraExemption
      ? row(
          'HRA exemption',
          minus(r.hraExemption.exemption),
          r.hraExemption.binding === 'rent'
            ? 'Limited by rent paid minus 10% of Basic'
            : r.hraExemption.binding === 'percent'
              ? `Limited to ${r.hraExemption.rate === 0.5 ? '50%' : '40%'} of Basic`
              : 'Limited to the HRA you receive',
        )
      : '',
    row('Standard deduction', minus(r.standardDeduction)),
    r.professionalTaxDeduction > 0
      ? row('Professional tax', minus(r.professionalTaxDeduction))
      : '',
    r.employerNpsDeduction > 0 ? row('Employer NPS (s.124)', minus(r.employerNpsDeduction)) : '',
    r.sec80C && r.sec80C.allowed > 0
      ? row(
          '80C (s.123)',
          minus(r.sec80C.allowed),
          r.sec80C.capped ? `Capped at ${formatRupees(r.sec80C.cap)}; you entered more` : undefined,
        )
      : '',
    r.nps80CCD1B && r.nps80CCD1B.allowed > 0
      ? row(
          'NPS 80CCD(1B) (s.124(3))',
          minus(r.nps80CCD1B.allowed),
          r.nps80CCD1B.capped ? 'Capped at ₹50,000' : undefined,
        )
      : '',
    r.healthInsurance && r.healthInsurance.allowed > 0
      ? row(
          'Health insurance (s.126)',
          minus(r.healthInsurance.allowed),
          r.healthInsurance.capped ? `Capped at ${formatRupees(r.healthInsurance.cap)}` : undefined,
        )
      : '',
    r.selfOccupiedInterest && r.selfOccupiedInterest.allowed > 0
      ? row(
          'Home loan interest (s.22)',
          minus(r.selfOccupiedInterest.allowed),
          r.selfOccupiedInterest.capped ? 'Capped at ₹2,00,000' : undefined,
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const taxRows = [
    row('Tax at slab rates', formatRupees(r.tax.slabTax)),
    r.tax.rebate > 0
      ? row(
          'Rebate (s.156)',
          minus(r.tax.rebate),
          r.tax.rebateIsMarginalRelief ? 'Marginal relief above ₹12 lakh' : undefined,
        )
      : '',
    r.tax.surcharge > 0
      ? row(
          `Surcharge at ${(r.tax.surchargeRate * 100).toFixed(0)}%`,
          formatRupees(r.tax.surcharge),
          r.tax.surchargeMarginalRelief > 0
            ? `Marginal relief of ${formatRupees(r.tax.surchargeMarginalRelief)} applied`
            : undefined,
        )
      : '',
    row('Health & education cess (4%)', formatRupees(r.tax.cess)),
  ]
    .filter(Boolean)
    .join('');

  return `<div class="space-y-8">
    ${ledger('Taxable income', rows, { label: 'Taxable income', value: formatRupees(r.taxableIncome) }, `taxable-${r.regime}`, `, ${REGIME_LABEL[r.regime].toLowerCase()}`)}
    ${ledger('Income tax', taxRows, { label: 'Total tax', value: formatRupees(r.tax.totalTax) }, `tax-${r.regime}`, `, ${REGIME_LABEL[r.regime].toLowerCase()}`)}
  </div>`;
}

export function renderDetails(result: CalculationResult): string {
  if (result.errors.length > 0) return '';

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
      ? row(
          'Provident fund (employee)',
          minus(s.pf.employee * 12),
          result.input.pfMode === 'ceiling'
            ? pfCeilingNote(s.pf.employeeByMonth, formatRupees)
            : 'On full Labour Code wages',
        )
      : '',
    s.esi.applicable ? row('ESI (employee, 0.75%)', minus(s.esi.employee * 12)) : '',
    pt.annual > 0
      ? row(pt.label, minus(pt.annual), describePtPattern(pt.monthly, formatRupees))
      : '',
    row(`Income tax (${REGIME_LABEL[result.better].toLowerCase()})`, minus(best.tax.totalTax)),
  ]
    .filter(Boolean)
    .join('');

  // Each row says where the money actually goes: some of this is yours but not liquid (PF, NPS),
  // some is paid later (gratuity), some is cover rather than cash (ESI), and variable pay is paid
  // to you but separately. Lumping it all under "not your bank account" would be wrong.
  // Employer PF, ESI and gratuity belong in this table only when the offer counts them inside
  // CTC; otherwise the rows would no longer add up to the total. Anything paid on top is still
  // worth knowing about, so it is mentioned under the table instead.
  const input = result.input;
  const inCtc = {
    pf: input.employerPfInCtc && a.employerPf > 0,
    gratuity: input.gratuityInCtc && a.gratuity > 0,
    esi: input.employerEsiInCtc && a.employerEsi > 0,
  };
  const onTop = [
    !input.employerPfInCtc && a.employerPf > 0 ? `${formatRupees(a.employerPf)} into your PF` : '',
    !input.gratuityInCtc && a.gratuity > 0
      ? `${formatRupees(a.gratuity)} towards your gratuity`
      : '',
    !input.employerEsiInCtc && a.employerEsi > 0
      ? `${formatRupees(a.employerEsi)} in ESI contributions`
      : '',
  ].filter(Boolean);

  const restOfCtc = [
    a.variable > 0
      ? row('Variable pay', formatRupees(a.variable), 'Paid to you separately, if fully earned')
      : '',
    inCtc.pf
      ? row('Employer PF', formatRupees(a.employerPf), employerPfNote(s.pf, formatRupees))
      : '',
    a.employerNps > 0
      ? row('Employer NPS', formatRupees(a.employerNps), 'Yours, but locked until retirement')
      : '',
    inCtc.gratuity
      ? row('Gratuity provision', formatRupees(a.gratuity), 'Paid only when you leave, if eligible')
      : '',
    inCtc.esi
      ? row('Employer ESI (3.25%)', formatRupees(a.employerEsi), 'Buys insurance cover, not cash')
      : '',
  ]
    .filter(Boolean)
    .join('');

  // Always rendered (hidden when empty) so the blocks after it keep their positions: the page is
  // patched in place by position, and a section that comes and goes would make the patch replace,
  // and so close, the "How the tax was worked out" panel below.
  const notices = `<section id="notes" aria-labelledby="notes-heading" class="scroll-mt-6"${
    result.notices.length ? '' : ' hidden'
  }>
        <h3 id="notes-heading" class="text-base font-semibold text-ink">Notes on your numbers</h3>
        <ul class="mt-3 space-y-2">${result.notices
          .map(
            (n) =>
              `<li class="rounded-md border border-warn-line/70 bg-warn-soft px-4 py-3 text-sm text-warn-ink">${forScreen(n)}</li>`,
          )
          .join('')}</ul>
      </section>`;

  const gratuity = result.gratuityProjection;
  const gratuityNote = gratuity.eligible
    ? `You would receive about <strong class="font-medium text-ink">${formatRupees(gratuity.amount)}</strong> in gratuity after ${
        gratuity.countedYears
      } years, based on ${formatRupees(s.wages.wages)} a month of Labour Code wages.`
    : `Gratuity needs ${gratuity.minimumYears} years of service. It is part of your CTC but you receive nothing before then.`;

  return `<div class="space-y-4">
    ${notices}
    <div class="breakdown grid gap-4 lg:grid-cols-2">
      ${ledger('What you are paid', earnings, { label: 'Gross salary (fixed)', value: formatRupees(a.grossFixed) })}
      ${ledger(
        'What is deducted',
        row('Gross salary (fixed)', formatRupees(a.grossFixed), undefined, true) + deductions,
        {
          label: 'Annual in-hand',
          value: formatRupees(best.annualTakeHome - a.variable),
        },
      )}
      ${
        restOfCtc || onTop.length
          ? `<div>${
              restOfCtc
                ? ledger(
                    'The rest of your CTC, and where it goes',
                    row('Gross salary (fixed)', formatRupees(a.grossFixed), undefined, true) +
                      restOfCtc,
                    { label: 'Total CTC', value: formatRupees(a.ctcComponents) },
                  )
                : '<h3 class="text-base font-semibold text-ink">Beyond your CTC</h3>'
            }${
              onTop.length
                ? `<p class="mt-3 text-sm text-ink-2">On top of your CTC, your employer also pays ${joinList(onTop)} a year.</p>`
                : ''
            }</div>`
          : ''
      }
      <section aria-labelledby="gratuity-heading">
        <h3 id="gratuity-heading" class="text-base font-semibold text-ink">Gratuity</h3>
        <p class="mt-3 text-sm text-ink-2">${gratuityNote}</p>
      </section>
    </div>

    <details class="group rounded-lg border border-line bg-surface">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 text-base font-semibold text-ink hover:bg-surface-2 sm:px-6 [&::-webkit-details-marker]:hidden">
        How the tax was worked out
        <span class="text-sm font-normal text-ink-3 group-open:hidden">Show both regimes</span>
        <span class="hidden text-sm font-normal text-ink-3 group-open:inline">Hide</span>
      </summary>
      <div class="grid gap-x-12 gap-y-10 border-t border-line p-5 sm:p-6 lg:grid-cols-2">
        <div><p class="mb-4 text-sm font-semibold text-accent-ink">${REGIME_LABEL[best.regime]}</p>${taxDetail(best)}</div>
        <div><p class="mb-4 text-sm font-semibold text-ink-2">${REGIME_LABEL[other.regime]}</p>${taxDetail(other)}</div>
      </div>
    </details>
  </div>`;
}

/** "a", "a and b", "a, b and c" */
function joinList(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
