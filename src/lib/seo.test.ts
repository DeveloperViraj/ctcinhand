import { describe, expect, it } from 'vitest';
import { AUTHOR } from '../config/author';
import { absolute, article, pagePath, person, webPage } from './seo';

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
    expect(absolute('/')).toBe('https://ctcinhand.pages.dev/');
    expect(absolute('/about')).toBe('https://ctcinhand.pages.dev/about');
  });
});

const base = {
  url: 'https://ctcinhand.pages.dev/marginal-relief',
  headline: 'Marginal relief',
  description: 'd',
  image: 'https://ctcinhand.pages.dev/og/default.png',
  datePublished: '2026-09-30',
  dateModified: '2026-09-30',
};

describe('article', () => {
  it('credits the organisation when no author is configured', () => {
    expect(article({ ...base, author: null }).author).toEqual({
      '@id': 'https://ctcinhand.pages.dev/#organization',
    });
  });

  it('credits the named person when one is configured', () => {
    const author = { name: 'A Person', slug: 'a-person', role: 'Engineer', bio: ['Hi.'] };
    expect(article({ ...base, author }).author).toEqual({
      '@id': 'https://ctcinhand.pages.dev/authors/a-person#person',
    });
    expect(person(author)).toMatchObject({
      '@type': 'Person',
      name: 'A Person',
      url: 'https://ctcinhand.pages.dev/authors/a-person',
      worksFor: { '@id': 'https://ctcinhand.pages.dev/#organization' },
    });
  });

  it('uses the short job title and school when given', () => {
    const author = {
      name: 'A Person',
      slug: 'a-person',
      role: 'Engineer who builds this site',
      jobTitle: 'Engineer',
      alumniOf: 'A College',
      bio: ['Hi.'],
    };
    expect(person(author)).toMatchObject({
      jobTitle: 'Engineer',
      alumniOf: { '@type': 'EducationalOrganization', name: 'A College' },
    });
  });
});

describe('webPage', () => {
  it('marks a profile page and points at the person it is about', () => {
    const node = webPage({
      url: 'https://ctcinhand.pages.dev/authors/a-person',
      title: 'A Person',
      description: 'd',
      hasBreadcrumb: true,
      image: 'https://ctcinhand.pages.dev/og/default.png',
      type: 'ProfilePage',
      mainEntity: 'https://ctcinhand.pages.dev/authors/a-person#person',
    });
    expect(node).toMatchObject({
      '@type': 'ProfilePage',
      '@id': 'https://ctcinhand.pages.dev/authors/a-person#webpage',
      mainEntity: { '@id': 'https://ctcinhand.pages.dev/authors/a-person#person' },
    });
  });
});

describe.skipIf(!AUTHOR)('the configured author', () => {
  it('is credited on articles by default', () => {
    expect(article(base).author).toEqual({
      '@id': `https://ctcinhand.pages.dev/authors/${AUTHOR!.slug}#person`,
    });
  });

  it('publishes no phone number or email address', () => {
    const text = JSON.stringify(AUTHOR);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
    expect(text).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it('links only to secure public profiles', () => {
    for (const link of AUTHOR!.sameAs ?? []) expect(link).toMatch(/^https:\/\//);
  });
});
