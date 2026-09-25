/**
 * The calculator island: the only interactive JavaScript on the page.
 *
 * It keeps a single state object, recomputes on every input, and re-renders the result with the
 * same function the server used. Inputs are mirrored into the URL (so results are shareable) and
 * into localStorage (so a return visit starts where you left off).
 */

import { formatRupees, parseRupees } from '../lib/format';
import { renderResult } from '../lib/render-result';
import { calculate, type CalculatorInput, type ComponentValue } from '../lib/tax/calculate';
import { STATES } from '../lib/tax/professional-tax';
import { clearState, loadState, saveState } from '../lib/storage';
import { DEFAULT_STATE, decodeState, encodeState, type CalculatorState } from '../lib/url-state';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

export function mountCalculator(): void {
  const form = $<HTMLFormElement>('calc');
  const result = $('result');
  if (!form || !result) return;

  const el = {
    ctc: $<HTMLInputElement>('ctc')!,
    state: $<HTMLSelectElement>('state')!,
    city: $<HTMLSelectElement>('city')!,
    rent: $<HTMLInputElement>('rent')!,
    ptStatus: $('pt-status')!,
    modeToggle: $<HTMLButtonElement>('mode-toggle')!,
    advanced: $('advanced')!,
    basic: $<HTMLInputElement>('basic')!,
    basicUnit: $<HTMLSelectElement>('basic-unit')!,
    hra: $<HTMLInputElement>('hra')!,
    hraUnit: $<HTMLSelectElement>('hra-unit')!,
    lta: $<HTMLInputElement>('lta')!,
    ltaUnit: $<HTMLSelectElement>('lta-unit')!,
    variable: $<HTMLInputElement>('variable')!,
    variableUnit: $<HTMLSelectElement>('variable-unit')!,
    nps: $<HTMLInputElement>('nps')!,
    npsUnit: $<HTMLSelectElement>('nps-unit')!,
    special: $<HTMLInputElement>('special')!,
    specialUnit: $<HTMLSelectElement>('special-unit')!,
    pfMode: $<HTMLSelectElement>('pf-mode')!,
    pfInCtc: $<HTMLInputElement>('pf-in-ctc')!,
    gratuityInCtc: $<HTMLInputElement>('gratuity-in-ctc')!,
    esiInCtc: $<HTMLInputElement>('esi-in-ctc')!,
    specialAsWages: $<HTMLInputElement>('special-as-wages')!,
    age: $<HTMLInputElement>('age')!,
    ptCategory: $<HTMLSelectElement>('pt-category')!,
    employerType: $<HTMLSelectElement>('employer-type')!,
    employmentType: $<HTMLSelectElement>('employment-type')!,
    years: $<HTMLInputElement>('years')!,
    ptOverride: $<HTMLInputElement>('pt-override')!,
    disabled: $<HTMLInputElement>('disabled')!,
    resident: $<HTMLInputElement>('resident')!,
    d80c: $<HTMLInputElement>('d-80c')!,
    dNps: $<HTMLInputElement>('d-nps')!,
    d80d: $<HTMLInputElement>('d-80d')!,
    dHome: $<HTMLInputElement>('d-home')!,
    share: $<HTMLButtonElement>('share')!,
    reset: $<HTMLButtonElement>('reset')!,
    exportPdf: $<HTMLButtonElement>('export-pdf')!,
    exportXlsx: $<HTMLButtonElement>('export-xlsx')!,
  };

  const stateByCode = new Map(STATES.map((s) => [s.code, s]));
  let state: CalculatorState = initialState();
  let lastHeadline = 0;

  function initialState(): CalculatorState {
    const fromUrl = window.location.search.slice(1);
    if (fromUrl) return decodeState(fromUrl);
    return loadState() ?? structuredClone(DEFAULT_STATE);
  }

  const num = (input: HTMLInputElement, fallback = 0) => {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  };

  function component(input: HTMLInputElement, unit: HTMLSelectElement): ComponentValue {
    return { unit: unit.value === 'rupees' ? 'rupees' : 'percent', value: num(input) };
  }

  function setComponent(input: HTMLInputElement, unit: HTMLSelectElement, v: ComponentValue) {
    input.value = String(v.value);
    unit.value = v.unit;
  }

  /** Writes the state object into the form controls. */
  function applyToForm() {
    const i = state.input;
    el.ctc.value = i.ctc ? i.ctc.toLocaleString('en-IN') : '';
    el.state.value = i.stateCode;
    el.city.value = i.city;
    el.rent.value = String(i.monthlyRent);
    setComponent(el.basic, el.basicUnit, i.basic);
    setComponent(el.hra, el.hraUnit, i.hra);
    setComponent(el.lta, el.ltaUnit, i.lta);
    setComponent(el.variable, el.variableUnit, i.variable);
    setComponent(el.nps, el.npsUnit, i.employerNps);
    if (i.specialAllowance === 'balance') {
      el.specialUnit.value = 'balance';
      el.special.value = '0';
    } else {
      setComponent(el.special, el.specialUnit, i.specialAllowance);
    }
    el.special.disabled = el.specialUnit.value === 'balance';
    el.pfMode.value = i.pfMode;
    el.pfInCtc.checked = i.employerPfInCtc;
    el.gratuityInCtc.checked = i.gratuityInCtc;
    el.esiInCtc.checked = i.employerEsiInCtc;
    el.specialAsWages.checked = i.specialAllowanceAsWages;
    el.age.value = String(i.age);
    el.ptCategory.value = i.ptCategory;
    el.employerType.value = i.employerType;
    el.employmentType.value = i.employmentType;
    el.years.value = String(i.yearsOfService);
    el.ptOverride.value = i.ptOverrideMonthly === null ? '' : String(i.ptOverrideMonthly);
    el.disabled.checked = i.disabled;
    el.resident.checked = i.resident;
    el.d80c.value = String(i.deductions.sec80C);
    el.dNps.value = String(i.deductions.nps80CCD1B);
    el.d80d.value = String(i.deductions.healthInsurance);
    el.dHome.value = String(i.deductions.selfOccupiedInterest);
    setMode(state.mode);
  }

  /** Reads the form controls back into the state object. */
  function readFromForm(): CalculatorInput {
    const specialMode = el.specialUnit.value;
    const ptOverrideRaw = el.ptOverride.value.trim();
    return {
      ctc: parseRupees(el.ctc.value) ?? 0,
      basic: component(el.basic, el.basicUnit),
      hra: component(el.hra, el.hraUnit),
      lta: component(el.lta, el.ltaUnit),
      variable: component(el.variable, el.variableUnit),
      employerNps: component(el.nps, el.npsUnit),
      specialAllowance:
        specialMode === 'balance'
          ? 'balance'
          : { unit: specialMode === 'rupees' ? 'rupees' : 'percent', value: num(el.special) },
      pfMode: el.pfMode.value as CalculatorInput['pfMode'],
      employerPfInCtc: el.pfInCtc.checked,
      employerEsiInCtc: el.esiInCtc.checked,
      gratuityInCtc: el.gratuityInCtc.checked,
      specialAllowanceAsWages: el.specialAsWages.checked,
      age: Math.round(num(el.age, 30)) || 30,
      resident: el.resident.checked,
      employerType: el.employerType.value as CalculatorInput['employerType'],
      employmentType: el.employmentType.value as CalculatorInput['employmentType'],
      yearsOfService: num(el.years),
      disabled: el.disabled.checked,
      stateCode: el.state.value,
      city: el.city.value,
      monthlyRent: parseRupees(el.rent.value) ?? 0,
      ptCategory: el.ptCategory.value as CalculatorInput['ptCategory'],
      ptOverrideMonthly:
        ptOverrideRaw === '' ? null : Math.max(0, Number.parseFloat(ptOverrideRaw) || 0),
      deductions: {
        sec80C: num(el.d80c),
        nps80CCD1B: num(el.dNps),
        healthInsurance: num(el.d80d),
        selfOccupiedInterest: num(el.dHome),
      },
    };
  }

  function setMode(mode: CalculatorState['mode']) {
    state.mode = mode;
    const advanced = mode === 'advanced';
    el.modeToggle.setAttribute('aria-checked', String(advanced));
    el.advanced.hidden = !advanced;
    const knob = el.modeToggle.querySelector<HTMLElement>('[data-knob]');
    if (knob) knob.style.transform = advanced ? 'translateX(1.25rem)' : 'translateX(0)';
  }

  function updatePtStatus() {
    const info = stateByCode.get(state.input.stateCode);
    if (!info) return;
    el.ptStatus.textContent =
      info.pt === 'not-levied'
        ? 'No professional tax here.'
        : info.pt === 'verified'
          ? 'Professional tax slabs verified.'
          : 'Slabs not verified — enter yours in advanced mode.';
    el.ptStatus.className = `mt-1 text-xs ${info.pt === 'unverified' ? 'text-warn-ink' : 'text-ink-3'}`;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** The one flourish: the headline figure counts to its new value as you type. */
  function animateHeadline(to: number) {
    const node = result!.querySelector<HTMLElement>('[data-headline]');
    if (!node) return;
    const from = lastHeadline;
    lastHeadline = to;
    if (prefersReducedMotion.matches || from === 0 || Math.abs(to - from) < 1) return;

    const start = performance.now();
    const duration = 320;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = formatRupees(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let urlTimer: number | undefined;
  function render() {
    state.input = readFromForm();
    const computed = calculate(state.input);
    result!.innerHTML = renderResult(computed);
    animateHeadline(computed.errors.length ? 0 : computed.regimes[computed.better].monthlyTakeHome);
    updatePtStatus();
    el.special.disabled = el.specialUnit.value === 'balance';

    // Debounced so typing does not spam history or storage.
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      const query = encodeState(state);
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
      saveState(state);
    }, 250);
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => e.preventDefault());

  el.modeToggle.addEventListener('click', () => {
    setMode(state.mode === 'advanced' ? 'quick' : 'advanced');
    render();
  });

  el.ctc.addEventListener('blur', () => {
    const parsed = parseRupees(el.ctc.value);
    if (parsed !== null) el.ctc.value = parsed.toLocaleString('en-IN');
  });

  el.share.addEventListener('click', async () => {
    const label = el.share.querySelector('[data-share-label]');
    const query = encodeState(state);
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      if (label) label.textContent = 'Link copied';
    } catch {
      window.prompt('Copy this link', url);
    }
    window.setTimeout(() => {
      if (label) label.textContent = 'Copy share link';
    }, 2000);
  });

  el.reset.addEventListener('click', () => {
    clearState();
    state = structuredClone(DEFAULT_STATE);
    applyToForm();
    lastHeadline = 0;
    render();
  });

  // Export libraries are large, so they load only when someone actually exports.
  el.exportPdf.addEventListener('click', async () => {
    el.exportPdf.disabled = true;
    try {
      const { exportPdf } = await import('./export-pdf');
      await exportPdf(calculate(state.input));
    } finally {
      el.exportPdf.disabled = false;
    }
  });

  el.exportXlsx.addEventListener('click', async () => {
    el.exportXlsx.disabled = true;
    try {
      const { exportExcel } = await import('./export-excel');
      await exportExcel(calculate(state.input));
    } finally {
      el.exportXlsx.disabled = false;
    }
  });

  applyToForm();
  render();
}
