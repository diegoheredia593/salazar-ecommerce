/**
 * Núcleo genérico de contenido (sprint 3) — portado de
 * C:\Users\USER\Desktop\fluvida-web\packages\cms-core\src\schema.ts, con dos cambios
 * de fondo respecto al original:
 *
 *  - Los ESTADOS de un ítem son los que pide el encargo (visible/oculto/programado),
 *    no los de Fluvida (borrador/publicado/archivado) — la papelera es un campo
 *    aparte (`deletedAt`, en el esquema de Drizzle), nunca un cuarto estado.
 *  - Las COLECCIONES y los BLOQUES no se declaran en código por cliente: las 9
 *    colecciones de este sprint sí se declaran aquí (ver content/collections.ts),
 *    pero son compartidas por todos los clientes — lo que varía por cliente es qué
 *    colecciones están activas (tenant_modules) y los valores (tabla items).
 *
 * Ver docs/decisiones.md, sección "Núcleo de contenido, fotos y bloques (sprint 3)"
 * para la lista completa de qué se portó tal cual y qué se rediseñó.
 */
import { z } from 'zod';
import { LINK_PATTERN } from './linkPattern';

export { LINK_PATTERN };

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

export const imageSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string().min(1, 'Toda imagen necesita texto alternativo (alt).'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Id en media_library, si se eligió de la biblioteca. */
    mediaId: z.string().optional(),
  })
  .meta({ control: 'image' });
export type Image = z.infer<typeof imageSchema>;

/** Proporción de recorte, p. ej. "4:5". `null` = libre. */
export type AspectRatio = `${number}:${number}` | null;

// ---------------------------------------------------------------------------
// Videos de YouTube (solo se guarda el id; el video vive en YouTube)
// ---------------------------------------------------------------------------

export const youtubeVideoSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{11}$/,
        'Ese enlace no es de un video de YouTube. Copia el enlace desde el botón Compartir del video.',
      ),
    /** Título accesible del reproductor. */
    title: z.string().trim().min(3, 'Escribe el título del video (al menos 3 caracteres).').max(120),
  })
  .meta({ control: 'video_youtube' });
export type YoutubeVideo = z.infer<typeof youtubeVideoSchema>;

// ---------------------------------------------------------------------------
// Texto enriquecido (formato estructurado; nunca HTML arbitrario)
// ---------------------------------------------------------------------------

export const inlineSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  link: z.string().regex(LINK_PATTERN, 'Enlace no permitido').optional(),
});
export type Inline = z.infer<typeof inlineSchema>;

export const richTextNodeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), content: z.array(inlineSchema) }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().default(false),
    items: z.array(z.array(inlineSchema)),
  }),
]);
export type RichTextNode = z.infer<typeof richTextNodeSchema>;

export const richTextSchema = z.array(richTextNodeSchema).meta({ control: 'rich' });
export type RichText = z.infer<typeof richTextSchema>;

export function plainTextOf(value: RichText): string {
  return value
    .flatMap((n) => (n.type === 'paragraph' ? [n.content] : n.items))
    .flatMap((inlines) => inlines.map((i) => i.text))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Bloques fijos (definición + valor viven juntos, ver block_definitions)
// ---------------------------------------------------------------------------

export const BLOCK_CONTROLS = ['text', 'textLong', 'rich', 'url', 'image'] as const;
export type BlockControl = (typeof BLOCK_CONTROLS)[number];

/**
 * `content`: lo que un editor del portal puede cambiar. `system`: textos técnicos que
 * solo ve y edita el superadmin, nunca expuestos al portal (ver
 * worker/routes/portal.ts — el filtro es en la consulta, no solo en la pantalla).
 */
export const BLOCK_LEVELS = ['content', 'system'] as const;
export type BlockLevel = (typeof BLOCK_LEVELS)[number];

export type BlockValue<T extends BlockControl = BlockControl> = T extends 'rich'
  ? RichText | null
  : T extends 'image'
    ? Image | null
    : string | null;

export function isBlockValueEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Valida el valor de un bloque contra su propia definición (control/maxLength/obligatorio). */
export function validateBlockValue(block: {
  control: BlockControl;
  maxLength: number | null;
  required: boolean;
  value: unknown;
}): string | null {
  if (isBlockValueEmpty(block.value))
    return block.required ? 'Este bloque es obligatorio y está vacío.' : null;
  if (block.control === 'image') {
    const r = imageSchema.safeParse(block.value);
    return r.success ? null : `Imagen inválida (${r.error.issues[0]?.message}).`;
  }
  if (block.control === 'rich') {
    const r = richTextSchema.safeParse(block.value);
    if (!r.success) return 'Texto enriquecido inválido.';
    const length = plainTextOf(r.data).length;
    return block.maxLength && length > block.maxLength
      ? `${length} caracteres (máx. ${block.maxLength}).`
      : null;
  }
  const text = block.value as string;
  if (block.maxLength && text.length > block.maxLength)
    return `${text.length} caracteres (máx. ${block.maxLength}).`;
  if (block.control === 'url' && !/^(\/|https:\/\/|mailto:|tel:|#)/.test(text)) return 'URL no válida.';
  return null;
}

// ---------------------------------------------------------------------------
// Ítems de colección
// ---------------------------------------------------------------------------

export const ITEM_STATES = ['visible', 'hidden', 'scheduled'] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export const ITEM_BASE_FIELDS = ['id', 'state', 'order', 'createdAt', 'updatedAt'] as const;

export const itemBaseSchema = z.object({
  id: z.string().min(1),
  state: z.enum(ITEM_STATES),
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ItemBase = z.infer<typeof itemBaseSchema>;

/** Construye el esquema de una colección a partir de sus campos propios. */
export function withItemBase<S extends z.ZodRawShape>(fields: S) {
  return itemBaseSchema.extend(fields);
}

/** Una colección de contenido, compartida por todos los clientes (ver content/collections.ts). */
export interface CollectionDefinition<S extends z.ZodObject = z.ZodObject> {
  /** Clave estable en inglés (tabla items.collection y tenant_modules.module = "content:<key>"). */
  key: string;
  schema: S;
  /** Nombre legible en plural, p. ej. "Productos". */
  label: string;
  /** Nombre legible en singular, p. ej. "producto". */
  singular: string;
  /** Género gramatical del singular, para textos como "Nuevo producto"/"Nueva promoción". */
  gender: 'f' | 'm';
  description: string;
  /** Campo que se usa como título del ítem en listas e historial. */
  titleField: string;
  /** Campos en los que busca el buscador del portal. */
  searchFields?: string[];
  /**
   * `order` (manual, se arrastra) o por un campo (descendente si no se indica otra
   * dirección; las colecciones fijas siempre son descendentes). Por defecto `order`.
   */
  sortBy?: 'order' | { field: string; direction?: 'asc' | 'desc' };
  /** Campo único que forma la dirección de la página (p. ej. "slug"). */
  slugField?: string;
  /** Grupo del menú del portal. */
  group?: string;
}

// ---------------------------------------------------------------------------
// "Solicitar un cambio"
// ---------------------------------------------------------------------------

export const CHANGE_REQUEST_STATUSES = ['new', 'in_progress', 'done'] as const;
export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number];
