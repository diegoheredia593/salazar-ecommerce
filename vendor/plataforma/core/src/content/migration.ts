/**
 * Paquete de migración (sprint 4b, parte 2): el formato de `migracion.json`, que dentro
 * del .zip va junto a `fotos/…`. Lo escribe scripts/build-legacy-package.ts y lo lee el
 * importador del Worker; ambos usan este mismo esquema, así que no pueden desviarse.
 *
 * Las fotos se referencian dentro de los datos con su ruta ORIGINAL (`src`); el
 * importador las reemplaza por la foto ya subida a la biblioteca del cliente.
 */
import { z } from 'zod';
import { BLOCK_CONTROLS, BLOCK_LEVELS, ITEM_STATES } from './schema';

export const MIGRATION_PACKAGE_VERSION = 1;
export const MIGRATION_FILE = 'migracion.json';
export const MIGRATION_PHOTOS_DIR = 'fotos/';

/** Tipos de advertencia: lo que no se pudo convertir o quedó a medias. Nunca se descarta en silencio. */
export const MIGRATION_WARNING_KINDS = [
  'foto_ausente',
  'foto_pesada',
  'valor_invalido',
  'elemento_incompleto',
  'relacion_colgante',
  'bloque_sin_valor',
  'borrador_descartado',
  'otro',
] as const;

export const migrationWarningSchema = z.object({
  tipo: z.enum(MIGRATION_WARNING_KINDS),
  ref: z.string(),
  motivo: z.string(),
});
export type MigrationWarning = z.infer<typeof migrationWarningSchema>;

export const migrationBlockSchema = z.object({
  key: z.string(),
  page: z.string(),
  section: z.string(),
  label: z.string(),
  help: z.string().nullable(),
  control: z.enum(BLOCK_CONTROLS),
  level: z.enum(BLOCK_LEVELS),
  maxLength: z.number().int().nullable(),
  required: z.boolean(),
  order: z.number().int(),
  value: z.unknown(),
});

export const migrationItemSchema = z.object({
  coleccion: z.string(),
  /** Id del elemento en el sistema de origen; con él se calcula el id estable del importado. */
  idOrigen: z.string().min(1),
  slug: z.string().nullable(),
  estado: z.enum(ITEM_STATES),
  orden: z.number().int(),
  datos: z.record(z.string(), z.unknown()),
  /** ISO 8601 del origen; si no viene, la fecha de importación. */
  creado: z.string().optional(),
  actualizado: z.string().optional(),
});

export const migrationPhotoSchema = z.object({
  /** Ruta dentro del zip, p. ej. `fotos/ninez/taller-autoestima.webp`. */
  ruta: z.string().startsWith(MIGRATION_PHOTOS_DIR),
  /** Ruta con la que los datos se refieren a ella (`src`), p. ej. `/fotos/ninez/taller-autoestima.webp`. */
  origen: z.string().min(1),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
  alt: z.string().min(1),
});
export type MigrationPhoto = z.infer<typeof migrationPhotoSchema>;

export const migrationPackageSchema = z.object({
  version: z.literal(MIGRATION_PACKAGE_VERSION),
  origen: z.string().min(1),
  generadoEn: z.string(),
  /** Definiciones en el formato de colecciones personalizadas (se validan con `parseCustomDefinition`). */
  colecciones: z.array(z.record(z.string(), z.unknown())),
  /**
   * Tipos de formulario del portal anterior (sprint 4d), en el formato de `parseFormDefinition`.
   * Opcional: los paquetes anteriores al 4d no lo traen y siguen importando igual.
   */
  formularios: z.array(z.record(z.string(), z.unknown())).default([]),
  bloques: z.array(migrationBlockSchema),
  elementos: z.array(migrationItemSchema),
  fotos: z.array(migrationPhotoSchema),
  advertencias: z.array(migrationWarningSchema),
});
export type MigrationPackage = z.infer<typeof migrationPackageSchema>;
/** Lo que se escribe en migracion.json: `formularios` es opcional (paquetes anteriores al 4d). */
export type MigrationPackageInput = z.input<typeof migrationPackageSchema>;

/** Id estable de un elemento importado: importar dos veces el mismo paquete no lo duplica. */
export function migratedItemId(tenantId: string, idOrigen: string): string {
  return `mig_${tenantId}_${idOrigen}`;
}

/** Nombre original con el que se guarda una foto importada en la biblioteca (clave de idempotencia). */
export function migratedPhotoName(origen: string): string {
  return `migracion:${origen}`;
}

/**
 * Recorre un valor JSON y devuelve una copia en la que cada imagen (objeto con `src`
 * string) pasa por `map`. Una imagen se reconoce por tener `src` y `alt`.
 */
export function mapImages(value: unknown, map: (image: Record<string, unknown>) => unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => mapImages(v, map));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj['src'] === 'string' && 'alt' in obj) return map(obj);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, mapImages(v, map)]));
  }
  return value;
}

/** Todas las rutas `src` de imágenes dentro de un valor. */
export function collectImageSources(value: unknown): string[] {
  const found: string[] = [];
  mapImages(value, (image) => {
    found.push(image['src'] as string);
    return image;
  });
  return found;
}
