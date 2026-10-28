// Orden (prompt de la tienda, corrección 7):
// 1. Las rutas propias del sitio, incluida su /tienda a la medida: nunca se reenvían.
// 2. reenviarTienda SOLO para /pagar…, /compra/… y /assets/tienda-app/…: la página de pago y la del pedido de la
//    plataforma, servidas en el dominio de Salazar con su marca.
// 3. next().
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { reenviarTienda, type Plataforma } from '@plataforma/sdk';
import { modo } from './lib/plataforma/cliente';

const REENVIADAS = /^\/(?:pagar(?:\/[^/]+)?|compra\/[^/]+(?:\/[^/]+)?|assets\/tienda-app\/[^/]+)$/;
const URL_PUBLICA = 'https://agencia-plataforma.herediadiego963.workers.dev';

/** En `astro dev` no hay service binding: se reenvía por la URL pública (la plataforma reconoce al cliente por la llave). */
const plataformaLocal: Plataforma = {
  fetch: (request) => {
    const url = new URL(request.url);
    return fetch(new Request(`${URL_PUBLICA}${url.pathname}${url.search}`, request));
  },
};

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  if (!REENVIADAS.test(url.pathname)) return next();

  if (import.meta.env.DEV && modo() === 'semilla') {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Pago (modo semilla)</title><body style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px">' +
        '<h1>Aquí va la página de pago de la plataforma</h1><p>En modo semilla no existe: /pagar y /compra/&lt;token&gt; los sirve la plataforma con la marca de Salazar cuando el sitio tiene su llave (Fase 3).</p>' +
        '<p><a href="/carrito">Volver al carrito</a></p></body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const respuesta = await reenviarTienda(request, {
    plataforma: import.meta.env.DEV ? plataformaLocal : env.PLATAFORMA,
    llave: env.PLATAFORMA_LLAVE,
  });
  return respuesta ?? next();
});
