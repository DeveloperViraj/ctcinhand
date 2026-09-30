import type { APIRoute, GetStaticPaths } from 'astro';
import { renderOgPng, type OgCard } from '../../lib/og';
import { allOgCards } from '../../lib/og-cards';

export const getStaticPaths = (() =>
  allOgCards().map((card) => ({
    params: { slug: card.slug },
    props: { card },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgPng((props as { card: OgCard }).card);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
