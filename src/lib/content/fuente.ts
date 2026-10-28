// Fuente de contenido (bloques y colecciones personalizadas), con dos modos detrás de la misma interfaz:
// - plataforma: /v1 con caché en memoria POR VERSIÓN (/v1/version cada 15 s como mucho); si la plataforma no
//   responde, sirve lo guardado. Los bloques se leen en una sola petición y las colecciones, todas sus páginas.
// - semilla: solo en `astro dev` sin llave; lee plataforma/ y devuelve la MISMA forma que /v1.
// Productos, precios y stock NO pasan por aquí: son de la Tienda (src/lib/tienda) y nunca se cachean por versión.
import type { Bloque, Cliente } from '@plataforma/sdk';
import { clientePlataforma, modo } from '../plataforma/cliente';
import type { ClaveColeccionSitio, ColeccionesSitio } from './colecciones.generado';

export type Bloques = Record<string, Bloque>;

export interface FuenteContenido {
  bloques(): Promise<Bloques>;
  coleccion<K extends ClaveColeccionSitio>(clave: K): Promise<ColeccionesSitio[K][]>;
}

const VERIFICAR_CADA_MS = 15_000;

interface Guardado<T> { version: number; valor: T }

const estado = {
  version: -1,
  verificadoEn: 0,
  bloques: undefined as Guardado<Bloques> | undefined,
  colecciones: new Map<string, Guardado<unknown[]>>(),
};

async function versionVigente(api: Cliente): Promise<number> {
  const ahora = Date.now();
  if (estado.version >= 0 && ahora - estado.verificadoEn < VERIFICAR_CADA_MS) return estado.version;
  try {
    estado.version = await api.version();
  } catch (e) {
    if (estado.version < 0) throw e; // nunca respondió: no hay nada que servir
  }
  estado.verificadoEn = ahora;
  return estado.version;
}

async function conCache<T>(guardado: Guardado<T> | undefined, version: number, leer: () => Promise<T>): Promise<Guardado<T>> {
  if (guardado?.version === version) return guardado;
  try {
    return { version, valor: await leer() };
  } catch (e) {
    if (guardado) return guardado; // la plataforma no responde: lo de la versión anterior
    throw e;
  }
}

async function todasLasPaginas<T>(api: Cliente, clave: string): Promise<T[]> {
  const elementos: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await api.coleccion<T & { id: string; slug: string | null; orden: number; creadoEn: string; actualizadoEn: string }>(
      clave,
      { pagina, porPagina: 100 },
    );
    elementos.push(...r.elementos);
    if (r.paginaActual >= r.totalPaginas) return elementos;
  }
}

const fuentePlataforma: FuenteContenido = {
  async bloques() {
    const api = clientePlataforma();
    const version = await versionVigente(api);
    estado.bloques = await conCache(estado.bloques, version, () => api.bloques());
    return estado.bloques.valor;
  },
  async coleccion(clave) {
    const api = clientePlataforma();
    const version = await versionVigente(api);
    const guardado = await conCache(estado.colecciones.get(clave), version, () => todasLasPaginas(api, clave));
    estado.colecciones.set(clave, guardado);
    return guardado.valor as never;
  },
};

export async function fuente(): Promise<FuenteContenido> {
  // import.meta.env.DEV es una constante: en el build de producción esta rama (y la semilla) desaparece.
  if (import.meta.env.DEV && modo() === 'semilla') return (await import('./semilla')).fuenteSemilla;
  modo(); // sin llave en producción: error claro
  return fuentePlataforma;
}
