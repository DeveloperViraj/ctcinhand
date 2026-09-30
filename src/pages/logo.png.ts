/**
 * A raster logo for the Organization entity in structured data, which wants a bitmap of at least
 * 112px. Rendered from the favicon so the two can never drift apart.
 */
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export const GET: APIRoute = async () => {
  const svg = await readFile(join(process.cwd(), 'public', 'favicon.svg'));
  const png = await sharp(svg, { density: 1536 }).resize(512, 512).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
