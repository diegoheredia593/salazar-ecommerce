// La Tienda en modo semilla (solo `astro dev` sin llave): desarrollo/tienda-semilla.json con los MISMOS tipos que el
// SDK (ProductoResumen, ProductoTienda, Carrito). El carrito vive en memoria del servidor de desarrollo. Replica las
// reglas que la interfaz tiene que mostrar: avisos de stock, código que no existe, compra mínima y «se aplica el
// mayor» entre el descuento automático y el código. Solo se importa desde la rama DEV de fuente.ts.
import type {
  Carrito, CategoriaTienda, DescuentoAplicado, LineaCarrito, PaginaDeProductos, ProductoResumen, ProductoTienda, VarianteTienda,
} from '@plataforma/sdk';
import { formatearPrecio } from '@plataforma/sdk';
import datos from '../../../desarrollo/tienda-semilla.json';
import marcasSemilla from '../../../plataforma/semilla/marcas.json';
import { marcaDe } from './catalogo';
import type { FuenteTienda } from './fuente';

interface ProductoSemilla {
  slug: string; nombre: string; sku: string; categoria: string; detalle: string;
  precio: number; stock: number; destacado: boolean; descuentoPorcentaje?: number;
}

const productos = datos.productos as ProductoSemilla[];
const marcas = marcasSemilla.map((m) => m.datos);
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const idVariante = (p: ProductoSemilla) => `var-${p.slug}`;
const descuentoDe = (p: ProductoSemilla): DescuentoAplicado | null =>
  p.descuentoPorcentaje ? { nombre: 'Descuento de prueba', etiqueta: `−${p.descuentoPorcentaje} %` } : null;
const conDescuento = (p: ProductoSemilla) => Math.round(p.precio * (1 - (p.descuentoPorcentaje ?? 0) / 100));
const categoriaDe = (p: ProductoSemilla) => {
  const c = datos.categorias.find((x) => x.slug === p.categoria)!;
  return { slug: c.slug, nombre: c.nombre };
};

function resumen(p: ProductoSemilla): ProductoResumen {
  return {
    id: `prod-${p.slug}`, slug: p.slug, nombre: p.nombre, descripcionCorta: p.detalle || null,
    categoria: categoriaDe(p), destacado: p.destacado, foto: null,
    precio: { desde: p.precio, hasta: p.precio },
    precioConDescuento: { desde: conDescuento(p), hasta: conDescuento(p) },
    precioAnterior: null, descuento: descuentoDe(p), variantes: 1, agotado: p.stock <= 0,
  };
}

function variante(p: ProductoSemilla): VarianteTienda {
  return {
    id: idVariante(p), opciones: [], etiqueta: '', sku: p.sku, precio: p.precio, precioAnterior: null,
    precioConDescuento: conDescuento(p), descuento: descuentoDe(p), disponible: Math.max(0, p.stock), agotado: p.stock <= 0,
  };
}

function completo(p: ProductoSemilla): ProductoTienda {
  // La misma descripción que genera npm run catalogo: una especificación por línea.
  const descripcion = [
    `Marca: ${marcaDe(p.nombre, marcas)?.nombre ?? '[PENDIENTE: marca]'}`,
    `Modelo: ${p.sku}`,
    ...(p.detalle ? [`Características: ${p.detalle}`] : []),
    'Garantía: [PENDIENTE: garantía]',
  ].join('\n');
  const { variantes: _cantidad, ...base } = resumen(p);
  return { ...base, descripcion, fotos: [], opciones: [], variantes: [variante(p)], necesitaEnvio: true };
}

// ─── Carrito ─────────────────────────────────────────────────────────────

interface CarritoGuardado { lineas: Map<string, number>; codigo: string | null; avisos: string[] }
const carritos = new Map<string, CarritoGuardado>();

function armar(token: string, c: CarritoGuardado): Carrito {
  const avisos = [...c.avisos];
  c.avisos = [];
  const lineas: LineaCarrito[] = [];
  for (const [id, cantidadPedida] of c.lineas) {
    const p = productos.find((x) => idVariante(x) === id);
    if (!p) { c.lineas.delete(id); continue; }
    if (p.stock <= 0) {
      avisos.push(`Ya no hay stock de ${p.nombre}.`);
      c.lineas.delete(id);
      continue;
    }
    let cantidad = cantidadPedida;
    if (cantidad > p.stock) {
      avisos.push(`Solo quedan ${p.stock} de ${p.nombre}.`);
      cantidad = p.stock;
      c.lineas.set(id, cantidad);
    }
    const subtotal = p.precio * cantidad;
    lineas.push({
      variante: id, producto: { id: `prod-${p.slug}`, slug: p.slug, nombre: p.nombre }, etiqueta: '', foto: null,
      cantidad, disponible: p.stock, precioUnitario: p.precio, precioAnterior: null, subtotal,
      descuento: subtotal - conDescuento(p) * cantidad, total: conDescuento(p) * cantidad,
    });
  }
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  let descuentoAutomatico = lineas.reduce((s, l) => s + l.descuento, 0);
  let descuentoCodigo = 0;
  let codigo: Carrito['codigo'] = null;
  if (c.codigo) {
    const def = datos.codigos.find((x) => x.codigo === c.codigo)!;
    const etiqueta = `−${def.porcentaje} %`;
    if (subtotal < def.compraMinima) {
      avisos.push(`Agrega ${formatearPrecio(def.compraMinima - subtotal)} más para usar ${def.codigo}.`);
      codigo = { codigo: def.codigo, etiqueta, aplicado: false };
    } else {
      const delCodigo = Math.round((subtotal * def.porcentaje) / 100);
      // Se aplica el mayor entre el descuento automático y el código.
      if (delCodigo > descuentoAutomatico) {
        descuentoCodigo = delCodigo;
        descuentoAutomatico = 0;
        for (const l of lineas) {
          const parte = Math.round((l.subtotal * def.porcentaje) / 100);
          l.descuento = parte;
          l.total = l.subtotal - parte;
        }
        codigo = { codigo: def.codigo, etiqueta, aplicado: true };
      } else {
        avisos.push(`El descuento automático es mayor que ${def.codigo}: se aplica el automático.`);
        codigo = { codigo: def.codigo, etiqueta, aplicado: false };
      }
    }
  }
  return {
    token, lineas, codigo,
    totales: { subtotal, descuentoAutomatico, descuentoCodigo, total: subtotal - descuentoAutomatico - descuentoCodigo },
    articulos: lineas.reduce((s, l) => s + l.cantidad, 0),
    avisos,
    urlPago: `http://localhost:4321/pagar?carrito=${encodeURIComponent(token)}`,
  };
}

function guardado(token: string): CarritoGuardado {
  const c = carritos.get(token);
  if (!c) throw new Error('El carrito no existe o venció.');
  return c;
}

export const tiendaSemilla: FuenteTienda = {
  async categorias(): Promise<CategoriaTienda[]> {
    return datos.categorias.map((c) => ({
      id: `cat-${c.slug}`, slug: c.slug, nombre: c.nombre, padre: null,
      productos: productos.filter((p) => p.categoria === c.slug).length,
    }));
  },
  async productos(o = {}): Promise<PaginaDeProductos> {
    const porPagina = Math.min(o.porPagina ?? 24, 100);
    const pagina = o.pagina ?? 1;
    const buscar = o.buscar ? normalizar(o.buscar) : '';
    const lista = productos
      .filter((p) => !o.categoria || p.categoria === o.categoria)
      .filter((p) => !buscar || normalizar(`${p.nombre} ${p.detalle}`).includes(buscar))
      .map(resumen);
    return { productos: lista.slice((pagina - 1) * porPagina, pagina * porPagina), total: lista.length, pagina, porPagina };
  },
  async producto(slug) {
    const p = productos.find((x) => x.slug === slug);
    return p ? completo(p) : null;
  },
  async crearCarrito(lineas = []) {
    const token = crypto.randomUUID();
    carritos.set(token, { lineas: new Map(lineas.map((l) => [l.variante, l.cantidad])), codigo: null, avisos: [] });
    return armar(token, guardado(token));
  },
  async verCarrito(token) {
    const c = carritos.get(token);
    return c ? armar(token, c) : null;
  },
  async agregarAlCarrito(token, varianteId, cantidad = 1) {
    const c = guardado(token);
    c.lineas.set(varianteId, Math.min(99, (c.lineas.get(varianteId) ?? 0) + cantidad));
    return armar(token, c);
  },
  async cambiarCantidad(token, varianteId, cantidad) {
    const c = guardado(token);
    if (cantidad <= 0) c.lineas.delete(varianteId);
    else c.lineas.set(varianteId, Math.min(99, cantidad));
    return armar(token, c);
  },
  async quitarDelCarrito(token, varianteId) {
    const c = guardado(token);
    c.lineas.delete(varianteId);
    return armar(token, c);
  },
  async aplicarCodigo(token, texto) {
    const c = guardado(token);
    const limpio = texto.trim().toUpperCase();
    if (datos.codigos.some((x) => x.codigo === limpio)) c.codigo = limpio;
    else {
      c.codigo = null;
      c.avisos.push(`El código ${limpio || '(vacío)'} no existe.`);
    }
    return armar(token, c);
  },
  async quitarCodigo(token) {
    const c = guardado(token);
    c.codigo = null;
    return armar(token, c);
  },
};
