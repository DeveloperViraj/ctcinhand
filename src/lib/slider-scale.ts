/**
 * Maps a slider's position to a rupee amount and back.
 *
 * Salaries are not spread evenly between ₹1 lakh and ₹2 crore: most people are between 3 and 50
 * lakh. A linear CTC slider would spend nearly all of its travel on figures almost nobody earns,
 * so CTC uses a logarithmic scale (the middle of the track is about ₹14 lakh). Smaller amounts
 * with a hard cap, like 80C, use a plain linear scale.
 *
 * Positions run from 0 to POSITIONS so the native range input can step smoothly.
 */

export const POSITIONS = 1000;

export interface SliderScale {
  kind: 'log' | 'linear';
  min: number;
  max: number;
  /** Rounding step for linear scales. Log scales round to a step that grows with the amount. */
  step?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Rounds to the step a person would actually type at this size: ₹5,000 near 5 lakh, ₹1 lakh near 1 crore. */
export function niceRound(amount: number): number {
  const step =
    amount < 10_00_000
      ? 5_000
      : amount < 50_00_000
        ? 10_000
        : amount < 1_00_00_000
          ? 50_000
          : 1_00_000;
  return Math.round(amount / step) * step;
}

export function toPosition(amount: number, scale: SliderScale): number {
  const value = clamp(Number.isFinite(amount) ? amount : scale.min, scale.min, scale.max);
  const fraction =
    scale.kind === 'log'
      ? Math.log(value / scale.min) / Math.log(scale.max / scale.min)
      : (value - scale.min) / (scale.max - scale.min);
  return Math.round(clamp(fraction, 0, 1) * POSITIONS);
}

export function fromPosition(position: number, scale: SliderScale): number {
  const fraction = clamp(position / POSITIONS, 0, 1);
  if (scale.kind === 'log') {
    const raw = scale.min * Math.pow(scale.max / scale.min, fraction);
    return clamp(niceRound(raw), scale.min, scale.max);
  }
  const raw = scale.min + fraction * (scale.max - scale.min);
  const step = scale.step ?? 1;
  return clamp(Math.round(raw / step) * step, scale.min, scale.max);
}
