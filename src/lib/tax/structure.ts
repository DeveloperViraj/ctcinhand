/**
 * Resolves an annual CTC into salary components and statutory employer costs.
 *
 * CTC = fixed pay (basic, HRA, LTA, special allowance) + variable pay + employer NPS
 *     + employer PF (if in CTC) + employer ESI (if in CTC) + gratuity provision (if in CTC).
 *
 * Employer PF, ESI and gratuity all depend on Labour Code wages, and wages depend on the
 * allowances, which (when special allowance balances the CTC) depend on those same costs. The
 * dependency is weak, so a short fixed-point iteration converges to well under a paisa.
 */

import { computeEsi, type EsiResult } from './esi';
import { annualGratuityProvision } from './gratuity';
import { computeCodeWages, type CodeWages } from './labour-code-wages';
import { computeProvidentFund, type PfMode, type PfResult } from './provident-fund';

export interface StructureInput {
  ctcAnnual: number;
  /** Basic pay + DA, annual. */
  basicAnnual: number;
  hraAnnual: number;
  ltaAnnual: number;
  /** Performance bonus / variable pay, annual. Not wages under the Labour Codes. */
  variableAnnual: number;
  employerNpsAnnual: number;
  /** A fixed amount, or 'balance' to absorb whatever CTC remains. */
  specialAllowanceAnnual: number | 'balance';
  pfMode: PfMode;
  employerPfInCtc: boolean;
  employerEsiInCtc: boolean;
  gratuityInCtc: boolean;
  /** Treat special allowance as wages in full (statute's literal reading) instead of testing it. */
  specialAllowanceAsWages: boolean;
  disabled: boolean;
}

export interface ResolvedStructure {
  input: StructureInput;
  annual: {
    basic: number;
    hra: number;
    lta: number;
    special: number;
    variable: number;
    employerNps: number;
    employerPf: number;
    employerEsi: number;
    gratuity: number;
    /** Fixed pay paid through payroll: basic + HRA + LTA + special. */
    grossFixed: number;
    /** Sum of every CTC component as resolved. Equals ctcAnnual when the structure balances. */
    ctcComponents: number;
  };
  /** All per-month figures for the statutory calculations. */
  wages: CodeWages;
  pf: PfResult;
  esi: EsiResult;
  /** ctcAnnual - ctcComponents. Zero (within a rupee) for a valid structure. */
  unallocated: number;
  converged: boolean;
}

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

export function resolveStructure(input: StructureInput): ResolvedStructure {
  const fixedExceptSpecial = input.basicAnnual + input.hraAnnual + input.ltaAnnual;
  const nonStatutory = input.variableAnnual + input.employerNpsAnnual;

  let employerPfAnnual = 0;
  let employerEsiAnnual = 0;
  let gratuityAnnual = 0;
  let special = 0;
  let wages!: CodeWages;
  let pf!: PfResult;
  let esi!: EsiResult;
  let converged = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const inCtc =
      (input.employerPfInCtc ? employerPfAnnual : 0) +
      (input.employerEsiInCtc ? employerEsiAnnual : 0) +
      (input.gratuityInCtc ? gratuityAnnual : 0);

    special =
      input.specialAllowanceAnnual === 'balance'
        ? input.ctcAnnual - fixedExceptSpecial - nonStatutory - inCtc
        : input.specialAllowanceAnnual;
    const specialForWages = Math.max(0, special);

    wages = computeCodeWages({
      basicDa: input.basicAnnual / 12,
      testedAllowances:
        (input.hraAnnual +
          input.ltaAnnual +
          (input.specialAllowanceAsWages ? 0 : specialForWages)) /
        12,
      allowancesAsWages: input.specialAllowanceAsWages ? specialForWages / 12 : 0,
      employerPf: employerPfAnnual / 12,
    });
    pf = computeProvidentFund(wages.wages, input.pfMode);
    esi = computeEsi(wages.wages, input.disabled);

    const next = {
      pf: pf.employerTotal * 12,
      esi: esi.employer * 12,
      gratuity: annualGratuityProvision(wages.wages),
    };
    const delta = Math.max(
      Math.abs(next.pf - employerPfAnnual),
      Math.abs(next.esi - employerEsiAnnual),
      Math.abs(next.gratuity - gratuityAnnual),
    );
    employerPfAnnual = next.pf;
    employerEsiAnnual = next.esi;
    gratuityAnnual = next.gratuity;
    if (delta < TOLERANCE) {
      converged = true;
      break;
    }
  }

  // ESI coverage flips on a threshold, which can make the iteration oscillate for a structure
  // sitting exactly on the ceiling. That is reported rather than hidden.
  const grossFixed = fixedExceptSpecial + special;
  const ctcComponents =
    grossFixed +
    nonStatutory +
    (input.employerPfInCtc ? employerPfAnnual : 0) +
    (input.employerEsiInCtc ? employerEsiAnnual : 0) +
    (input.gratuityInCtc ? gratuityAnnual : 0);

  return {
    input,
    annual: {
      basic: input.basicAnnual,
      hra: input.hraAnnual,
      lta: input.ltaAnnual,
      special,
      variable: input.variableAnnual,
      employerNps: input.employerNpsAnnual,
      employerPf: employerPfAnnual,
      employerEsi: employerEsiAnnual,
      gratuity: gratuityAnnual,
      grossFixed,
      ctcComponents,
    },
    wages,
    pf,
    esi,
    unallocated: input.ctcAnnual - ctcComponents,
    converged,
  };
}
