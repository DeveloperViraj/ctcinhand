/**
 * A raster logo for the Organization entity in structured data, which wants a bitmap of at least
 * 112px. Rendered from the shared mark (src/lib/brand.ts) so the two can never drift apart.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { logoSvg } from '../lib/brand';

export const GET: APIRoute = async () => {
  const png = await sharp(Buffer.from(logoSvg()), { density: 1536 })
    .resize(512, 512)
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
