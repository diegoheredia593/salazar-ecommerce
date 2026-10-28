// Lo que necesitan el encabezado, el menú y el pie en todas las páginas.
import type { AstroGlobal } from 'astro';
import { contenido } from './content/contenido';
import { COOKIE_CARRITO } from './tienda/carrito';
import { categoriasTienda, marcaDe, todosLosProductos } from './tienda/catalogo';
import { tienda } from './tienda/fuente';

export async function datosDelSitio(Astro: Pick<AstroGlobal, 'cookies'>) {
  const t = await tienda();
  const c = await contenido();
  const token = Astro.cookies.get(COOKIE_CARRITO)?.value;
  const [categorias, productos, marcas, sucursales, carrito] = await Promise.all([
    categoriasTienda(t),
    todosLosProductos(t),
    c.coleccion('marcas'),
    c.coleccion('sucursales'),
    token ? t.verCarrito(token).catch(() => null) : Promise.resolve(null),
  ]);

  // El menú de cada categoría lista las marcas que tienen productos publicados en ella.
  const marcasPorCategoria = new Map<string, typeof marcas>();
  for (const cat of categorias.filter((x) => !x.padre)) {
    const deCategoria = new Set(
      productos.filter((p) => p.categoria?.slug === cat.slug).map((p) => marcaDe(p.nombre, marcas)?.slug).filter(Boolean),
    );
    marcasPorCategoria.set(cat.slug, marcas.filter((m) => deCategoria.has(m.slug)));
  }

  return {
    c,
    categorias: categorias.filter((x) => !x.padre),
    marcas,
    marcasPorCategoria,
    sucursales,
    articulos: carrito?.articulos ?? 0,
  };
}

export type DatosDelSitio = Awaited<ReturnType<typeof datosDelSitio>>;

/** Enlace de WhatsApp (null si el número aún no es válido, p. ej. un [PENDIENTE]). */
export function enlaceWhatsapp(numero: string, mensaje: string): string | null {
  const digitos = numero.replace(/[^\d]/g, '');
  if (!/^\d{8,15}$/.test(digitos) || numero.includes('PENDIENTE')) return null;
  const texto = mensaje && !mensaje.includes('PENDIENTE') ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${digitos}${texto}`;
}
