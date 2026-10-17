/** The favicon: the tab-size drawing of the mark (src/lib/brand.ts), a white rupee sign on green. */
import type { APIRoute } from 'astro';
import { faviconSvg } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(faviconSvg(), { headers: { 'Content-Type': 'image/svg+xml' } });
