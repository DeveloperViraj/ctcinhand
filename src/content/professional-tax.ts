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
  /** Where the page is about one city rather than the whole state (Tamil Nadu: Chennai). */
  place?: string;
  /** City passed to the engine for the worked examples, for city-level rates. */
  city?: string;
  /** Monthly salaries for the worked examples, where the defaults would all land in one band. */
  examples?: number[];
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
      'West Bengal State Tax on Professions, Trades, Callings and Employments Act 1979, as amended by the Act notified as 756-L of 7 August 2026, with the new Schedule set out in Finance Department Notification 1407-F.T. of 18 August 2026 (Kolkata Gazette Extraordinary, SAR-470).',
    caveat:
      'The new Schedule was published on 18 August 2026 as a draft inviting objections within 14 days, with salaried employees covered from 1 October 2026. We have not found the final notification. If the final version changed anything, the October to March figures may differ; your October payslip will show it.',
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
  {
    code: 'GJ',
    examples: [12_000, 12_500, 50_000],
    summary:
      'Gujarat charges a flat Rs 200 a month on salaries above Rs 12,000 a month, and nothing below. There is no February adjustment, so a full year comes to Rs 2,400.',
    salaryBasis:
      'Monthly salary or wages. Where pay is not monthly, the amount actually paid for a month is used.',
    rules: [
      'Nothing on a monthly salary up to Rs 12,000.',
      'Rs 200 a month above Rs 12,000, every month including February: Rs 2,400 a year.',
      'These rates apply from 1 April 2022. The older Rs 80 and Rs 150 bands that many sites still show were removed then.',
      'The same rates apply whether your employer is a government, a public sector undertaking or a private company.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Gujarat State Tax on Professions, Trades, Callings and Employments Act 1976, Schedule Entry 1, at the rates effective 1 April 2022 (Commercial Tax Department rate schedule, updated 27 June 2024).',
  },
  {
    code: 'MP',
    examples: [18_000, 20_000, 30_000, 50_000],
    summary:
      'Madhya Pradesh sets its slabs on your annual salary, not your monthly pay. Above Rs 4 lakh a year you pay Rs 2,500: Rs 208 a month for eleven months and Rs 212 in the twelfth.',
    salaryBasis:
      'Annual salary or wages. We use your regular salary for the year and leave out variable pay.',
    rules: [
      'Nothing on an annual salary up to Rs 2,25,000.',
      'Rs 1,500 a year (Rs 125 a month) from Rs 2,25,001 to Rs 3,00,000.',
      'Rs 2,000 a year from Rs 3,00,001 to Rs 4,00,000: Rs 166 a month for eleven months and Rs 174 in the twelfth.',
      'Rs 2,500 a year above Rs 4,00,000: Rs 208 a month for eleven months and Rs 212 in the twelfth.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Madhya Pradesh Vritti Kar Adhiniyam 1995 (Act 16 of 1995), Schedule Entry 1, as published by the Commercial Tax Department.',
    caveat:
      'The schedule tests annual salary or wages. If your employer counts a large bonus as salary, you could fall in a higher band than shown here.',
  },
  {
    code: 'AS',
    examples: [15_000, 20_000, 25_000, 50_000],
    summary:
      'Assam raised its exemption limit to Rs 15,000 a month from April 2025. Above that it charges Rs 180 a month, and Rs 208 a month from Rs 25,000, for a yearly maximum of Rs 2,496.',
    salaryBasis: 'Monthly salary or wages.',
    rules: [
      'Nothing on a monthly salary up to Rs 15,000.',
      'Rs 180 a month from Rs 15,001 to just under Rs 25,000.',
      'Rs 208 a month from Rs 25,000, every month: Rs 2,496 for a full year.',
      'The April 2025 notification removed the old Rs 150 band for salaries between Rs 10,000 and Rs 15,000. Some sites misquote the top rate as Rs 200; the Gazette says Rs 208.',
    ],
    exemptions: [
      'People above 60 whose gross income for the year does not exceed Rs 5 lakh (notification FTX.76/2006/2)',
    ],
    authority:
      'Assam Professions, Trades, Callings and Employments Taxation Act 1947, Schedule Entry 1, as substituted by notification eCF No. 169350/124 of 1 April 2025 (Assam Gazette Extraordinary No. 139, 2 April 2025).',
  },
  {
    code: 'BR',
    examples: [25_000, 30_000, 50_000, 1_00_000],
    summary:
      'Bihar charges professional tax once a year, on your annual income: Rs 1,000, Rs 2,000 or Rs 2,500. Your employer takes the whole amount from your September salary.',
    salaryBasis:
      'Income for the year. We use your regular salary; other income could move you into a higher band.',
    rules: [
      'Nothing on income up to Rs 3,00,000 a year.',
      'Rs 1,000 a year from Rs 3,00,001 to Rs 5,00,000.',
      'Rs 2,000 a year from Rs 5,00,001 to Rs 10,00,000.',
      'Rs 2,500 a year above Rs 10,00,000.',
      'Under rule 5 of the 2011 Rules the employer deducts the full year’s tax from the salary for September and pays it in by 15 November, so one month’s pay is noticeably lower.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Bihar Tax on Professions, Trades, Callings and Employments Act 2011, Schedule, and the Bihar Professional Tax Rules 2011, rule 5.',
    caveat:
      'The Act taxes income rather than salary alone. We apply the bands to your salary; if you have other income, check your band with your employer.',
  },
  {
    code: 'JH',
    examples: [25_000, 30_000, 60_000, 80_000, 1_00_000],
    summary:
      'Jharkhand sets five bands on annual salary, from Rs 1,200 to Rs 2,500 a year, and collects the tax every quarter.',
    salaryBasis:
      'Annual salary or wages, including perquisites but excluding bonus in any form, gratuity and pension.',
    rules: [
      'Nothing on an annual salary up to Rs 3,00,000.',
      'Rs 1,200 a year from Rs 3,00,001 to Rs 5,00,000.',
      'Rs 1,800 a year from Rs 5,00,001 to Rs 8,00,000.',
      'Rs 2,100 a year from Rs 8,00,001 to Rs 10,00,000.',
      'Rs 2,500 a year above Rs 10,00,000.',
      'Rule 15 of the 2012 Rules requires deduction every quarter, and the quarters end in June, September, December and March. Employers choose the month within each quarter.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Jharkhand Tax on Professions, Trades, Callings and Employments Act 2011, Schedule Entry 1 and section 2(p), with rule 15 of the 2012 Rules, as reproduced by the Commercial Taxes Department.',
    caveat:
      'Employers pick the month within each quarter, so your payslip may show the deduction earlier than in our examples. The yearly total is the same.',
  },
  {
    code: 'KL',
    examples: [1_500, 2_500, 6_000, 10_000, 20_000, 25_000],
    summary:
      'Kerala charges professional tax every half-year, on the salary for those six months. Rates at the lower end rose in October 2024; above Rs 1,25,000 a half-year you pay Rs 1,250 each half, Rs 2,500 a year.',
    salaryBasis: 'Salary for each half-year: April to September, and October to March.',
    rules: [
      'Nothing on half-yearly income up to Rs 11,999.',
      'Rs 320 from Rs 12,000 to Rs 17,999.',
      'Rs 450 from Rs 18,000 to Rs 29,999.',
      'Rs 600 from Rs 30,000 to Rs 44,999.',
      'Rs 750 from Rs 45,000 to Rs 99,999.',
      'Rs 1,000 from Rs 1,00,000 to Rs 1,24,999.',
      'Rs 1,250 from Rs 1,25,000. These amounts are per half-year, so double them for the year.',
      'The same table applies in every panchayat, municipality and corporation in the state.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Kerala Municipality Act 1994 and Kerala Panchayat Raj Act 1994, with rates revised by G.O.(Rt) No. 1149/2024/LSGD of 27 June 2024, effective 1 October 2024, on the Sixth State Finance Commission’s recommendation.',
    caveat:
      'Employers choose the month they deduct each half-year’s tax in. Our examples show it in September and March.',
  },
  {
    code: 'TN',
    examples: [3_500, 5_000, 7_500, 10_000, 12_500, 15_000],
    place: 'Chennai',
    city: 'Chennai',
    summary:
      'Chennai’s professional tax is set by the Greater Chennai Corporation and charged every half-year. On a salary above Rs 12,500 a month you pay Rs 1,250 each half, Rs 2,500 a year. Elsewhere in Tamil Nadu each town sets its own rates.',
    salaryBasis: 'Average salary for each half-year: April to September, and October to March.',
    rules: [
      'Nothing on half-yearly income up to Rs 21,000.',
      'Rs 180 from Rs 21,001 to Rs 30,000.',
      'Rs 425 from Rs 30,001 to Rs 45,000.',
      'Rs 930 from Rs 45,001 to Rs 60,000.',
      'Rs 1,025 from Rs 60,001 to Rs 75,000.',
      'Rs 1,250 above Rs 75,000. These amounts are per half-year; the lower bands rose by about 35% from October 2024.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Tamil Nadu Urban Local Bodies Act 1998 (as amended in 2022), sections 117-B and 117-C, at the Greater Chennai Corporation rates in its notice of 6 March 2025.',
    caveat:
      'Only Greater Chennai Corporation rates are verified. Other corporations, municipalities and panchayats in Tamil Nadu set their own, and the state publishes no single table. Employers choose the month for each half-year’s deduction; our examples show September and March.',
  },
  {
    code: 'OR',
    summary:
      'Odisha abolished professional tax from 1 April 2026. Nothing should be deducted from your salary for 2026-27, whether you work for the government or a private company.',
    salaryBasis: 'Not applicable: the levy no longer exists.',
    rules: [
      'The Odisha State Tax on Professions, Trades, Callings and Employments (Repeal) Ordinance, 2026 repealed the 2000 Act with effect from 1 April 2026.',
      'It was published in the Odisha Gazette on 21 April 2026, and it covers April 2026 salaries even though it came later.',
      'Tax for earlier years, and any assessments or penalties already raised, remain payable under its savings clause.',
      'Until the repeal, Odisha charged Rs 125 a month on annual income from Rs 1.6 lakh to Rs 3 lakh, and Rs 200 a month (Rs 300 in the last month) above that.',
    ],
    exemptions: ['Everyone, from 1 April 2026'],
    authority:
      'Odisha State Tax on Professions, Trades, Callings and Employments (Repeal) Ordinance, 2026, promulgated under Article 213 of the Constitution and published in the Odisha Gazette on 21 April 2026.',
    caveat:
      'An Ordinance lapses unless the legislature replaces it with an Act within six weeks of reassembling. We found no report of a replacing Act yet. If your employer is still deducting professional tax in Odisha, ask why.',
  },
  {
    code: 'TR',
    examples: [7_500, 10_000, 15_000, 50_000],
    summary:
      'Tripura charges Rs 150 a month on salaries from Rs 7,501 to Rs 15,000 and Rs 208 a month above that, for a yearly maximum of Rs 2,496.',
    salaryBasis: 'Monthly gross income.',
    rules: [
      'Nothing on a monthly salary up to Rs 7,500.',
      'Rs 150 a month (Rs 1,800 a year) from Rs 7,501 to Rs 15,000.',
      'Rs 208 a month (Rs 2,496 a year) from Rs 15,001.',
      'These rates have applied since July 2018 and replaced a five-band table from 2013.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Tripura Professions, Trades, Callings and Employments Taxation Act 1997, Schedule Sl. 1, as revised by notification F.II-1(7)-TAX/99(P-I) of 25 July 2018 (Tripura Gazette No. 443) and its corrigendum of 30 October 2018 (No. 1031).',
  },
  {
    code: 'SK',
    examples: [20_000, 25_000, 35_000, 50_000],
    summary:
      'Sikkim exempts monthly salaries up to Rs 20,000, one of the highest thresholds in India. Above that it charges Rs 125, Rs 150 or Rs 200 a month, so at most Rs 2,400 a year.',
    salaryBasis: 'Monthly salary or wages.',
    rules: [
      'Nothing on a monthly salary up to Rs 20,000.',
      'Rs 125 a month from Rs 20,001 to Rs 30,000.',
      'Rs 150 a month from Rs 30,001 to Rs 40,000.',
      'Rs 200 a month from Rs 40,001, every month: Rs 2,400 a year.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Sikkim Tax on Professions, Trades, Callings and Employments Act 2006 (Act 5 of 2006), Schedule Entry 1.',
    caveat:
      'We read these slabs in the 2006 Act and found no later amendment, but could not reach the Sikkim government’s own rate page to confirm they are still current.',
  },
  {
    code: 'MN',
    examples: [4_000, 6_000, 8_000, 10_000, 50_000],
    summary:
      'Manipur sets its slabs on annual income, and the top band starts at just Rs 1,25,000 a year, so almost every salaried person pays the full Rs 2,500.',
    salaryBasis: 'Total gross annual income. We use your regular salary for the year.',
    rules: [
      'Nothing on annual income up to Rs 50,000.',
      'Rs 1,200 a year from Rs 50,001 to Rs 75,000.',
      'Rs 2,000 a year from Rs 75,001 to Rs 1,00,000.',
      'Rs 2,400 a year from Rs 1,00,001 to Rs 1,25,000.',
      'Rs 2,500 a year above Rs 1,25,000.',
    ],
    exemptions: ['Members of the armed forces of the Union serving in Manipur (section 5)'],
    authority:
      'Manipur Professions, Trades, Callings and Employments Taxation Act 1981, Schedule Entry A, as substituted by the Eighth Amendment Act 2012 (Manipur Gazette Extraordinary No. 199, 31 August 2012), in force from 1 September 2012.',
    caveat:
      'The Act fixes an annual amount but not the instalments. We spread it evenly over the year, with the remainder in March.',
  },
  {
    code: 'MZ',
    examples: [5_000, 9_000, 14_000, 18_000, 25_000],
    summary:
      'Mizoram added a new Rs 195 band in July 2024. Above Rs 20,000 a month you pay Rs 208 a month, or Rs 2,500 if you pay for the whole year at once.',
    salaryBasis: 'Total gross monthly income.',
    rules: [
      'Nothing on a monthly salary up to Rs 5,000.',
      'Rs 75 a month from Rs 5,001 to Rs 8,000, Rs 120 to Rs 10,000, Rs 150 to Rs 12,000 and Rs 180 to Rs 15,000.',
      'Rs 195 a month from Rs 15,001 to Rs 20,000, a band added in July 2024.',
      'Rs 208 a month above Rs 20,000. Each band can instead be paid as a yearly lump sum; for the top band that is Rs 2,500.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Mizoram Professions, Trades, Callings and Employments Taxation Act 1995, Schedule Sl. 1, as modified by Taxation Department notification J.17011/1/2017-TAX of 11 July 2024.',
  },
  {
    code: 'NL',
    examples: [4_500, 8_000, 10_000, 12_000, 50_000],
    summary:
      'Nagaland charges Rs 208 a month on salaries of Rs 12,000 or more, and smaller amounts below that, for a yearly maximum of Rs 2,496.',
    salaryBasis: 'Monthly salary or wages.',
    rules: [
      'Nothing below Rs 4,000 a month.',
      'Rs 35 a month up to Rs 5,000, Rs 75 up to Rs 7,000, Rs 110 up to Rs 9,000 and Rs 180 up to Rs 12,000.',
      'Rs 208 a month from Rs 12,000: Rs 2,496 a year.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Nagaland Professions, Trades, Callings and Employments Taxation Act 1968, Schedule Sl. 1, as published by the Nagaland Taxes Department.',
    caveat:
      'The published schedule is undated and its bands are worded "more than X but less than Y", which leaves the exact boundary amounts unassigned. We put a salary exactly on a boundary in the higher band. This only matters below Rs 12,000 a month.',
  },
  {
    code: 'PY',
    examples: [16_000, 20_000, 50_000, 80_000, 1_00_000],
    summary:
      'Puducherry charges professional tax every half-year, through its municipalities and commune panchayats. On half-yearly income above Rs 5 lakh you pay Rs 1,250 each half, Rs 2,500 a year.',
    salaryBasis: 'Income for each half-year: April to September, and October to March.',
    rules: [
      'Nothing on half-yearly income up to Rs 99,999.',
      'Rs 250 from Rs 1,00,000 to Rs 2,00,000.',
      'Rs 500 from Rs 2,00,001 to Rs 3,00,000.',
      'Rs 750 from Rs 3,00,001 to Rs 4,00,000.',
      'Rs 1,000 from Rs 4,00,001 to Rs 5,00,000.',
      'Rs 1,250 above Rs 5,00,000. These amounts are per half-year.',
    ],
    exemptions: [
      'We have not confirmed this state’s list of exempt employees from an official source. Your employer’s payroll team will know.',
    ],
    authority:
      'Puducherry Municipalities Act 1973 and Puducherry Village and Commune Panchayats Act 1973, as amended in 2017, with the rates set out in Finance Department G.O.Ms.No.24/F3/2017 of 4 July 2017.',
    caveat:
      'The 2017 amendments set these as minimum rates, so a local body may charge more. Government employees have the tax recovered quarterly; our examples show each half-year’s tax in September and March.',
  },
];
