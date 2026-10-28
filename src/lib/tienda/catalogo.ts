// Lo que la API de la Tienda no hace y resuelve el servidor del sitio: marca (D1), destacados, filtros de precio y
// oferta, orden, y las especificaciones mientras /v1 no las entregue. Ver REPORTE-PLATAFORMA.md.
import type { CategoriaTienda, ProductoResumen } from '@plataforma/sdk';
import type { ElementoMarcas } from '../content/colecciones.generado';
import type { FuenteTienda } from './fuente';

/** Caché corta del catálogo completo, por isolate. Separada de la caché por versión del contenido (nunca se mezclan). */
const CATALOGO_MS = 60_000;
let catalogo: { leidoEn: number; productos: ProductoResumen[] } | undefined;

/** Todos los productos publicados (la API entrega hasta 100 por página). */
export async function todosLosProductos(t: FuenteTienda): Promise<ProductoResumen[]> {
  if (catalogo && Date.now() - catalogo.leidoEn < CATALOGO_MS) return catalogo.productos;
  const productos: ProductoResumen[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await t.productos({ pagina, porPagina: 100 });
    productos.push(...r.productos);
    if (pagina * r.porPagina >= r.total || r.productos.length === 0) break;
  }
  catalogo = { leidoEn: Date.now(), productos };
  return productos;
}

let categorias: { leidoEn: number; lista: CategoriaTienda[] } | undefined;

/** Las categorías, con la misma caché corta (el menú las pide en cada página). */
export async function categoriasTienda(t: FuenteTienda): Promise<CategoriaTienda[]> {
  if (categorias && Date.now() - categorias.leidoEn < CATALOGO_MS) return categorias.lista;
  categorias = { leidoEn: Date.now(), lista: await t.categorias() };
  return categorias.lista;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * D1: la Tienda no tiene campo «marca». Un producto es de la marca cuyo `nombreEnProductos` aparece en su nombre como
 * palabra completa («LG» no calza con «LGBT»). Es el único lugar donde se decide la marca: cuando la plataforma tenga
 * el campo, se cambia solo esta función.
 */
export function marcaDe<M extends Pick<ElementoMarcas, 'nombreEnProductos'>>(nombreProducto: string, marcas: M[]): M | null {
  const nombre = normalizar(nombreProducto);
  return (
    marcas.find((m) => {
      const palabra = normalizar(m.nombreEnProductos.trim());
      return palabra && new RegExp(`(^|[^a-z0-9+])${escapar(palabra)}($|[^a-z0-9+])`).test(nombre);
    }) ?? null
  );
}

export const enOferta = (p: Pick<ProductoResumen, 'descuento' | 'precioAnterior'>) => Boolean(p.descuento || p.precioAnterior);

export type Orden = 'destacados' | 'menor' | 'mayor';
export const ORDENES: Orden[] = ['destacados', 'menor', 'mayor'];

export interface Filtros {
  categoria?: string | undefined;
  marca?: string | undefined; // slug de la colección marcas
  min?: number | undefined; // centavos
  max?: number | undefined;
  oferta?: boolean | undefined;
  orden?: Orden | undefined;
}

/** Lee los filtros de la URL (?categoria=&marca=&min=&max=&oferta=1&orden=). Precios en dólares en la URL. */
export function filtrosDeUrl(url: URL): Filtros {
  const q = url.searchParams;
  const dolares = (k: string) => {
    const n = Number(q.get(k));
    return q.get(k) && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  };
  const orden = q.get('orden') as Orden | null;
  return {
    categoria: q.get('categoria') || undefined,
    marca: q.get('marca') || undefined,
    min: dolares('min'),
    max: dolares('max'),
    oferta: q.get('oferta') === '1',
    orden: orden && ORDENES.includes(orden) ? orden : undefined,
  };
}

export function filtrar<M extends Pick<ElementoMarcas, 'slug' | 'nombreEnProductos'>>(
  productos: ProductoResumen[],
  f: Filtros,
  marcas: M[],
): ProductoResumen[] {
  const lista = productos.filter((p) => {
    if (f.categoria && p.categoria?.slug !== f.categoria) return false;
    if (f.marca && marcaDe(p.nombre, marcas)?.slug !== f.marca) return false;
    if (f.min !== undefined && p.precioConDescuento.hasta < f.min) return false;
    if (f.max !== undefined && p.precioConDescuento.desde > f.max) return false;
    if (f.oferta && !enOferta(p)) return false;
    return true;
  });
  return ordenar(lista, f.orden ?? 'destacados');
}

export function ordenar(productos: ProductoResumen[], orden: Orden): ProductoResumen[] {
  const lista = [...productos];
  // Los agotados siempre al final: se ven, pero no estorban.
  const agotado = (p: ProductoResumen) => (p.agotado ? 1 : 0);
  if (orden === 'menor') lista.sort((a, b) => agotado(a) - agotado(b) || a.precioConDescuento.desde - b.precioConDescuento.desde);
  else if (orden === 'mayor') lista.sort((a, b) => agotado(a) - agotado(b) || b.precioConDescuento.desde - a.precioConDescuento.desde);
  else lista.sort((a, b) => agotado(a) - agotado(b) || Number(b.destacado) - Number(a.destacado));
  return lista;
}

/**
 * La descripción de un producto, separada en especificaciones (líneas «Nombre: valor», ver npm run catalogo) y
 * párrafos de texto libre. Si el cliente escribe texto sin ese formato, todo queda como párrafos.
 */
export function leerDescripcion(descripcion: string | null): { especificaciones: { nombre: string; valor: string }[]; parrafos: string[] } {
  const especificaciones: { nombre: string; valor: string }[] = [];
  const parrafos: string[] = [];
  for (const bloque of (descripcion ?? '').split(/\n\s*\n/)) {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    const pares = lineas.map((l) => /^([^:]{1,40}):\s+(.+)$/.exec(l));
    if (lineas.length && pares.every(Boolean)) {
      for (const m of pares) especificaciones.push({ nombre: m![1]!.trim(), valor: m![2]!.trim() });
    } else if (lineas.length) parrafos.push(lineas.join(' '));
  }
  return { especificaciones, parrafos };
}

/** El precio que se muestra en una tarjeta: «Desde» solo si las variantes tienen precios distintos. */
export function precioDeTarjeta(p: Pick<ProductoResumen, 'precioConDescuento' | 'precio' | 'precioAnterior' | 'descuento'>) {
  return {
    desde: p.precioConDescuento.desde !== p.precioConDescuento.hasta,
    actual: p.precioConDescuento.desde,
    // Tachado: el precio anterior, o el precio sin el descuento automático.
    tachado: p.precioAnterior ?? (p.descuento ? p.precio.desde : null),
  };
}
