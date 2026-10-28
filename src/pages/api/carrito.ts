// El ÚNICO lugar donde el navegador toca el carrito. Sin JavaScript: POST y vuelve a /carrito con 303. Con
// JavaScript (Accept: application/json): responde JSON con los artículos para refrescar el contador.
// Los precios y totales los calcula SIEMPRE la plataforma: aquí solo viajan variantes y cantidades.
import type { APIRoute } from 'astro';
import { ErrorApiPlataforma, type Carrito } from '@plataforma/sdk';
import { COOKIE_CARRITO, guardarAvisos, guardarToken } from '../../lib/tienda/carrito';
import { tienda } from '../../lib/tienda/fuente';

const ACCIONES = ['agregar', 'cantidad', 'quitar', 'codigo', 'sin-codigo'] as const;
type Accion = (typeof ACCIONES)[number];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const quiereJson = (request.headers.get('Accept') ?? '').includes('application/json');
  const responder = (cuerpo: { ok: boolean; articulos?: number; mensaje?: string; redirigir?: string }, destino = '/carrito') =>
    quiereJson ? Response.json(cuerpo, { status: cuerpo.ok || cuerpo.redirigir ? 200 : 422 }) : redirect(cuerpo.redirigir ?? destino, 303);

  const datos = await request.formData();
  const accion = String(datos.get('accion') ?? '') as Accion;
  if (!ACCIONES.includes(accion)) return responder({ ok: false, mensaje: 'Acción desconocida.' });
  let variante = String(datos.get('variante') ?? '');
  const cantidad = Math.max(0, Math.min(99, Math.trunc(Number(datos.get('cantidad') ?? 1)) || 0));
  const t = await tienda();

  // Desde una tarjeta llega el producto (el resumen no trae el id de la variante): se resuelve aquí.
  if (accion === 'agregar' && !variante) {
    const slug = String(datos.get('producto') ?? '');
    const producto = slug ? await t.producto(slug) : null;
    if (!producto) return responder({ ok: false, mensaje: 'Ese producto ya no está disponible.' });
    const disponibles = producto.variantes.filter((v) => !v.agotado);
    if (disponibles.length !== 1 || producto.opciones.length > 0) {
      return responder({ ok: false, redirigir: `/tienda/${producto.slug}` }); // hay que elegir presentación
    }
    variante = disponibles[0]!.id;
  }

  try {
    let token = cookies.get(COOKIE_CARRITO)?.value;
    let carrito: Carrito | null = token ? await t.verCarrito(token) : null;
    if (!carrito) carrito = await t.crearCarrito();
    token = carrito.token;

    if (accion === 'agregar') carrito = await t.agregarAlCarrito(token, variante, Math.max(1, cantidad));
    if (accion === 'cantidad') carrito = await t.cambiarCantidad(token, variante, cantidad);
    if (accion === 'quitar') carrito = await t.quitarDelCarrito(token, variante);
    if (accion === 'codigo') carrito = await t.aplicarCodigo(token, String(datos.get('codigo') ?? '').trim());
    if (accion === 'sin-codigo') carrito = await t.quitarCodigo(token);

    guardarToken(cookies, carrito.token);
    guardarAvisos(cookies, carrito.avisos);
    const mensaje = accion === 'agregar' ? (carrito.avisos[0] ?? 'Agregado al carrito.') : undefined;
    return responder({ ok: true, articulos: carrito.articulos, mensaje });
  } catch (e) {
    if (e instanceof ErrorApiPlataforma && e.status < 500) {
      return responder({ ok: false, mensaje: e.message });
    }
    console.error('carrito', e);
    return quiereJson
      ? Response.json({ ok: false, mensaje: 'No pudimos actualizar el carrito. Inténtalo de nuevo.' }, { status: 502 })
      : redirect('/carrito?error=1', 303);
  }
};
