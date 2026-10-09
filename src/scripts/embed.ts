/**
 * The embeddable calculator's island: three inputs, the same engine and summary renderer as the
 * main page, and a link that opens the full breakdown for the current figures.
 */

import { formatNumber, parseRupees } from '../lib/format';
import { morphInto } from '../lib/morph';
import { renderSummary } from '../lib/render-result';
import { fromPosition, toPosition, type SliderScale } from '../lib/slider-scale';
import { calculate } from '../lib/tax/calculate';
import { DEFAULT_INPUT } from '../lib/tax/defaults';
import { DEFAULT_STATE, encodeState } from '../lib/url-state';
import { SITE } from '../config/site';

export function mountEmbed(): void {
  const form = document.getElementById('embed') as HTMLFormElement | null;
  const summary = document.getElementById('e-summary');
  const ctc = document.getElementById('e-ctc') as HTMLInputElement | null;
  const state = document.getElementById('e-state') as HTMLSelectElement | null;
  const city = document.getElementById('e-city') as HTMLSelectElement | null;
  const full = document.getElementById('e-full') as HTMLAnchorElement | null;
  const range = form?.querySelector<HTMLInputElement>('input[data-slider-for="e-ctc"]') ?? null;
  if (!form || !summary || !ctc || !state || !city || !full) return;

  const scale: SliderScale = { kind: 'log', min: 1_00_000, max: 2_00_00_000 };
  const grouped = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const paint = () => {
    if (!range) return;
    const fraction = Number(range.value) / Number(range.max);
    range.style.setProperty('--pct', `calc(0.75rem + (100% - 1.5rem) * ${fraction})`);
  };
  const syncRange = () => {
    if (!range) return;
    range.value = String(toPosition(parseRupees(ctc.value) ?? 0, scale));
    paint();
  };

  function render() {
    const input = {
      ...DEFAULT_INPUT,
      ctc: parseRupees(ctc!.value) ?? 0,
      stateCode: state!.value,
      city: city!.value,
    };
    const result = calculate(input);
    morphInto(summary!, renderSummary(result));
    // The headline is script-owned (the main page counts it up), so the patch leaves it alone and
    // it is written here instead.
    const digits = summary!.querySelector<HTMLElement>('[data-headline-num]');
    if (digits && result.errors.length === 0) {
      digits.textContent = formatNumber(result.regimes[result.better].monthlyTakeHome);
    }
    const query = encodeState({ ...DEFAULT_STATE, input });
    full!.href = `${SITE.url}/${query ? `?${query}` : ''}`;
    openLinksOnFullSite();
  }

  /**
   * The summary's links ("Why", the notes link) point at pages of the full site. Inside a frame on
   * someone else's page they must open there, in a new tab: the site refuses to be framed anywhere
   * but /embed, so following them inside the frame would replace the widget with an error.
   */
  function openLinksOnFullSite() {
    for (const link of summary!.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href')!;
      if (href.startsWith('#')) link.href = `${full!.href}${href}`;
      else if (href.startsWith('/')) link.href = `${SITE.url}${href}`;
      link.target = '_blank';
      link.rel = 'noopener';
    }
  }

  // Tell the host page how tall the widget is, so the snippet can size the frame to fit and
  // nothing (the "Full breakdown" button especially) is cut off in a narrow column.
  const main = document.querySelector('main');
  if (main && window.parent !== window && 'ResizeObserver' in window) {
    const report = () =>
      window.parent.postMessage(
        { type: 'inhand:height', height: Math.ceil(main.getBoundingClientRect().height) },
        '*',
      );
    new ResizeObserver(report).observe(main);
  }

  range?.addEventListener('input', () => {
    ctc.value = grouped(fromPosition(Number(range.value), scale));
    paint();
    render();
  });
  form.addEventListener('input', (event) => {
    if (event.target === range) return;
    if (event.target === ctc) syncRange();
    render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  ctc.addEventListener('blur', () => {
    const parsed = parseRupees(ctc.value);
    if (parsed !== null) ctc.value = grouped(parsed);
  });

  syncRange();
  render();
}
