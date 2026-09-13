// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Keep in sync with SITE.url in src/config/site.ts
const SITE_URL = 'https://inhand.in';

// Unicode ranges copied from @fontsource-variable/ibm-plex-sans/unicode.json
const PLEX = '@fontsource-variable/ibm-plex-sans/files';
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

// https://astro.build/config
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
      // Self-hosted from node_modules: no third-party font requests at runtime.
      // The local provider is used (not npm) because the npm provider ignores `subsets`
      // and preloads every script subset in the package (~160 KB instead of ~77 KB).
      provider: fontProviders.local(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            weight: '100 700',
            style: 'normal',
            src: [`${PLEX}/ibm-plex-sans-latin-wght-normal.woff2`],
            unicodeRange: [LATIN],
          },
          {
            // Needed for U+20B9 (₹), which is on every page.
            weight: '100 700',
            style: 'normal',
            src: [`${PLEX}/ibm-plex-sans-latin-ext-wght-normal.woff2`],
            unicodeRange: [LATIN_EXT],
          },
        ],
      },
    },
  ],
  integrations: [
    icon(),
    sitemap({
      filter: (page) => !/\/(404|500)$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
