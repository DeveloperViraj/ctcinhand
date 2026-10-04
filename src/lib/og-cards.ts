/**
 * Every social preview card the site publishes. A page points at its card with ogImagePath(slug);
 * the /og/[slug].png route renders exactly this list at build time.
 */

import { PT_STATE_PAGES } from '../content/professional-tax';
import { bracketLabel, bracketSlug, lakhs, LPA_BRACKETS } from './brackets';
import { formatRupees } from './format';
import { calculate } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import type { OgCard } from './og';
import { STATES } from './tax/professional-tax';

export function allOgCards(): OgCard[] {
  const names = new Map(STATES.map((s) => [s.code, s.name]));
  return [
    { slug: 'default', title: 'What actually reaches your bank each month' },
    { slug: 'how-it-works', title: 'How the calculation works, with every source' },
    { slug: 'professional-tax', title: 'Professional tax by state, month by month' },
    ...PT_STATE_PAGES.map((page) => ({
      slug: `professional-tax-${page.code.toLowerCase()}`,
      title: `Professional tax in ${page.place ?? names.get(page.code)}, month by month`,
    })),
    { slug: 'in-hand-salary', title: 'In-hand salary for every CTC from 3 to 100 LPA' },
    { slug: 'marginal-relief', title: 'Marginal relief above ₹12 lakh, worked out to the rupee' },
    { slug: 'old-vs-new-tax-regime', title: 'Old or new tax regime: the exact break-even' },
    { slug: 'hra-exemption', title: 'HRA exemption: eight cities now get the 50% limit' },
    ...LPA_BRACKETS.map((lpa) => {
      const result = calculate({ ...DEFAULT_INPUT, ctc: lakhs(lpa) });
      const best = result.regimes[result.better];
      const total = result.structure.annual.ctcComponents;
      const take = Math.max(0, best.annualTakeHome) / total;
      const tax = Math.max(0, best.tax.totalTax) / total;
      return {
        slug: `in-hand-${bracketSlug(lpa)}`,
        title: `${bracketLabel(lpa)} in-hand salary`,
        figure: formatRupees(best.monthlyTakeHome),
        figureCaption: 'a month in hand',
        shares: [take, tax, Math.max(0, 1 - take - tax)] as [number, number, number],
      };
    }),
  ];
}
