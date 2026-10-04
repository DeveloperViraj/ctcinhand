import { describe, expect, it } from 'vitest';
import { absolute, article, pagePath, person } from './seo';

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

describe('article', () => {
  const base = {
    url: 'https://inhand.in/marginal-relief',
    headline: 'Marginal relief',
    description: 'd',
    image: 'https://inhand.in/og/default.png',
    datePublished: '2026-09-30',
    dateModified: '2026-09-30',
  };

  it('credits the organisation when no author is configured', () => {
    expect(article({ ...base, author: null }).author).toEqual({
      '@id': 'https://inhand.in/#organization',
    });
  });

  it('credits the named person when one is configured', () => {
    const author = { name: 'A Person', slug: 'a-person', role: 'Engineer', bio: ['Hi.'] };
    expect(article({ ...base, author }).author).toEqual({
      '@id': 'https://inhand.in/authors/a-person#person',
    });
    expect(person(author)).toMatchObject({
      '@type': 'Person',
      name: 'A Person',
      url: 'https://inhand.in/authors/a-person',
      worksFor: { '@id': 'https://inhand.in/#organization' },
    });
  });
});
