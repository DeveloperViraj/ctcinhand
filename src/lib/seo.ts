/**
 * Structured data (schema.org JSON-LD), emitted once per page as a single @graph.
 *
 * Every page carries the same Organization and WebSite entities under stable @ids, so search
 * engines see one publisher across the site, plus a WebPage node, a BreadcrumbList on every page
 * below the home page, and whatever page-specific nodes the page adds (an Article, a Dataset).
 *
 * Deliberately absent: FAQ and HowTo markup beyond the home page (those rich results are retired),
 * SearchAction (retired), and any aggregateRating (self-serving ratings are a policy violation,
 * and a manual action on a finance site would be far worse than the missing stars).
 */

import { AUTHOR, type Author } from '../config/author';
import { SITE } from '../config/site';

export interface Crumb {
  name: string;
  /** Site-relative path, e.g. "/professional-tax". */
  path: string;
}

export type JsonLdNode = Record<string, unknown>;

export const ORGANIZATION_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;

export const authorPath = (author: Author) => `/authors/${author.slug}`;
const personId = (author: Author) => `${SITE.url}${authorPath(author)}#person`;

/**
 * The public path of a page from Astro's URL. Builds use `format: 'file'`, so pages arrive as
 * "/about.html" and the home page as "/index.html"; Cloudflare Pages serves them at "/about" and "/".
 */
export function pagePath(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, '')
    .replace(/(^|\/)index$/, '$1')
    .replace(/(.)\/$/, '$1');
  return path || '/';
}

/** Absolute URL without a trailing slash (the site serves /about, not /about/), except the root. */
export function absolute(path: string): string {
  const url = new URL(path, SITE.url).toString();
  return path === '/' ? url : url.replace(/\/$/, '');
}

export function organization(): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE.name,
    url: SITE.url,
    logo: {
      '@type': 'ImageObject',
      url: absolute('/logo.png'),
      width: 512,
      height: 512,
    },
    email: SITE.contactEmail,
  };
}

export function website(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    alternateName: `${SITE.name} CTC calculator`,
    url: SITE.url,
    inLanguage: SITE.locale,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbList(crumbs: readonly Crumb[], pageUrl: string): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

export function webPage(opts: {
  url: string;
  title: string;
  description: string;
  hasBreadcrumb: boolean;
  image: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLdNode {
  return {
    '@type': 'WebPage',
    '@id': `${opts.url}#webpage`,
    url: opts.url,
    name: opts.title,
    description: opts.description,
    inLanguage: SITE.locale,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: opts.image },
    ...(opts.hasBreadcrumb ? { breadcrumb: { '@id': `${opts.url}#breadcrumb` } } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };
}

/** The named author, when src/config/author.ts has one. */
export function person(author: Author): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': personId(author),
    name: author.name,
    url: absolute(authorPath(author)),
    jobTitle: author.role,
    worksFor: { '@id': ORGANIZATION_ID },
    ...(author.knowsAbout?.length ? { knowsAbout: author.knowsAbout } : {}),
    ...(author.sameAs?.length ? { sameAs: author.sameAs } : {}),
    ...(author.image ? { image: absolute(author.image) } : {}),
  };
}

/**
 * An explainer or reference page. Credited to the named author when there is one, otherwise to
 * the organisation: we will not invent an expert, and a fabricated author on a finance site is
 * worse than none.
 */
export function article(opts: {
  url: string;
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
  about?: string[];
  /** Defaults to the configured author; pass null to credit the organisation. */
  author?: Author | null;
}): JsonLdNode {
  const author = opts.author === undefined ? AUTHOR : opts.author;
  return {
    '@type': 'TechArticle',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    image: opts.image,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    inLanguage: SITE.locale,
    mainEntityOfPage: { '@id': `${opts.url}#webpage` },
    author: { '@id': author ? personId(author) : ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    ...(opts.about ? { about: opts.about.map((name) => ({ '@type': 'Thing', name })) } : {}),
  };
}
