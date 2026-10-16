/** Keeps a city select arranged for the work state chosen beside it. */

import { cityForState, cityOptionsHtml } from '../lib/city-options';

/** Rebuilds the city list for `stateCode`, keeping `city` if it is set. */
export function refreshCities(select: HTMLSelectElement, stateCode: string, city: string): void {
  select.innerHTML = cityOptionsHtml(stateCode, city);
  select.value = city;
}

/**
 * When the work state changes, the city list follows and moves to that state's first 50% city
 * (or "elsewhere"). This listener runs before the form's own change handler, so the result is
 * already computed with the new city.
 */
export function bindCityToState(state: HTMLSelectElement, city: HTMLSelectElement): void {
  state.addEventListener('change', () => {
    refreshCities(city, state.value, cityForState(state.value, city.value));
  });
}
