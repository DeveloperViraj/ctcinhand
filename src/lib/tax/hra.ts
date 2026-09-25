/**
 * House Rent Allowance exemption.
 *
 * Income-tax Act 2025 Schedule III Table Sl. No. 11, read with Rule 279 of the Income-tax Rules 2026
 * (G.S.R. 198(E), 20 March 2026). Formerly s.10(13A) and Rule 2A of the 1962 Rules.
 *
 * The exemption is the least of:
 *   (a) the HRA actually received;
 *   (b) rent actually paid minus one-tenth of salary;
 *   (c) 50% of salary in the eight listed cities, 40% anywhere else.
 * "Salary" here is basic pay plus DA where the terms of employment provide for it, excluding all
 * other allowances and perquisites (Rule 279(2)(b)).
 *
 * NOT available in the new regime (s.202(2)(a)(i)).
 */

/**
 * Rule 279(1) Table Sl. No. 1 raised the 50% list from the four old metros to EIGHT cities with
 * effect from FY 2026-27. A four-metro list is out of date for this year.
 */
export const HRA_FIFTY_PERCENT_CITIES = [
  'Ahmedabad',
  'Bengaluru',
  'Chennai',
  'Delhi',
  'Hyderabad',
  'Kolkata',
  'Mumbai',
  'Pune',
] as const;

export type HraCity = (typeof HRA_FIFTY_PERCENT_CITIES)[number] | 'Other';

export const HRA_CITY_OPTIONS: readonly HraCity[] = [...HRA_FIFTY_PERCENT_CITIES, 'Other'];

/** Annual rent above this requires the landlord's PAN in the declaration to the employer (Rule 205). */
export const LANDLORD_PAN_THRESHOLD = 1_00_000;

export interface HraExemptionResult {
  exemption: number;
  rate: 0.5 | 0.4;
  limbs: {
    received: number;
    rentOverTenPercent: number;
    percentOfSalary: number;
  };
  /** Which limb was the binding one, for display. */
  binding: 'received' | 'rent' | 'percent';
  needsLandlordPan: boolean;
}

export function isFiftyPercentCity(city: string): boolean {
  return (HRA_FIFTY_PERCENT_CITIES as readonly string[]).includes(city);
}

/** All amounts are annual. Salary means basic + DA for the same period. */
export function computeHraExemption(
  hraReceived: number,
  annualRentPaid: number,
  annualSalary: number,
  city: string,
): HraExemptionResult {
  const received = Math.max(0, hraReceived);
  const rent = Math.max(0, annualRentPaid);
  const salary = Math.max(0, annualSalary);
  const rate = isFiftyPercentCity(city) ? 0.5 : 0.4;

  const limbs = {
    received,
    rentOverTenPercent: Math.max(0, rent - 0.1 * salary),
    percentOfSalary: rate * salary,
  };
  const exemption = Math.min(limbs.received, limbs.rentOverTenPercent, limbs.percentOfSalary);
  const binding =
    exemption === limbs.received
      ? 'received'
      : exemption === limbs.rentOverTenPercent
        ? 'rent'
        : 'percent';

  return {
    exemption,
    rate,
    limbs,
    binding,
    needsLandlordPan: rent > LANDLORD_PAN_THRESHOLD,
  };
}
