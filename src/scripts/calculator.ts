/**
 * The calculator island: the only interactive JavaScript on the page.
 *
 * It keeps a single state object, recomputes on every input, and patches the result into the page
 * with the same render functions the server used. Inputs are mirrored into the URL (so results are
 * shareable) and into localStorage (so a return visit starts where you left off).
 */

import { formatNumber, formatRupees, parseRupees } from '../lib/format';
import { morphInto } from '../lib/morph';
import { renderDetails, renderSummary } from '../lib/render-result';
import { fromPosition, toPosition, type SliderScale } from '../lib/slider-scale';
import { calculate, type CalculatorInput, type ComponentValue } from '../lib/tax/calculate';
import { STATES } from '../lib/tax/professional-tax';
import { clearState, loadState, saveState } from '../lib/storage';
import { DEFAULT_STATE, decodeState, encodeState, type CalculatorState } from '../lib/url-state';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

/** A radio group read and written like a select: `group.value`. */
type Choice = { value: string };

export function mountCalculator(): void {
  const form = $<HTMLFormElement>('calc');
  const summary = $('summary');
  const details = $('details');
  const live = $('live');
  if (!form || !summary || !details) return;

  const radios = (name: string): Choice => {
    const group = form.elements.namedItem(name);
    return group instanceof RadioNodeList ? group : { value: '' };
  };

  const el = {
    ctc: $<HTMLInputElement>('ctc')!,
    state: $<HTMLSelectElement>('state')!,
    city: $<HTMLSelectElement>('city')!,
    rent: $<HTMLInputElement>('rent')!,
    ptStatus: $('pt-status')!,
    modeToggle: $<HTMLButtonElement>('mode-toggle')!,
    advanced: $('advanced')!,
    basic: $<HTMLInputElement>('basic')!,
    basicUnit: radios('basic-unit'),
    hra: $<HTMLInputElement>('hra')!,
    hraUnit: radios('hra-unit'),
    lta: $<HTMLInputElement>('lta')!,
    ltaUnit: radios('lta-unit'),
    variable: $<HTMLInputElement>('variable')!,
    variableUnit: radios('variable-unit'),
    nps: $<HTMLInputElement>('nps')!,
    npsUnit: radios('nps-unit'),
    special: $<HTMLInputElement>('special')!,
    specialUnit: radios('special-unit'),
    pfMode: $<HTMLSelectElement>('pf-mode')!,
    pfInCtc: $<HTMLInputElement>('pf-in-ctc')!,
    gratuityInCtc: $<HTMLInputElement>('gratuity-in-ctc')!,
    esiInCtc: $<HTMLInputElement>('esi-in-ctc')!,
    specialAsWages: $<HTMLInputElement>('special-as-wages')!,
    age: $<HTMLInputElement>('age')!,
    ptCategory: radios('pt-category'),
    employerType: radios('employer-type'),
    employmentType: radios('employment-type'),
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

  const summaryCard = form.querySelector<HTMLElement>('[data-summary]');
  const stickyBar = $('sticky-total');
  const stickyValue = stickyBar?.querySelector<HTMLElement>('[data-sticky-value]') ?? null;
  const stickyDelta = stickyBar?.querySelector<HTMLElement>('[data-sticky-delta]') ?? null;

  const sliders = Array.from(form.querySelectorAll<HTMLInputElement>('input[data-slider-for]'));
  const scaleOf = (range: HTMLInputElement): SliderScale => ({
    kind: range.dataset.kind === 'log' ? 'log' : 'linear',
    min: Number(range.dataset.min),
    max: Number(range.dataset.max),
    step: range.dataset.step ? Number(range.dataset.step) : undefined,
  });

  const stateByCode = new Map(STATES.map((s) => [s.code, s]));
  let state: CalculatorState = initialState();
  let lastHeadline = 0;

  function initialState(): CalculatorState {
    const fromUrl = window.location.search.slice(1);
    if (fromUrl) return decodeState(fromUrl);
    return loadState() ?? structuredClone(DEFAULT_STATE);
  }

  /** Every number field accepts what people type: "1,50,000", "1.5L", "12.5". */
  const num = (input: HTMLInputElement, fallback = 0) => {
    const value = parseRupees(input.value);
    return value === null ? fallback : Math.max(0, value);
  };

  const grouped = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 });

  function component(input: HTMLInputElement, unit: Choice): ComponentValue {
    return { unit: unit.value === 'rupees' ? 'rupees' : 'percent', value: num(input) };
  }

  function setComponent(input: HTMLInputElement, unit: Choice, v: ComponentValue) {
    input.value = grouped(v.value);
    unit.value = v.unit;
  }

  /** Writes the state object into the form controls. */
  function applyToForm() {
    const i = state.input;
    el.ctc.value = i.ctc ? grouped(i.ctc) : '';
    el.state.value = i.stateCode;
    el.city.value = i.city;
    el.rent.value = grouped(i.monthlyRent);
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
    el.d80c.value = grouped(i.deductions.sec80C);
    el.dNps.value = grouped(i.deductions.nps80CCD1B);
    el.d80d.value = grouped(i.deductions.healthInsurance);
    el.dHome.value = grouped(i.deductions.selfOccupiedInterest);
    setMode(state.mode);
    for (const range of sliders) syncSliderFromField(range);
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
      monthlyRent: num(el.rent),
      ptCategory: el.ptCategory.value as CalculatorInput['ptCategory'],
      ptOverrideMonthly: ptOverrideRaw === '' ? null : num(el.ptOverride),
      deductions: {
        sec80C: num(el.d80c),
        nps80CCD1B: num(el.dNps),
        healthInsurance: num(el.d80d),
        selfOccupiedInterest: num(el.dHome),
      },
    };
  }

  /** A chip whose text cannot be read as a number swaps to the error tint. */
  function flagUnreadable() {
    for (const input of form!.querySelectorAll<HTMLInputElement>('.chip input')) {
      const text = input.value.trim();
      const unreadable = text !== '' && parseRupees(text) === null;
      input.closest('.chip')?.toggleAttribute('data-invalid', unreadable);
      input.setAttribute('aria-invalid', String(unreadable));
    }
  }

  function setMode(mode: CalculatorState['mode']) {
    state.mode = mode;
    const advanced = mode === 'advanced';
    el.modeToggle.setAttribute('aria-checked', String(advanced));
    el.advanced.hidden = !advanced;
  }

  function updatePtStatus() {
    const info = stateByCode.get(state.input.stateCode);
    if (!info) return;
    el.ptStatus.textContent =
      info.pt === 'not-levied'
        ? 'No professional tax here.'
        : info.pt === 'verified'
          ? 'Professional tax slabs verified.'
          : 'Slabs not verified: enter yours in advanced mode.';
    el.ptStatus.className = `mt-1.5 min-h-[1.125rem] text-xs ${
      info.pt === 'unverified' ? 'text-warn-ink' : 'text-ink-3'
    }`;
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Sliders                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  const fieldFor = (range: HTMLInputElement) => $<HTMLInputElement>(range.dataset.sliderFor!);

  function paintSlider(range: HTMLInputElement) {
    const fraction = Number(range.value) / Number(range.max);
    // The fill ends under the centre of the 24px thumb, not at the raw percentage.
    range.style.setProperty('--pct', `calc(0.75rem + (100% - 1.5rem) * ${fraction})`);
  }

  function syncSliderFromField(range: HTMLInputElement) {
    const field = fieldFor(range);
    if (!field) return;
    range.value = String(toPosition(parseRupees(field.value) ?? 0, scaleOf(range)));
    paintSlider(range);
  }

  for (const range of sliders) {
    range.addEventListener('input', () => {
      const field = fieldFor(range);
      if (!field) return;
      field.value = grouped(fromPosition(Number(range.value), scaleOf(range)));
      paintSlider(range);
      render();
    });
  }

  /* ---------------------------------------------------------------------------------------- */
  /* The live figure                                                                           */
  /* ---------------------------------------------------------------------------------------- */

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Restarts a CSS animation even if it is already running. */
  function replay(node: Element, className: string) {
    node.classList.remove(className);
    void (node as HTMLElement).offsetWidth;
    node.classList.add(className);
  }

  /**
   * The one flourish: the figure counts to its new value while a rule draws itself underneath,
   * so it is obvious the result already updated and there is no "Calculate" button to hunt for.
   */
  function animateHeadline(to: number) {
    const headline = summary!.querySelector<HTMLElement>('[data-headline]');
    const digits = headline?.querySelector<HTMLElement>('[data-headline-num]') ?? null;
    const from = lastHeadline;
    lastHeadline = to;

    const write = (value: number) => {
      if (digits) digits.textContent = formatNumber(value);
      if (stickyValue) stickyValue.textContent = formatRupees(value);
    };

    const changed = Math.abs(to - from) >= 1;
    if (!headline || !digits || from === 0 || !changed || prefersReducedMotion.matches) {
      write(to);
      return;
    }

    replay(headline, 'value-flash');
    if (stickyValue) replay(stickyValue, 'value-flash');

    const start = performance.now();
    const duration = 320;
    const step = (now: number) => {
      // A newer calculation has taken over; let it finish instead.
      if (lastHeadline !== to) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      write(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /**
   * The change chip: how much the edit you are making moved your monthly take-home. A burst of
   * keystrokes ("1", "15", "150"...) is measured against where you started, not against each
   * intermediate figure, and the chip fades a couple of seconds after you stop.
   */
  let deltaBaseline: number | null = null;
  let deltaTimer: number | undefined;

  function showDelta(from: number, to: number) {
    const chips = [summary!.querySelector<HTMLElement>('[data-delta]'), stickyDelta].filter(
      (c): c is HTMLElement => c !== null,
    );

    const hide = () => {
      deltaBaseline = null;
      for (const chip of chips) chip.dataset.state = 'hidden';
    };

    if (from === 0 || to === 0) {
      hide();
      return;
    }
    if (deltaBaseline === null) deltaBaseline = from;
    const diff = Math.round(to - deltaBaseline);

    window.clearTimeout(deltaTimer);
    deltaTimer = window.setTimeout(hide, 2600);
    if (Math.abs(diff) < 1) {
      for (const chip of chips) chip.dataset.state = 'hidden';
      return;
    }

    const up = diff > 0;
    for (const chip of chips) {
      chip.textContent = `${up ? '+' : '−'}${formatRupees(Math.abs(diff))}`;
      chip.classList.toggle('bg-positive-soft', up);
      chip.classList.toggle('text-positive', up);
      chip.classList.toggle('bg-negative-soft', !up);
      chip.classList.toggle('text-negative', !up);
      chip.dataset.state = 'shown';
    }
  }

  /**
   * Reveals the sticky bar only once the summary has scrolled out of view. A throttled scroll
   * listener rather than IntersectionObserver: the behaviour is identical, and this is testable in
   * environments where observer callbacks do not fire.
   */
  let visibilityQueued = false;
  function syncStickyBar() {
    if (!stickyBar || !summaryCard) return;
    const { top, bottom } = summaryCard.getBoundingClientRect();
    const onScreen = bottom > 8 && top < window.innerHeight - 72;
    stickyBar.hidden = onScreen || lastHeadline === 0;
  }

  function watchResultVisibility() {
    if (visibilityQueued) return;
    visibilityQueued = true;
    requestAnimationFrame(() => {
      visibilityQueued = false;
      syncStickyBar();
    });
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Render                                                                                    */
  /* ---------------------------------------------------------------------------------------- */

  let urlTimer: number | undefined;
  let liveTimer: number | undefined;
  function render() {
    state.input = readFromForm();
    flagUnreadable();
    const computed = calculate(state.input);
    morphInto(summary!, renderSummary(computed));
    morphInto(details!, renderDetails(computed));

    const previous = lastHeadline;
    const next = computed.errors.length ? 0 : computed.regimes[computed.better].monthlyTakeHome;
    animateHeadline(next);
    showDelta(previous, next);
    updatePtStatus();
    watchResultVisibility();
    el.special.disabled = el.specialUnit.value === 'balance';

    // Debounced so typing does not spam history or storage.
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      const query = encodeState(state);
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
      saveState(state);
    }, 250);

    // Announce a one-line summary once typing pauses, rather than the whole breakdown per keystroke.
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      if (!live) return;
      const best = computed.regimes[computed.better];
      live.textContent = computed.errors.length
        ? computed.errors[0]
        : `Monthly in-hand ${formatRupees(best.monthlyTakeHome)}. ` +
          (computed.savingByChoosingBetter > 0
            ? `${computed.better === 'new' ? 'New' : 'Old'} regime is cheaper by ` +
              `${formatRupees(computed.savingByChoosingBetter)} a year.`
            : 'Both regimes come to the same tax.');
    }, 900);
  }

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    // Sliders render from their own handler, after writing into their field.
    if (target.matches('input[data-slider-for]')) return;
    const range = sliders.find((r) => r.dataset.sliderFor === target.id);
    if (range) syncSliderFromField(range);
    render();
  });
  form.addEventListener('change', (event) => {
    if ((event.target as HTMLElement).matches('input[data-slider-for]')) return;
    render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  // Money is regrouped in lakh and crore once you leave the field, never while you type.
  form.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-money]')) return;
    const parsed = parseRupees(input.value);
    if (parsed !== null) input.value = grouped(parsed);
  });

  el.modeToggle.addEventListener('click', () => {
    setMode(state.mode === 'advanced' ? 'quick' : 'advanced');
    render();
  });

  el.share.addEventListener('click', async () => {
    const label = el.share.querySelector('[data-share-label]');
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      if (label) label.textContent = 'Link copied';
    } catch {
      window.prompt('Copy this link', url);
    }
    window.setTimeout(() => {
      if (label) label.textContent = 'Share link';
    }, 2000);
  });

  function shareUrl() {
    const query = encodeState(state);
    return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
  }

  window.addEventListener('scroll', watchResultVisibility, { passive: true });
  window.addEventListener('resize', watchResultVisibility, { passive: true });

  stickyBar?.querySelector('[data-sticky-jump]')?.addEventListener('click', () => {
    summaryCard?.scrollIntoView({
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      block: 'start',
    });
  });

  el.reset.addEventListener('click', () => {
    clearState();
    state = structuredClone(DEFAULT_STATE);
    applyToForm();
    lastHeadline = 0;
    render();
  });

  /** Export libraries are large, so they load only when someone actually exports. */
  async function busy(button: HTMLButtonElement, task: () => Promise<void>) {
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    try {
      await task();
    } finally {
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
  }

  el.exportPdf.addEventListener('click', () =>
    busy(el.exportPdf, async () => {
      const { exportPdf } = await import('./export-pdf');
      await exportPdf(calculate(state.input));
    }),
  );

  el.exportXlsx.addEventListener('click', () =>
    busy(el.exportXlsx, async () => {
      const { exportExcel } = await import('./export-excel');
      await exportExcel(calculate(state.input));
    }),
  );

  applyToForm();
  render();
}
