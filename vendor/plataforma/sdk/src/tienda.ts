/**
 * Tienda (sprint 13a): tipos de /v1/tienda/* y los ayudantes que no son llamadas a la API. La vitrina (catálogo,
 * producto y carrito) la arma el sitio con `crearCliente(...)`; el pago (`/pagar`) y la página del pedido
 * (`/compra/<token>`) son de la plataforma, con la marca del cliente, y se sirven en el dominio del sitio con
 * `reenviarTienda`. Ver docs/tienda-en-sitios.md.
 *
 * Todos los montos van en CENTAVOS (enteros): 950 = $9,50. Los precios ya incluyen el IVA.
 */

/** Una foto del catálogo con sus tamaños (para `srcset`), de menor a mayor. */
export interface FotoTienda {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  variantes: { src: string; width: number; height: number }[];
}

export interface CategoriaTienda {
  id: string;
  slug: string;
  nombre: string;
  /** Slug de la categoría padre (hasta dos niveles), o null si es de primer nivel. */
  padre: string | null;
  /** Productos publicados en la categoría (una categoría padre cuenta también los de sus subcategorías). */
  productos: number;
}

/** El descuento automático que se aplica (la etiqueta es «−15 %» o «−$3,00»). */
export interface DescuentoAplicado {
  nombre: string;
  etiqueta: string;
}

/** Un producto en una lista (GET /v1/tienda/productos). */
export interface ProductoResumen {
  id: string;
  slug: string;
  nombre: string;
  descripcionCorta: string | null;
  categoria: { slug: string; nombre: string } | null;
  destacado: boolean;
  foto: FotoTienda | null;
  /** Rango de precios de sus variantes (iguales si hay un solo precio). */
  precio: { desde: number; hasta: number };
  /** El mismo rango con el descuento automático vigente (igual a `precio` si no hay). */
  precioConDescuento: { desde: number; hasta: number };
  /** El «precio anterior» más alto (se muestra tachado), o null. */
  precioAnterior: number | null;
  descuento: DescuentoAplicado | null;
  /** Cuántas variantes tiene. */
  variantes: number;
  /** Todas sus variantes sin stock disponible. */
  agotado: boolean;
}

export interface VarianteTienda {
  /** El id que se manda al carrito. */
  id: string;
  /** Un valor por opción, en el orden de `opciones` («Molido», «500 g»). */
  opciones: string[];
  /** «Molido · 500 g» (vacío si el producto no tiene opciones). */
  etiqueta: string;
  sku: string | null;
  precio: number;
  precioAnterior: number | null;
  precioConDescuento: number;
  descuento: DescuentoAplicado | null;
  /** Stock disponible (lo reservado por pedidos sin pagar ya está restado). */
  disponible: number;
  agotado: boolean;
}

/** Un producto con todo (GET /v1/tienda/productos/:slug). */
export interface ProductoTienda extends Omit<ProductoResumen, 'variantes'> {
  descripcion: string | null;
  fotos: FotoTienda[];
  opciones: { nombre: string; valores: string[] }[];
  variantes: VarianteTienda[];
  necesitaEnvio: boolean;
}

export interface PaginaDeProductos {
  productos: ProductoResumen[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface OpcionesProductos {
  /** Slug de la categoría. */
  categoria?: string | undefined;
  /** Busca en el nombre y la descripción corta. */
  buscar?: string | undefined;
  pagina?: number | undefined;
  /** Hasta 100 (por defecto 24). */
  porPagina?: number | undefined;
}

export interface LineaCarrito {
  variante: string;
  producto: { id: string; slug: string; nombre: string };
  etiqueta: string;
  foto: FotoTienda | null;
  cantidad: number;
  /** Stock disponible de la variante (la cantidad ya se ajustó si había menos). */
  disponible: number;
  precioUnitario: number;
  precioAnterior: number | null;
  /** precioUnitario × cantidad. */
  subtotal: number;
  /** Descuento automático + el del código en esta línea. */
  descuento: number;
  total: number;
}

/**
 * El carrito, con los totales calculados SIEMPRE en el servidor. `avisos` explica lo que cambió solo («Ya no hay
 * stock de…», «El código X venció»): muéstralos. El envío se calcula en el pago, con la dirección.
 */
export interface Carrito {
  /** Guárdalo donde quieras (cookie del sitio, sesión…): la plataforma no pone cookies. Vence a los 30 días. */
  token: string;
  lineas: LineaCarrito[];
  codigo: { codigo: string; etiqueta: string; aplicado: boolean } | null;
  totales: { subtotal: number; descuentoAutomatico: number; descuentoCodigo: number; total: number };
  articulos: number;
  avisos: string[];
  /** URL absoluta del pago (en el dominio de la tienda). */
  urlPago: string;
}

/** Lo mínimo de un service binding de Cloudflare (`env.PLATAFORMA`). */
export interface Plataforma {
  fetch(request: Request): Promise<Response>;
}

export interface OpcionesReenvio {
  /** El service binding al Worker de la plataforma. */
  plataforma: Plataforma;
  /** La llave del sitio (pk_...) con el alcance `tienda:carrito`. Del entorno, nunca en el código. */
  llave: string;
}

/** Las rutas que el sitio reenvía (y nada más): la vitrina básica, el pago, el pedido y sus recursos. */
const RUTAS_TIENDA =
  /^\/(?:tienda(?:\/[^/]+){0,2}|pagar(?:\/[^/]+)?|compra\/[^/]+(?:\/[^/]+)?|assets\/tienda-app\/[^/]+)$/;

/** ¿Esta ruta es de la tienda de la plataforma (`/tienda…`, `/pagar…`, `/compra/…` o sus recursos)? */
export const esRutaDeTienda = (ruta: string): boolean => RUTAS_TIENDA.test(ruta);

/**
 * Para el Worker del sitio: si la petición es de la tienda (`/tienda…`, `/pagar…`, `/compra/…` o
 * `/assets/tienda-app/…`), la reenvía tal cual a la plataforma por el service binding, con la llave del sitio, y devuelve su respuesta; si no, null (el
 * sitio sigue con lo suyo). La URL no cambia: la página, sus formularios y sus recursos quedan en el dominio del
 * cliente. Sin una llave válida la plataforma responde 401.
 *
 *   const respuesta = await reenviarTienda(request, { plataforma: env.PLATAFORMA, llave: env.PLATAFORMA_LLAVE });
 *   if (respuesta) return respuesta;
 */
export async function reenviarTienda(request: Request, opciones: OpcionesReenvio): Promise<Response | null> {
  const url = new URL(request.url);
  if (!esRutaDeTienda(url.pathname)) return null;
  const headers = new Headers(request.headers);
  headers.set('X-Plataforma-Reenvio', 'tienda');
  headers.set('Authorization', `Bearer ${opciones.llave}`);
  // Las cookies del sitio no son de la plataforma: no viajan.
  headers.delete('Cookie');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return opciones.plataforma.fetch(
    new Request(url.toString(), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : null,
      redirect: 'manual',
    }),
  );
}

/**
 * La URL del pago de un carrito. Con `origen` (p. ej. `https://cumbrecafe.ec`) es absoluta; sin él, relativa al sitio
 * (`/pagar?carrito=…`), que es lo que conviene cuando el sitio reenvía el pago. El carrito también trae `urlPago`.
 */
export function urlDePago(token: string, origen = ''): string {
  return `${origen.replace(/\/+$/, '')}/pagar?carrito=${encodeURIComponent(token)}`;
}

/** Alias en inglés de `urlDePago` (el nombre que usa la documentación del sprint). */
export const checkoutUrl = urlDePago;

/** 950 → «$9,50» (para mostrar los centavos de la API). */
export function formatearPrecio(centavos: number): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(centavos / 100);
}
