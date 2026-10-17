/**
 * The named author shown on explainer pages and in structured data.
 *
 * Leave AUTHOR as null until real details exist. While it is null the site credits the
 * organisation, builds no author page and emits no Person markup: a made-up author on a finance
 * site is worse for search than none, and Google's raters are trained to check.
 *
 * To switch it on, fill in the object below with true details only. Every claim in `bio` and
 * `credentials` should be something a reader could verify. The author page is built at
 * /authors/<slug>, bylines appear on every explainer and salary page, and the Article markup names
 * the person.
 */

export interface Author {
  /** As it should appear in bylines, e.g. "Priya Sharma". */
  name: string;
  /** URL segment for the profile page, e.g. "priya-sharma". */
  slug: string;
  /** One honest line, e.g. "Software engineer; builds and maintains the site". */
  role: string;
  /** Short job title for structured data. Defaults to `role`. */
  jobTitle?: string;
  /** Where the author studied, for schema.org alumniOf. */
  alumniOf?: string;
  /** Two to four short paragraphs: background, why you built this, how you keep it accurate. */
  bio: string[];
  /** Verifiable qualifications or experience, if any. Leave empty rather than stretch. */
  credentials?: string[];
  /** Topics for schema.org knowsAbout. */
  knowsAbout?: string[];
  /** Public profiles that confirm who you are (LinkedIn, GitHub, X), for schema.org sameAs. */
  sameAs?: string[];
  /** Path under /public to a square photo, e.g. "/authors/priya-sharma.jpg". Optional. */
  image?: string;
}

export const AUTHOR: Author | null = null;
