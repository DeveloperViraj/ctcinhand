/** The favicon: the tab-size drawing of the mark (src/lib/brand.ts), with a large rupee coin. */
import type { APIRoute } from 'astro';
import { faviconSvg } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(faviconSvg(), { headers: { 'Content-Type': 'image/svg+xml' } });
