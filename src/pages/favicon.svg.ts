/** The favicon: the site's logo (src/lib/brand.ts), the same as in the header. */
import type { APIRoute } from 'astro';
import { logoSvg } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(logoSvg(), { headers: { 'Content-Type': 'image/svg+xml' } });
