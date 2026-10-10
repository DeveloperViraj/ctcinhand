/** The favicon: the shared mark (src/lib/brand.ts) without the coin's rim and rupee sign, which blur at 16px. */
import type { APIRoute } from 'astro';
import { logoSvg } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(logoSvg({ detail: false }), { headers: { 'Content-Type': 'image/svg+xml' } });
