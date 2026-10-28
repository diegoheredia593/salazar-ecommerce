// Visitas sin cookies (api.md, «Visitas»): el navegador avisa con sendBeacon (scriptVisitas en el layout) y este
// endpoint reenvía a la plataforma sin hacer esperar al visitante. Siempre 202: el navegador no necesita saber más.
import type { APIRoute } from 'astro';
import type { DatosVisita } from '@plataforma/sdk';
import { clientePlataforma, modo } from '../../lib/plataforma/cliente';

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export const POST: APIRoute = async ({ request, locals }) => {
  const aceptada = () => new Response(null, { status: 202 });
  if (import.meta.env.DEV && modo() === 'semilla') return aceptada();

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return aceptada();
  }
  const utm = (cuerpo.utm ?? {}) as Record<string, unknown>;
  const datos: DatosVisita = {
    pagina: texto(cuerpo.pagina, 300) ?? '/',
    referente: texto(cuerpo.referente, 300),
    utm: { source: texto(utm.source, 100), medium: texto(utm.medium, 100), campaign: texto(utm.campaign, 100) },
    anchoPantalla: typeof cuerpo.anchoPantalla === 'number' ? cuerpo.anchoPantalla : undefined,
    sitio: new URL(request.url).hostname,
  };
  const cf = (request as Request & { cf?: { country?: string; city?: string } }).cf;
  locals.cfContext.waitUntil(
    clientePlataforma()
      .registrarVisita(datos, {
        ip: request.headers.get('cf-connecting-ip') ?? undefined,
        ua: request.headers.get('user-agent') ?? undefined,
        country: cf?.country,
        city: cf?.city,
      })
      .catch((e: unknown) => console.error('visita', e)),
  );
  return aceptada();
};
