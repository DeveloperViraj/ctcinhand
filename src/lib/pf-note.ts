/**
 * The note under the provident fund line when the employer contributes up to the wage ceiling.
 * The ceiling rose from Rs 15,000 to Rs 25,000 on 17 September 2026 (S.O. 5109(E)), so above
 * Rs 15,000 of wages the deduction steps up mid-year.
 */

import { describeSteps } from './pt-pattern';
import type { PfResult } from './tax/provident-fund';

export function pfCeilingNote(
  employeeByMonth: readonly number[],
  money: (amount: number) => string,
): string {
  const steps = describeSteps(employeeByMonth, money);
  return steps
    ? `${steps}: the wage ceiling rose to ${money(25_000)} on 17 September`
    : 'On your full wages, which are under the wage ceiling';
}

/** Where the employer's 12% goes in a year: part to the pension scheme, the rest to PF. */
export function employerPfNote(
  pf: Pick<PfResult, 'employerEpf' | 'employerEps'>,
  money: (amount: number) => string,
): string {
  return `${money(pf.employerEpf * 12)} to your PF account, ${money(pf.employerEps * 12)} to the pension scheme`;
}
