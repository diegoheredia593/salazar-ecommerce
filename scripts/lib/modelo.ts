// Lectura del modelo de contenido (carpeta plataforma/) y su conversión al formato que importa la consola.
// Las reglas NO se reescriben aquí: se usan los esquemas de agencia-plataforma copiados en vendor/plataforma/core
// (custom.ts, forms.ts, sitePages.ts, schema.ts, migration.ts), los mismos que usa la consola al importar.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { aTextoEnriquecido } from '../../src/lib/content/textoPlano.ts';

export { aTextoEnriquecido };

export const RAIZ = resolve(import.meta.dirname, '..', '..');
export const PLATAFORMA = join(RAIZ, 'plataforma');

/** Tope de la biblioteca de Fotos de la plataforma (y de las fotos del paquete). */
export const TOPE_FOTO = 2 * 1024 * 1024;

export interface Foto { src: string; alt: string; width: number; height: number }

export interface Bloque {
  key: string; page: string; section: string; label: string; help: string | null;
  control: 'text' | 'textLong' | 'rich' | 'url' | 'image'; level: 'content' | 'system';
  maxLength: number | null; required: boolean; order: number;
  /** En `rich` se escribe como texto plano (ver `aTextoEnriquecido`); en `image`, una Foto o null. */
  value: string | Foto | null;
}

export interface Campo {
  name: string; control: string; label?: string; help?: string; required?: boolean;
  max?: number; aspectRatio?: string; options?: { value: string; label: string }[]; from?: string;
}
export interface Coleccion {
  key: string; label: string; singular: string; gender: 'f' | 'm'; description: string;
  titleField: string; searchFields?: string[]; sortBy?: 'order' | { field: string; direction?: 'asc' | 'desc' };
  slugField?: string; fields: Campo[];
}

export interface CampoFormulario {
  name: string; label: string; type: string; required: boolean; max?: number;
  options?: { value: string; label: string }[];
}
export interface Formulario { key: string; label: string; active: boolean; fields: CampoFormulario[] }

export interface Pagina { key: string; name: string; route: string; blockPrefixes?: string[] }
export interface Paginas { pages: Pagina[]; collections: { collection: string; page: string; alsoOn?: string[] }[] }

export interface Elemento {
  idOrigen: string; slug: string | null; estado: 'visible' | 'hidden' | 'scheduled'; orden: number;
  datos: Record<string, unknown>;
}

export interface Modelo {
  paginas: Paginas;
  bloques: Bloque[];
  colecciones: Coleccion[];
  formularios: Formulario[];
  semilla: Record<string, Elemento[]>;
}

export function leerJson<T>(ruta: string): T {
  return JSON.parse(readFileSync(ruta, 'utf8').replace(/^﻿/, '')) as T; // editores de Windows agregan BOM
}

function leerCarpeta<T>(carpeta: string): { clave: string; valor: T }[] {
  const ruta = join(PLATAFORMA, carpeta);
  if (!existsSync(ruta)) return [];
  return readdirSync(ruta)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ clave: f.replace(/\.json$/, ''), valor: leerJson<T>(join(ruta, f)) }));
}

export function leerModelo(): Modelo {
  const semilla: Record<string, Elemento[]> = {};
  for (const { clave, valor } of leerCarpeta<Elemento[]>('semilla')) semilla[clave] = valor;
  return {
    paginas: leerJson<Paginas>(join(PLATAFORMA, 'paginas.json')),
    bloques: leerJson<Bloque[]>(join(PLATAFORMA, 'bloques.json')),
    colecciones: leerCarpeta<Coleccion>('colecciones').map((c) => c.valor),
    formularios: leerCarpeta<Formulario>('formularios').map((f) => f.valor),
    semilla,
  };
}

export const esPendiente = (v: unknown): boolean => typeof v === 'string' && v.startsWith('[PENDIENTE');

export function esFoto(v: unknown): v is Foto {
  return typeof v === 'object' && v !== null && 'src' in v;
}

/** El valor de un bloque tal como lo guarda la plataforma. */
export function valorDeBloque(b: Bloque): unknown {
  return b.control === 'rich' && typeof b.value === 'string' ? aTextoEnriquecido(b.value) : b.value;
}

/** Los datos de un elemento tal como los guarda la plataforma (los campos `rich` pasan a RichText). */
export function datosDeElemento(def: Coleccion, datos: Record<string, unknown>): Record<string, unknown> {
  const ricos = new Set(def.fields.filter((f) => f.control === 'rich').map((f) => f.name));
  return Object.fromEntries(
    Object.entries(datos).map(([k, v]) => [k, ricos.has(k) && typeof v === 'string' ? aTextoEnriquecido(v) : v]),
  );
}

/** Recorre un valor y devuelve todas las fotos que contiene (bloques, campos image y gallery). */
export function fotosEn(valor: unknown): Foto[] {
  if (esFoto(valor)) return [valor];
  if (Array.isArray(valor)) return valor.flatMap(fotosEn);
  if (typeof valor === 'object' && valor !== null) return Object.values(valor).flatMap(fotosEn);
  return [];
}
