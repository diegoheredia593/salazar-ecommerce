// Toda foto que sale al navegador pasa por aquí (incidente de Wellbusiness): por el binding, la plataforma puede armar
// los `src` con el host ficticio `agencia-plataforma`, que en el navegador sale roto. Desde el sprint 7a ya llegan con
// el host público, pero este es el único lugar donde se garantiza.
import type { Foto } from '@plataforma/sdk';

const HOST_FICTICIO = 'agencia-plataforma';
const ORIGEN_PUBLICO = 'https://portal.equatorial.dev';

export function urlPublicaDeMedio(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname !== HOST_FICTICIO) return src;
    return `${ORIGEN_PUBLICO}${url.pathname}${url.search}`;
  } catch {
    return src; // relativa (fotos de la semilla en astro dev)
  }
}

/** Una foto con todas sus URLs (la principal y las variantes) ya públicas. */
export function fotoPublica<T extends Pick<Foto, 'src' | 'variantes'>>(foto: T): T {
  return {
    ...foto,
    src: urlPublicaDeMedio(foto.src),
    variantes: (foto.variantes ?? []).map((v) => ({ ...v, src: urlPublicaDeMedio(v.src) })),
  };
}
