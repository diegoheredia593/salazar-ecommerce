// El cliente de la plataforma: por service binding en producción y por la URL pública en `astro dev` (como Fluvida).
// La llave vive solo aquí, en el servidor: el navegador nunca habla con /v1 (no hay CORS, a propósito).
import { env } from 'cloudflare:workers';
import { crearCliente, type Cliente } from '@plataforma/sdk';

// Base `/v1` a secas, como api.md: el cliente sale de la llave. Bajo `/c/salazar-home/v1` las listas funcionan, pero
// los endpoints de detalle (/tienda/productos/<slug>, /colecciones/<x>/<slug>) responden 404 (probado el 28-oct-2026).
/** Por el binding el host es ficticio: lo que cuenta es la llave. */
const URL_BINDING = 'https://agencia-plataforma/v1';
const URL_PUBLICA = 'https://agencia-plataforma.herediadiego963.workers.dev/v1';

export type Modo = 'plataforma' | 'semilla';

/**
 * `semilla` solo en `astro dev` con FUENTE=semilla (lee plataforma/ y desarrollo/). En producción, sin llave, el sitio
 * falla con un error claro: nunca cae a la semilla.
 */
export function modo(): Modo {
  if (import.meta.env.DEV && env.FUENTE === 'semilla') return 'semilla';
  if (!env.PLATAFORMA_LLAVE) {
    throw new Error(
      'Falta PLATAFORMA_LLAVE. En local, ponla en .dev.vars (o usa FUENTE=semilla); en producción, `wrangler secret put PLATAFORMA_LLAVE`.',
    );
  }
  return 'plataforma';
}

let cliente: Cliente | undefined;

export function clientePlataforma(): Cliente {
  cliente ??= import.meta.env.DEV
    ? crearCliente({ url: URL_PUBLICA, llave: env.PLATAFORMA_LLAVE })
    : crearCliente({
        url: URL_BINDING,
        llave: env.PLATAFORMA_LLAVE,
        fetch: ((entrada: RequestInfo | URL, init?: RequestInit) =>
          env.PLATAFORMA.fetch(new Request(entrada, init))) as typeof fetch,
      });
  return cliente;
}
