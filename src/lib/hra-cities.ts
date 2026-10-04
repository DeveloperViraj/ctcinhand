/**
 * Data for the HRA exemption guide: the eight cities where up to half of Basic can be exempt, and
 * worked comparisons against a city on the 40% limit.
 *
 * Four of the eight (Bengaluru, Hyderabad, Pune, Ahmedabad) joined the 50% list only from Tax Year
 * 2026-27, under Rule 279 of the Income-tax Rules 2026. Most salary calculators still treat them as
 * 40% cities, which understates the old regime for everyone renting there.
 *
 * Among the eight the arithmetic is identical, so one page carries the comparison rather than eight
 * near-duplicates.
 */

import { lakhs } from './brackets';
import { rentToBreakEven } from './tax/break-even';
import { calculate, type CalculatorInput } from './tax/calculate';
import { DEFAULT_INPUT } from './tax/defaults';
import { HRA_FIFTY_PERCENT_CITIES, LANDLORD_PAN_THRESHOLD } from './tax/hra';

export interface HraCity {
  city: (typeof HRA_FIFTY_PERCENT_CITIES)[number];
  /** The state whose professional tax applies when you work there. */
  stateCode: string;
  stateName: string;
  /** On the 50% list only from Tax Year 2026-27. */
  newThisYear: boolean;
}

export const HRA_CITIES: readonly HraCity[] = [
  { city: 'Mumbai', stateCode: 'MH', stateName: 'Maharashtra', newThisYear: false },
  { city: 'Delhi', stateCode: 'DL', stateName: 'Delhi', newThisYear: false },
  { city: 'Kolkata', stateCode: 'WB', stateName: 'West Bengal', newThisYear: false },
  { city: 'Chennai', stateCode: 'TN', stateName: 'Tamil Nadu', newThisYear: false },
  { city: 'Bengaluru', stateCode: 'KA', stateName: 'Karnataka', newThisYear: true },
  { city: 'Hyderabad', stateCode: 'TS', stateName: 'Telangana', newThisYear: true },
  { city: 'Pune', stateCode: 'MH', stateName: 'Maharashtra', newThisYear: true },
  { city: 'Ahmedabad', stateCode: 'GJ', stateName: 'Gujarat', newThisYear: true },
];

/** Salaries and rents for the worked examples. */
export const EXAMPLE_CTCS = [10, 15, 20, 30] as const;
export const EXAMPLE_RENTS = [15_000, 25_000, 40_000] as const;

export interface ExemptionCell {
  rent: number;
  /** Annual HRA exemption under the old regime in one of the eight cities. */
  at50: number;
  /** The same rent and salary anywhere else. */
  at40: number;
}

export interface HraData {
  grid: { lpa: number; cells: ExemptionCell[] }[];
  /** Rent at which the old regime starts to win, in a 50% city and in a 40% city. */
  tipping: { lpa: number; at50: number | null; at40: number | null }[];
  /** Monthly rent above which the landlord's PAN must be given to the employer. */
  panThresholdMonthly: number;
}

/** Bengaluru stands in for the eight 50% cities, which all compute the same; Karnataka PT throughout. */
const input = (lpa: number, rent: number, city: string): CalculatorInput => ({
  ...DEFAULT_INPUT,
  ctc: lakhs(lpa),
  city,
  monthlyRent: rent,
});

export function hraData(): HraData {
  const exemption = (lpa: number, rent: number, city: string) =>
    calculate(input(lpa, rent, city)).regimes.old.hraExemption?.exemption ?? 0;

  return {
    grid: EXAMPLE_CTCS.map((lpa) => ({
      lpa,
      cells: EXAMPLE_RENTS.map((rent) => ({
        rent,
        at50: exemption(lpa, rent, 'Bengaluru'),
        at40: exemption(lpa, rent, 'Other'),
      })),
    })),
    tipping: [15, 20, 25, 30].map((lpa) => ({
      lpa,
      at50: rentToBreakEven(input(lpa, 0, 'Bengaluru')).monthlyRent,
      at40: rentToBreakEven(input(lpa, 0, 'Other')).monthlyRent,
    })),
    panThresholdMonthly: Math.ceil(LANDLORD_PAN_THRESHOLD / 12),
  };
}
