/**
 * Every social preview card the site publishes. A page points at its card with ogImagePath(slug);
 * the /og/[slug].png route renders exactly this list at build time.
 */

import { PT_STATE_PAGES } from '../content/professional-tax';
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
      title: `Professional tax in ${names.get(page.code)}, month by month`,
    })),
  ];
}
