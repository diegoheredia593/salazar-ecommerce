// Modo semilla (solo `astro dev` sin llave): lee plataforma/ y entrega EXACTAMENTE la forma de /v1. Solo elementos
// visibles, en el orden de la definición, texto enriquecido como JSON y fotos servidas por Vite en desarrollo.
// Este archivo solo se importa desde la rama `import.meta.env.DEV` de fuente.ts: no llega al build de producción.
import type { Bloque } from '@plataforma/sdk';
import type { Bloques, FuenteContenido } from './fuente';
import { aTextoEnriquecido } from './textoPlano';

interface BloqueModelo { key: string; page: string; section: string; control: string; value: unknown }
interface Campo { name: string; control: string }
interface Definicion { key: string; sortBy?: 'order' | { field: string; direction?: 'asc' | 'desc' }; fields: Campo[] }
interface ElementoModelo { idOrigen: string; slug: string | null; estado: string; orden: number; datos: Record<string, unknown> }

const archivos = import.meta.glob<unknown>('/plataforma/**/*.json', { eager: true, import: 'default' });
const fotos = import.meta.glob<string>('/plataforma/fotos/**/*', { eager: true, query: '?url', import: 'default' });

const bloquesModelo = archivos['/plataforma/bloques.json'] as BloqueModelo[];
const definicion = (clave: string) => archivos[`/plataforma/colecciones/${clave}.json`] as Definicion | undefined;
const semilla = (clave: string) => (archivos[`/plataforma/semilla/${clave}.json`] as ElementoModelo[] | undefined) ?? [];

/** Una foto del modelo ({ src: "/fotos/…" }) como la entrega /v1: URL servible y `variantes` vacío. */
function conFotosServibles(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(conFotosServibles);
  if (valor && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    if (typeof obj.src === 'string' && 'alt' in obj) {
      return { ...obj, src: fotos[`/plataforma${obj.src}`] ?? obj.src, variantes: [] };
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, conFotosServibles(v)]));
  }
  return valor;
}

const CREADO = '2026-10-28T00:00:00.000Z';

export const fuenteSemilla: FuenteContenido = {
  async bloques() {
    const bloques: Bloques = {};
    for (const b of bloquesModelo) {
      const valor = b.control === 'rich' && typeof b.value === 'string' ? aTextoEnriquecido(b.value) : b.value;
      bloques[b.key] = { pagina: b.page, seccion: b.section, valor: conFotosServibles(valor) } satisfies Bloque;
    }
    return bloques;
  },
  async coleccion(clave) {
    const def = definicion(clave);
    if (!def) throw new Error(`La colección «${clave}» no tiene definición en plataforma/colecciones.`);
    const ricos = new Set(def.fields.filter((f) => f.control === 'rich').map((f) => f.name));
    const visibles = semilla(clave)
      .filter((e) => e.estado === 'visible')
      .map((e): Record<string, unknown> & { orden: number } => {
        const datos = Object.fromEntries(
          Object.entries(e.datos).map(([k, v]) => [k, ricos.has(k) && typeof v === 'string' ? aTextoEnriquecido(v) : v]),
        );
        return {
          id: e.idOrigen, slug: e.slug, orden: e.orden, creadoEn: CREADO, actualizadoEn: CREADO,
          ...(conFotosServibles(datos) as Record<string, unknown>),
        };
      });
    const orden = def.sortBy ?? 'order';
    visibles.sort((a, b) => {
      if (orden === 'order') return a.orden - b.orden;
      const x = String(a[orden.field] ?? '');
      const y = String(b[orden.field] ?? '');
      return (orden.direction ?? 'desc') === 'asc' ? x.localeCompare(y, 'es') : y.localeCompare(x, 'es');
    });
    return visibles as never;
  },
};
