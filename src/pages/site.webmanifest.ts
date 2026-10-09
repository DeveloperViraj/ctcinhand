/** Web app manifest, so "Add to Home Screen" gets a real name and icon. */
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: `${SITE.name}: ${SITE.tagline}`,
      short_name: SITE.name,
      description: `Turn CTC into monthly in-hand salary for ${SITE.shortYearLabel}, with both tax regimes side by side.`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fafcfd',
      theme_color: '#0b6e87',
      lang: SITE.locale,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
