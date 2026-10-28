// El carrito vive en la plataforma; el sitio solo guarda su token en una cookie propia HttpOnly (la plataforma no pone
// cookies). /api/carrito es el ÚNICO lugar donde el navegador toca el carrito.
import type { AstroCookies } from 'astro';

export const COOKIE_CARRITO = 'carrito';
const TREINTA_DIAS = 30 * 86_400;

/**
 * Los avisos que devuelve una acción («Solo quedan 2…», «El código X no existe») viajan a /carrito en una cookie de un
 * solo uso: sin ella se perderían en la redirección 303 (un código inválido no queda guardado en el carrito).
 */
const COOKIE_AVISOS = 'carrito-avisos';

export function guardarAvisos(cookies: AstroCookies, avisos: string[]) {
  if (!avisos.length) return;
  cookies.set(COOKIE_AVISOS, JSON.stringify(avisos.slice(0, 5)), {
    path: '/', httpOnly: true, secure: !import.meta.env.DEV, sameSite: 'lax', maxAge: 120,
  });
}

/** Los avisos pendientes (y se borran), junto con los que trae el carrito, sin repetir. */
export function tomarAvisos(cookies: AstroCookies, delCarrito: string[]): string[] {
  let pendientes: string[] = [];
  try {
    pendientes = JSON.parse(cookies.get(COOKIE_AVISOS)?.value ?? '[]') as string[];
  } catch {
    pendientes = [];
  }
  if (cookies.has(COOKIE_AVISOS)) cookies.delete(COOKIE_AVISOS, { path: '/' });
  return [...new Set([...pendientes.filter((a) => typeof a === 'string'), ...delCarrito])];
}

export function guardarToken(cookies: AstroCookies, token: string) {
  cookies.set(COOKIE_CARRITO, token, {
    path: '/',
    httpOnly: true,
    // En astro dev (http://localhost) una cookie Secure no se guardaría en todos los navegadores.
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    maxAge: TREINTA_DIAS,
  });
}
