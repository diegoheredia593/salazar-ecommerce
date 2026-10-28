// sitemap.xml: las páginas del sitio, las marcas con productos y todas las fichas PUBLICADAS (la Tienda nunca entrega
// borradores ni archivados).
import type { APIRoute } from 'astro';
import { contenido } from '../lib/content/contenido';
import { marcaDe, todosLosProductos } from '../lib/tienda/catalogo';
import { tienda } from '../lib/tienda/fuente';

const FIJAS = ['/', '/tienda', '/promociones', '/marca', '/nosotros', '/contacto', '/mi-pedido', '/terminos', '/privacidad', '/garantias-y-devoluciones'];

export const GET: APIRoute = async ({ url }) => {
  const [productos, marcas] = await Promise.all([todosLosProductos(await tienda()), (await contenido()).coleccion('marcas')]);
  const conProductos = marcas.filter((m) => productos.some((p) => marcaDe(p.nombre, marcas)?.slug === m.slug));
  const rutas = [
    ...FIJAS,
    ...conProductos.map((m) => `/marca/${m.slug}`),
    ...productos.map((p) => `/tienda/${p.slug}`),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rutas.map((r) => `  <url><loc>${new URL(r, url.origin).href}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
