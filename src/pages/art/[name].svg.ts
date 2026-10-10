/** The ornament files (see src/lib/art.ts), built once and cached across every page. */
import type { APIRoute } from 'astro';
import { ART, type ArtName } from '../../lib/art';

export function getStaticPaths() {
  return (Object.keys(ART) as ArtName[]).map((name) => ({ params: { name } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(ART[params.name as ArtName](), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
