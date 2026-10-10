/** The favicon: the shared mark (src/lib/brand.ts) without the rupee sign, which is noise at 16px. */
import type { APIRoute } from 'astro';
import { logoSvg } from '../lib/brand';

export const GET: APIRoute = () =>
  new Response(logoSvg({ rupee: false }), { headers: { 'Content-Type': 'image/svg+xml' } });
