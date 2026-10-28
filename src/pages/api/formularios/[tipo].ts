// Recibe los formularios del sitio y los reenvía a la plataforma (como api.md y Fluvida). Se queda en el sitio:
// el Origin, el señuelo y Turnstile (opcional). La llave nunca llega al navegador.
// Sin JavaScript: vuelve a la página con ?formulario=<tipo>&estado=ok|error|limite (303).
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ErrorApiPlataforma } from '@plataforma/sdk';
import { clientePlataforma, modo } from '../../../lib/plataforma/cliente';

const TECNICOS = new Set(['sitioWeb', 'cf-turnstile-response']);

interface Resultado { status: number; ok: boolean; errores?: { campo: string; mensaje: string }[]; mensaje?: string; reintentar?: number }

async function turnstileValido(token: string, ip: string | undefined): Promise<boolean> {
  const secreto = String(env.TURNSTILE_SECRET ?? '');
  if (!secreto) return true; // desactivado
  const cuerpo = new FormData();
  cuerpo.set('secret', secreto);
  cuerpo.set('response', token);
  if (ip) cuerpo.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: cuerpo });
  return ((await r.json()) as { success?: boolean }).success === true;
}

/** Modo semilla (solo astro dev): valida con el MISMO validador de la plataforma y no envía nada. */
async function enviarEnSemilla(tipo: string, datos: Record<string, string>): Promise<Resultado> {
  const definiciones = import.meta.glob<unknown>('/plataforma/formularios/*.json', { eager: true, import: 'default' });
  const { parseFormDefinition, validateFormSubmission } = await import('../../../../vendor/plataforma/core/src/forms');
  const def = definiciones[`/plataforma/formularios/${tipo}.json`];
  const parsed = def ? parseFormDefinition(def) : null;
  if (!parsed?.ok) return { status: 404, ok: false, mensaje: 'Este formulario no existe.' };
  const v = validateFormSubmission(parsed.definition, datos);
  if (!v.ok) return { status: 422, ok: false, errores: v.errors.map((e) => ({ campo: e.field, mensaje: e.message })), mensaje: 'Revisa los campos del formulario.' };
  console.info(`[semilla] formulario «${tipo}» recibido (no se envía a la plataforma):`, v.data);
  return { status: 201, ok: true };
}

export const POST: APIRoute = async ({ request, params, redirect }) => {
  const tipo = String(params.tipo ?? '');
  const quiereJson = (request.headers.get('Accept') ?? '').includes('application/json');
  const origen = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origen) return Response.json({ ok: false }, { status: 403 });

  const referente = request.headers.get('Referer');
  const pagina = referente && referente.startsWith(origen) ? new URL(referente).pathname : '/';
  const responder = (r: Resultado) => {
    if (quiereJson) {
      return Response.json(
        { ok: r.ok, errores: r.errores ?? [], mensaje: r.mensaje },
        { status: r.status, headers: r.reintentar ? { 'Retry-After': String(r.reintentar) } : {} },
      );
    }
    const estado = r.ok ? 'ok' : r.status === 429 ? 'limite' : 'error';
    return redirect(`${pagina}?formulario=${encodeURIComponent(tipo)}&estado=${estado}#formulario-${tipo}`, 303);
  };

  const form = await request.formData();
  if (form.get('sitioWeb')) return responder({ status: 201, ok: true }); // señuelo: fingir éxito

  const ip = request.headers.get('cf-connecting-ip') ?? undefined;
  if (!(await turnstileValido(String(form.get('cf-turnstile-response') ?? ''), ip))) {
    return responder({ status: 422, ok: false, mensaje: 'No pudimos comprobar que no eres un robot. Inténtalo de nuevo.' });
  }

  const datos = Object.fromEntries([...form].filter(([k]) => !TECNICOS.has(k)).map(([k, v]) => [k, String(v)]));

  if (import.meta.env.DEV && modo() === 'semilla') return responder(await enviarEnSemilla(tipo, datos));

  try {
    await clientePlataforma().enviarFormulario(tipo, datos, { ip, pagina });
    return responder({ status: 201, ok: true });
  } catch (e) {
    if (e instanceof ErrorApiPlataforma) {
      if (e.status === 422) return responder({ status: 422, ok: false, errores: e.errores, mensaje: 'Revisa los campos del formulario.' });
      if (e.status === 429) {
        return responder({
          status: 429, ok: false, reintentar: e.reintentarEnSegundos,
          mensaje: 'Enviaste varios mensajes seguidos. Espera unos minutos e inténtalo de nuevo.',
        });
      }
    }
    console.error('formulario', tipo, e);
    return responder({ status: 502, ok: false, mensaje: 'No se pudo enviar. Inténtalo de nuevo en un momento.' });
  }
};
