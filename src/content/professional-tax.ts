/**
 * Editorial copy for the per-state professional tax pages.
 *
 * Only the prose lives here. Every rupee figure shown on those pages is computed by
 * computeProfessionalTax at render time, so the tables can never drift from the calculator.
 */

export interface PtStatePage {
  code: string;
  /** Short summary used as the meta description and the page intro. */
  summary: string;
  /** How the state defines the salary it tests against the slabs. */
  salaryBasis: string;
  /** The slab structure in words, one bullet per rule. */
  rules: string[];
  exemptions: string[];
  /** The Act and amendments the figures come from. */
  authority: string;
  /** Anything a reader should treat with caution. */
  caveat?: string;
}

export const PT_STATE_PAGES: readonly PtStatePage[] = [
  {
    code: 'MH',
    summary:
      'Maharashtra charges professional tax on a sliding scale, with a higher exemption for women and an extra Rs 100 in February. The annual maximum is Rs 2,500.',
    salaryBasis:
      'Monthly gross salary, including dearness allowance and perquisites, but excluding bonus of any kind and gratuity.',
    rules: [
      'Men: nothing up to Rs 7,500 a month; Rs 175 a month from Rs 7,501 to Rs 10,000; Rs 200 a month above Rs 10,000.',
      'Women: nothing up to Rs 25,000 a month; Rs 200 a month above that. The threshold was raised from Rs 10,000 in April 2023.',
      'February is charged at Rs 300 instead of Rs 200, which brings the year to exactly Rs 2,500. This applies to women above Rs 25,000 as well as to men, and not to the Rs 175 band.',
    ],
    exemptions: [
      'People aged 65 or over',
      'People with a benchmark disability, and a parent or guardian of a child with one',
      'Members of the armed forces serving in the state, and armed members of the central police forces',
      'Badli workers in the textile industry',
    ],
    authority:
      'Maharashtra State Tax on Professions, Trades, Callings and Employments Act 1975, Schedule I Entry 1, as amended by Mah. Act XIX of 2023.',
  },
  {
    code: 'KA',
    summary:
      'Karnataka exempts salaries below Rs 25,000 a month entirely. Above that it is Rs 200 a month, rising to Rs 300 in February, for a yearly total of Rs 2,500.',
    salaryBasis:
      'Monthly salary or wage including bonus, arrears and perquisites. A bonus is spread across the months it relates to, so a large annual bonus can push a salary over the threshold.',
    rules: [
      'Nothing below Rs 25,000 a month. Exactly Rs 25,000 is taxable, because the schedule reads "Rs 25,000 and above".',
      'Rs 200 a month from April to January and in March.',
      'Rs 300 in February, added by Karnataka Act 33 of 2025 with effect from April 2025. The year therefore comes to Rs 2,500, not the Rs 2,400 many calculators still show.',
    ],
    exemptions: [
      'People aged 60 or over',
      'People with at least 40% permanent disability, with a certificate',
      'Blind, deaf or mute salary earners',
      'Ex-servicemen, and serving members of the armed forces and central para-military forces',
      'Anyone employed for 120 days or fewer in the year',
    ],
    authority:
      'Karnataka Tax on Professions, Trades, Callings and Employments Act 1976, Schedule Serial 1, as amended by Karnataka Act 14 of 2023 (threshold) and Act 33 of 2025 (February rate).',
  },
  {
    code: 'TS',
    summary:
      'Telangana uses three simple bands and has no February adjustment. The most anyone pays is Rs 2,400 a year.',
    salaryBasis: 'Monthly gross salary.',
    rules: [
      'Nothing up to Rs 15,000 a month.',
      'Rs 150 a month from Rs 15,001 to Rs 20,000.',
      'Rs 200 a month above Rs 20,000, every month including February, so Rs 2,400 for a full year.',
    ],
    exemptions: ['People with 40% or more disability, across all categories'],
    authority:
      'Telangana Tax on Professions, Trades, Callings and Employments Act 1987, First Schedule.',
  },
  {
    code: 'AP',
    summary:
      'Andhra Pradesh still uses the same table as Telangana: nothing up to Rs 15,000 a month, then Rs 150, then Rs 200. The yearly maximum is Rs 2,400.',
    salaryBasis: 'Monthly gross salary.',
    rules: [
      'Nothing up to Rs 15,000 a month.',
      'Rs 150 a month from Rs 15,001 to Rs 20,000.',
      'Rs 200 a month above Rs 20,000, with no February adjustment.',
    ],
    exemptions: ['People with 40% or more disability, as under the shared 1987 Act'],
    authority:
      'Andhra Pradesh Tax on Professions, Trades, Callings and Employments Act 1987, First Schedule, unchanged since the state was divided.',
    caveat:
      'Every compliance source puts Andhra Pradesh on the same table as Telangana, but the state portal would not serve its own schedule page when we checked, so this is not confirmed from a primary source.',
  },
  {
    code: 'WB',
    summary:
      'West Bengal replaced its entire professional tax schedule on 1 October 2026. April to September is charged on the old table and October to March on the new one, so a single yearly figure is wrong for 2026-27.',
    salaryBasis: 'Monthly gross salary.',
    rules: [
      'Until 30 September 2026: nothing up to Rs 10,000 a month, then Rs 110, Rs 130, Rs 150 and Rs 200 as salary rises past Rs 15,000, Rs 25,000 and Rs 40,000.',
      'From 1 October 2026: nothing up to Rs 20,000 a month, then Rs 100 to Rs 30,000, Rs 140 to Rs 50,000, Rs 170 to Rs 1,00,000, and Rs 208 above that.',
      'The exemption threshold doubles, so many lower and middle salaries stop paying entirely from October.',
      'There is no February adjustment. The Rs 208 top rate reaches the Rs 2,500 annual ceiling by arithmetic instead.',
    ],
    exemptions: ['People with a permanent physical disability, and blind, deaf or mute employees'],
    authority:
      'West Bengal State Tax on Professions, Trades, Callings and Employments Act 1979, as revised with effect from 1 October 2026.',
    caveat:
      'Two independent compliance advisories agree on the new table and the 1 October 2026 start date, but they cite different notification numbers and no West Bengal government source would load for us. Treat the October figures as probable rather than confirmed.',
  },
  {
    code: 'PB',
    summary:
      'Punjab is often listed as a state with no professional tax. It is not. It charges a flat Rs 200 a month under a differently named Act, which your employer deducts from your salary.',
    salaryBasis: 'Applies to employees liable to income tax, regardless of the exact salary.',
    rules: [
      'Rs 200 every month, including February, for a yearly total of Rs 2,400.',
      'It is called the Punjab State Development Tax, but it is a tax on professions, trades, callings and employments under Article 276, which is why the annual figure sits just under the Rs 2,500 constitutional ceiling.',
      'Employers deduct it at source, and it is deductible from taxable salary in the old regime like any other professional tax.',
    ],
    exemptions: ['People whose income is below the threshold at which income tax is payable'],
    authority:
      'Punjab State Development Tax Act 2018 (Punjab Act 11 of 2018), still in force in 2026.',
    caveat:
      'Punjab has not published a readable clarification of the income threshold since the Income-tax Act, 2025 replaced the 1961 Act. We apply the levy above the basic exemption limit.',
  },
];
