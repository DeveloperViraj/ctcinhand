// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Keep in sync with SITE.url in src/config/site.ts
const SITE_URL = 'https://inhand.in';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /about -> about.html, which Cloudflare Pages serves at /about with no trailing slash.
    format: 'file',
  },
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
