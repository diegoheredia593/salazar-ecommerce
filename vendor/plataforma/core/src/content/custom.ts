/**
 * Colecciones personalizadas por cliente (sprint 4b): una colección definida como
 * DATOS (JSON) en vez de código. `buildCollectionDefinition()` es la única función que
 * convierte esa definición en el mismo `CollectionDefinition` (Zod con `.meta()`) que
 * usan las 9 colecciones fijas — así el formulario genérico, la validación, la
 * papelera, el historial, /v1 y el SDK no distinguen unas de otras.
 *
 * Formato y reglas: docs/decisiones.md, sección "Colecciones personalizadas (sprint 4b)".
 */
import { z } from 'zod';
import { CONTENT_MODULE_PREFIX, RESERVED_COLLECTION_KEYS } from './collections';
import type { Control } from './fields';
import { LINK_PATTERN } from './linkPattern';
import {
  ITEM_BASE_FIELDS,
  imageSchema,
  richTextSchema,
  withItemBase,
  youtubeVideoSchema,
  type CollectionDefinition,
} from './schema';

export const CUSTOM_CONTROLS = [
  'text',
  'textLong',
  'rich',
  'slug',
  'date',
  'url',
  'link',
  'number',
  'checkbox',
  'option',
  'options',
  'textList',
  'image',
  'gallery',
  'video_youtube',
  'videos_youtube',
  'relation',
  'group',
] as const satisfies readonly Control[];

const COLLECTION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{1,39}$/;
const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLEXIBLE_DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

// ---------------------------------------------------------------------------
// Forma de la definición (lo que se guarda en collection_definitions.definition)
// ---------------------------------------------------------------------------

export interface CustomFieldInput {
  name: string;
  control: (typeof CUSTOM_CONTROLS)[number];
  label?: string | undefined;
  help?: string | undefined;
  /** false ⇒ admite vacío (se guarda null / lista vacía). */
  required: boolean;
  min?: number | undefined;
  max?: number | undefined;
  maxItem?: number | undefined;
  aspectRatio?: `${number}:${number}` | null | undefined;
  options?: { value: string; label: string }[] | undefined;
  relation?: { collection: string; value: string; label: string } | undefined;
  from?: string | undefined;
  fields?: CustomFieldInput[] | undefined;
}

const aspectRatioSchema = z
  .string()
  .regex(/^\d+:\d+$/, 'La proporción debe verse como "4:3".')
  .nullable()
  .transform((v) => v as `${number}:${number}` | null);

const customFieldSchema: z.ZodType<CustomFieldInput, CustomFieldInput> = z.lazy(() =>
  z.object({
    name: z
      .string()
      .regex(FIELD_NAME_PATTERN, 'El nombre del campo empieza con minúscula y solo lleva letras y números.'),
    control: z.enum(CUSTOM_CONTROLS),
    label: z.string().trim().min(1).max(80).optional(),
    help: z.string().trim().max(300).optional(),
    required: z.boolean().default(false),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
    maxItem: z.number().int().positive().optional(),
    aspectRatio: aspectRatioSchema.optional(),
    options: z
      .array(z.object({ value: z.string().min(1).max(60), label: z.string().min(1).max(80) }))
      .optional(),
    relation: z
      .object({
        collection: z.string().regex(COLLECTION_KEY_PATTERN),
        value: z.string().regex(FIELD_NAME_PATTERN),
        label: z.string().regex(FIELD_NAME_PATTERN),
      })
      .optional(),
    from: z.string().regex(FIELD_NAME_PATTERN).optional(),
    fields: z.array(customFieldSchema).optional(),
  }),
) as z.ZodType<CustomFieldInput, CustomFieldInput>;

const sortBySchema = z.union([
  z.literal('order'),
  z.object({ field: z.string(), direction: z.enum(['asc', 'desc']).default('desc') }),
]);

export const customDefinitionSchema = z
  .object({
    key: z
      .string()
      .regex(COLLECTION_KEY_PATTERN, 'La clave empieza con minúscula y solo lleva letras y números.'),
    label: z.string().trim().min(1).max(60),
    singular: z.string().trim().min(1).max(60),
    gender: z.enum(['f', 'm']),
    description: z.string().trim().max(300).default(''),
    group: z.string().trim().min(1).max(60).optional(),
    titleField: z.string(),
    searchFields: z.array(z.string()).max(10).optional(),
    sortBy: sortBySchema.default('order'),
    slugField: z.string().optional(),
    fields: z.array(customFieldSchema).min(1, 'Agrega al menos un campo.').max(60),
  })
  .superRefine((def, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    if (RESERVED_COLLECTION_KEYS.includes(def.key))
      issue(['key'], `La clave "${def.key}" ya la usa una sección fija de la plataforma.`);
    if (def.key.startsWith(CONTENT_MODULE_PREFIX))
      issue(['key'], 'La clave no puede empezar con "content:".');

    checkFields(def.fields, ['fields'], issue, true);

    const top = new Map(def.fields.map((f) => [f.name, f]));
    const titleCandidate = top.get(def.titleField);
    if (!titleCandidate) issue(['titleField'], `El campo "${def.titleField}" no existe en la colección.`);
    else if (
      !['text', 'textLong', 'slug', 'date', 'url', 'link', 'number', 'option'].includes(
        titleCandidate.control,
      )
    )
      issue(
        ['titleField'],
        `El campo "${def.titleField}" no se puede usar como título (es de tipo ${titleCandidate.control}).`,
      );

    def.searchFields?.forEach((name, i) => {
      const f = top.get(name);
      if (!f) issue(['searchFields', i], `El campo "${name}" no existe en la colección.`);
      else if (!['text', 'textLong', 'slug', 'url', 'link'].includes(f.control))
        issue(['searchFields', i], `El campo "${name}" no es de texto y no se puede buscar.`);
    });

    if (def.slugField !== undefined) {
      const f = top.get(def.slugField);
      if (!f) issue(['slugField'], `El campo "${def.slugField}" no existe en la colección.`);
      else if (f.control !== 'slug')
        issue(['slugField'], `El campo "${def.slugField}" debe ser de tipo slug.`);
      else if (!f.required) issue(['slugField'], `El campo "${def.slugField}" debe ser obligatorio.`);
    }

    if (def.sortBy !== 'order') {
      const f = top.get(def.sortBy.field);
      if (!f) issue(['sortBy', 'field'], `El campo "${def.sortBy.field}" no existe en la colección.`);
      else if (!['date', 'text', 'slug', 'number'].includes(f.control))
        issue(['sortBy', 'field'], `No se puede ordenar por un campo de tipo ${f.control}.`);
    }
  });

export type CustomCollectionInput = z.input<typeof customDefinitionSchema>;
export type CustomCollectionDefinition = z.output<typeof customDefinitionSchema>;

type Issue = (path: (string | number)[], message: string) => void;

function checkFields(fields: CustomFieldInput[], path: (string | number)[], issue: Issue, topLevel: boolean) {
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    const here = [...path, i];
    if (seen.has(f.name)) issue([...here, 'name'], `El campo "${f.name}" está repetido.`);
    seen.add(f.name);
    if (topLevel && (ITEM_BASE_FIELDS as readonly string[]).includes(f.name))
      issue([...here, 'name'], `"${f.name}" es un nombre reservado por la plataforma.`);

    if ((f.control === 'option' || f.control === 'options') && !f.options?.length)
      issue([...here, 'options'], 'Este tipo de campo necesita al menos una opción.');
    if ((f.control === 'option' || f.control === 'options') && f.options) {
      const values = f.options.map((o) => o.value);
      if (new Set(values).size !== values.length)
        issue([...here, 'options'], 'Hay opciones con el mismo valor.');
    }
    if (f.control === 'relation' && !f.relation)
      issue([...here, 'relation'], 'Un campo de relación necesita "relation".');
    if (f.control === 'slug' && f.from === undefined)
      issue([...here, 'from'], 'Un campo slug necesita "from" (el campo del que se genera).');
    if (f.control === 'slug' && f.from !== undefined && !fields.some((x) => x.name === f.from))
      issue([...here, 'from'], `El campo "${f.from}" no existe.`);
    if (f.control === 'group') {
      if (!f.fields?.length) issue([...here, 'fields'], 'Un grupo necesita al menos un campo.');
      else checkFields(f.fields, [...here, 'fields'], issue, false);
    } else if (f.fields) issue([...here, 'fields'], 'Solo los campos de tipo group llevan "fields".');
  });
}

// ---------------------------------------------------------------------------
// Definición → Zod (misma forma que las colecciones fijas)
// ---------------------------------------------------------------------------

function optionRecord(options: { value: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}

function textSchema(f: CustomFieldInput, fallbackMax: number) {
  let s = z.string().trim();
  const min = f.min ?? (f.required ? 1 : 0);
  if (min > 0) s = s.min(min);
  return s.max(f.max ?? fallbackMax);
}

function buildFieldSchema(f: CustomFieldInput): z.ZodType {
  const meta = {
    control: f.control,
    ...(f.label ? { label: f.label } : {}),
    ...(f.help ? { help: f.help } : {}),
  };
  const opt = <T extends z.ZodType>(schema: T): z.ZodType => (f.required ? schema : schema.nullable());

  switch (f.control) {
    case 'text':
      return opt(textSchema(f, 200)).meta(meta);
    case 'textLong':
      return opt(textSchema(f, 5000)).meta(meta);
    case 'slug':
      return opt(z.string().regex(SLUG_PATTERN)).meta({ ...meta, ...(f.from ? { from: f.from } : {}) });
    case 'date':
      return opt(z.string().regex(FLEXIBLE_DATE_PATTERN, 'Usa el formato AAAA-MM-DD (o AAAA-MM).')).meta(
        meta,
      );
    case 'url':
      return opt(z.url()).meta(meta);
    case 'link':
      return opt(
        z.string().min(1).regex(LINK_PATTERN, 'Usa una ruta interna (/…), https://, mailto: o tel:.'),
      ).meta(meta);
    case 'number': {
      let n = z.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return opt(n).meta(meta);
    }
    case 'checkbox':
      return z.boolean().default(false).meta(meta);
    case 'option': {
      const values = f.options!.map((o) => o.value) as [string, ...string[]];
      return opt(z.enum(values)).meta({ ...meta, options: optionRecord(f.options!) });
    }
    case 'options': {
      const values = f.options!.map((o) => o.value) as [string, ...string[]];
      return z.array(z.enum(values)).meta({ ...meta, options: optionRecord(f.options!) });
    }
    case 'textList': {
      let a = z.array(
        z
          .string()
          .trim()
          .max(f.maxItem ?? 200),
      );
      if (f.max !== undefined) a = a.max(f.max);
      return (f.required ? a.min(1) : a).meta(meta);
    }
    case 'image':
      return opt(imageSchema).meta({ ...meta, aspectRatio: f.aspectRatio ?? null });
    case 'gallery': {
      const a = z.array(imageSchema).max(f.max ?? 30);
      return (f.required ? a.min(1) : a).meta({ ...meta, aspectRatio: f.aspectRatio ?? null });
    }
    case 'video_youtube':
      return opt(youtubeVideoSchema).meta(meta);
    case 'videos_youtube': {
      const max = f.max ?? 10;
      const a = z.array(youtubeVideoSchema).max(max);
      return (f.required ? a.min(1) : a).meta({ ...meta, max });
    }
    case 'rich': {
      const r = f.required ? richTextSchema : richTextSchema.nullable();
      return r.meta({ ...meta, ...(f.max ? { max: f.max } : {}) });
    }
    case 'relation':
      return opt(z.string().min(1)).meta({ ...meta, relation: f.relation! });
    case 'group':
      return buildObject(f.fields!).meta(meta);
  }
}

function buildShape(fields: CustomFieldInput[]): Record<string, z.ZodType> {
  return Object.fromEntries(fields.map((f) => [f.name, buildFieldSchema(f)]));
}

function buildObject(fields: CustomFieldInput[]) {
  return z.object(buildShape(fields));
}

/**
 * La única función que convierte una definición por datos en una colección. Lanza
 * `ZodError` (con rutas como `fields.3.relation.collection`) si la definición no es
 * válida; usar `parseCustomDefinition()` para obtener los errores ya legibles.
 */
export function buildCollectionDefinition(input: unknown): CollectionDefinition {
  const def = customDefinitionSchema.parse(input);
  return {
    key: def.key,
    schema: withItemBase(buildShape(def.fields)),
    label: def.label,
    singular: def.singular,
    gender: def.gender,
    description: def.description,
    titleField: def.titleField,
    ...(def.searchFields ? { searchFields: def.searchFields } : {}),
    sortBy: def.sortBy,
    ...(def.slugField ? { slugField: def.slugField } : {}),
    ...(def.group ? { group: def.group } : {}),
  };
}

export type ParsedCustomDefinition =
  | { ok: true; definition: CustomCollectionDefinition; collection: CollectionDefinition }
  | { ok: false; errors: { path: string; message: string }[] };

/** Valida una definición y devuelve errores con la ruta (`fields[3].relation.collection`). */
export function parseCustomDefinition(input: unknown): ParsedCustomDefinition {
  const r = customDefinitionSchema.safeParse(input);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.map((i) => ({
        path: i.path
          .map((p, n) => (typeof p === 'number' ? `[${p}]` : n === 0 ? String(p) : `.${String(p)}`))
          .join(''),
        message: i.message,
      })),
    };
  }
  return { ok: true, definition: r.data, collection: buildCollectionDefinition(r.data) };
}

// ---------------------------------------------------------------------------
// Cambios entre dos versiones de una definición
// ---------------------------------------------------------------------------

export interface DefinitionChange {
  /** `free`: no afecta lo ya cargado. `breaking`: puede dejar elementos inválidos. */
  kind: 'free' | 'breaking';
  path: string;
  message: string;
}

function diffFields(
  prev: CustomFieldInput[],
  next: CustomFieldInput[],
  prefix: string,
  out: DefinitionChange[],
) {
  const before = new Map(prev.map((f) => [f.name, f]));
  const after = new Map(next.map((f) => [f.name, f]));
  const at = (name: string) => `${prefix}${name}`;

  for (const [name, f] of before) {
    const g = after.get(name);
    if (!g) {
      out.push({
        kind: 'breaking',
        path: at(name),
        message: `Se quita el campo "${name}" (se pierde de lo ya cargado).`,
      });
      continue;
    }
    if (g.control !== f.control) {
      out.push({
        kind: 'breaking',
        path: at(name),
        message: `El campo "${name}" cambia de tipo (${f.control} → ${g.control}).`,
      });
      continue;
    }
    if (!f.required && g.required)
      out.push({ kind: 'breaking', path: at(name), message: `El campo "${name}" pasa a ser obligatorio.` });
    if (f.max !== undefined && (g.max === undefined ? false : g.max < f.max))
      out.push({
        kind: 'breaking',
        path: at(name),
        message: `El campo "${name}" baja su límite (${f.max} → ${g.max}).`,
      });
    if ((g.min ?? 0) > (f.min ?? 0))
      out.push({ kind: 'breaking', path: at(name), message: `El campo "${name}" sube su mínimo.` });
    if (f.options && g.options) {
      const kept = new Set(g.options.map((o) => o.value));
      const lost = f.options.filter((o) => !kept.has(o.value)).map((o) => o.value);
      if (lost.length)
        out.push({
          kind: 'breaking',
          path: at(name),
          message: `El campo "${name}" quita opciones (${lost.join(', ')}).`,
        });
    }
    if (f.control === 'group') diffFields(f.fields ?? [], g.fields ?? [], `${name}.`, out);
    if (
      f.label !== g.label ||
      f.help !== g.help ||
      f.aspectRatio !== g.aspectRatio ||
      JSON.stringify(f.options) !== JSON.stringify(g.options)
    )
      out.push({
        kind: 'free',
        path: at(name),
        message: `Se ajustan los textos u opciones del campo "${name}".`,
      });
  }
  for (const [name, g] of after) {
    if (before.has(name)) continue;
    const needsValue = g.required && g.control !== 'checkbox';
    out.push(
      needsValue
        ? {
            kind: 'breaking',
            path: at(name),
            message: `Campo nuevo obligatorio "${name}": los elementos ya cargados quedarán incompletos.`,
          }
        : { kind: 'free', path: at(name), message: `Se agrega el campo opcional "${name}".` },
    );
  }
}

/** Cambios entre la definición guardada y la nueva, separados en libres y rompedores. */
export function diffDefinitions(
  prev: CustomCollectionDefinition,
  next: CustomCollectionDefinition,
): DefinitionChange[] {
  const out: DefinitionChange[] = [];
  diffFields(prev.fields, next.fields, '', out);
  if (prev.slugField !== next.slugField)
    out.push({
      kind: 'breaking',
      path: 'slugField',
      message: 'Cambia el campo que forma la dirección de cada elemento.',
    });
  if (
    prev.label !== next.label ||
    prev.singular !== next.singular ||
    prev.gender !== next.gender ||
    prev.description !== next.description ||
    prev.group !== next.group ||
    prev.titleField !== next.titleField ||
    JSON.stringify(prev.searchFields) !== JSON.stringify(next.searchFields) ||
    JSON.stringify(prev.sortBy) !== JSON.stringify(next.sortBy)
  )
    out.push({ kind: 'free', path: '', message: 'Se ajustan los datos generales de la colección.' });
  return out;
}
