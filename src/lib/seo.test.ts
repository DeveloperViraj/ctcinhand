import { describe, expect, it } from 'vitest';
import { absolute, pagePath } from './seo';

describe('pagePath', () => {
  it('maps built file names to the paths Cloudflare Pages serves', () => {
    expect(pagePath('/index.html')).toBe('/');
    expect(pagePath('/about.html')).toBe('/about');
    expect(pagePath('/professional-tax.html')).toBe('/professional-tax');
    expect(pagePath('/professional-tax/mh.html')).toBe('/professional-tax/mh');
  });

  it('accepts dev-server paths too', () => {
    expect(pagePath('/')).toBe('/');
    expect(pagePath('/about')).toBe('/about');
    expect(pagePath('/about/')).toBe('/about');
  });
});

describe('absolute', () => {
  it('keeps the slash only on the root', () => {
    expect(absolute('/')).toBe('https://inhand.in/');
    expect(absolute('/about')).toBe('https://inhand.in/about');
  });
});
