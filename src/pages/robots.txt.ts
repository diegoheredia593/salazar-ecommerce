import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) =>
  new Response(
    ['User-agent: *', 'Disallow: /api/', 'Disallow: /carrito', 'Disallow: /pagar', 'Disallow: /compra/', 'Disallow: /buscar', '', `Sitemap: ${url.origin}/sitemap.xml`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
