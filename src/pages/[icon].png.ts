/**
 * App and touch icons, rendered from the favicon at build time so they can never drift from it.
 *
 * Home-screen and app icons are full-bleed squares: iOS and Android cut their own rounded shape,
 * and a transparent corner would show as black. The mark sits well inside the central 80% safe
 * zone, so the same image also works as a maskable Android icon.
 */
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ICONS = {
  'apple-touch-icon': { size: 180, fullBleed: true },
  'icon-192': { size: 192, fullBleed: true },
  'icon-512': { size: 512, fullBleed: true },
  'favicon-48': { size: 48, fullBleed: false },
} as const;

type IconName = keyof typeof ICONS;

export function getStaticPaths() {
  return (Object.keys(ICONS) as IconName[]).map((icon) => ({ params: { icon } }));
}

export const GET: APIRoute = async ({ params }) => {
  const { size, fullBleed } = ICONS[params.icon as IconName];
  let svg = await readFile(join(process.cwd(), 'public', 'favicon.svg'), 'utf-8');
  if (fullBleed)
    svg = svg.replace(
      '<rect class="bg" width="32" height="32" rx="7"/>',
      '<rect class="bg" width="32" height="32"/>',
    );
  const png = await sharp(Buffer.from(svg), { density: 1536 }).resize(size, size).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
