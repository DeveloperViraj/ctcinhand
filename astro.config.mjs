// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Keep in sync with SITE.url in src/config/site.ts
const SITE_URL = 'https://ctcsalarycalculator.com';

// Unicode ranges copied from @fontsource-variable/geist/unicode.json
const GEIST = '@fontsource-variable/geist/files';
const GEIST_MONO = '@fontsource-variable/geist-mono/files';
const ECZAR = '@fontsource-variable/eczar/files';
// Only the Devanagari letters and numerals the site's decorative words use, subset from Eczar (see
// src/assets/fonts). The range leaves out U+20B9 so the rupee sign never pulls this file in.
const DEVANAGARI = 'U+0900-097F,U+200C-200D,U+25CC';
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/**
 * Latin plus Latin Extended, which is where U+20B9 (the rupee sign) lives.
 * @param {string} dir
 * @param {string} family
 * @returns {any}
 */
const variants = (dir, family) => [
  {
    weight: '100 900',
    style: 'normal',
    src: [`${dir}/${family}-latin-wght-normal.woff2`],
    unicodeRange: [LATIN],
  },
  {
    weight: '100 900',
    style: 'normal',
    src: [`${dir}/${family}-latin-ext-wght-normal.woff2`],
    unicodeRange: [LATIN_EXT],
  },
];

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /about -> about.html, which Cloudflare Pages serves at /about with no trailing slash.
    format: 'file',
  },
  fonts: [
    {
      // Self-hosted from node_modules: no third-party font requests at runtime. Geist is Vercel's
      // open-source (OFL) typeface; the local provider keeps the subsets to Latin + Latin Extended.
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-geist',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: { variants: variants(GEIST, 'geist') },
    },
    {
      provider: fontProviders.local(),
      name: 'Eczar',
      cssVariable: '--font-eczar',
      fallbacks: ['Georgia', 'serif'],
      options: { variants: variants(ECZAR, 'eczar') },
    },
    {
      // The Devanagari accents, as their own family: when this file arrives, only the few
      // Devanagari words re-lay out, not every Eczar headline on the page.
      provider: fontProviders.local(),
      name: 'Eczar Devanagari',
      cssVariable: '--font-deva',
      fallbacks: ['serif'],
      options: {
        variants: [
          {
            weight: '600',
            style: 'normal',
            src: ['./src/assets/fonts/eczar-devanagari-art.woff2'],
            unicodeRange: [DEVANAGARI],
          },
        ],
      },
    },
    {
      // Only for small technical labels; never preloaded.
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: { variants: variants(GEIST_MONO, 'geist-mono') },
    },
  ],
  integrations: [
    icon(),
    sitemap({
      filter: (page) => !/\/(404|500|embed)$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
