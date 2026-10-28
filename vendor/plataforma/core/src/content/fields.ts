/**
 * Descripción de campos para generar formularios desde los esquemas Zod, portado de
 * fluvida-web/packages/cms-core/src/campos.ts (identificadores en inglés, misma
 * lógica). Cada colección declara sus campos con `.meta({...})`; `describeObject()`
 * recorre el esquema y devuelve la lista de campos que el portal sabe dibujar — así
 * el formulario genérico no conoce ningún campo de ninguna colección en particular.
 */
import type { z } from 'zod';
import type { AspectRatio } from './schema';

/** Controles que el portal sabe dibujar. */
export type Control =
  | 'text'
  | 'textLong'
  | 'rich'
  | 'slug'
  | 'date'
  | 'url'
  | 'link'
  | 'number'
  | 'checkbox'
  | 'option'
  | 'options'
  | 'textList'
  | 'image'
  | 'gallery'
  | 'video_youtube'
  | 'videos_youtube'
  | 'relation'
  | 'group';

export interface Relation {
  /** Colección de la que se eligen valores. */
  collection: string;
  /** Campo que se guarda (p. ej. "slug"). */
  value: string;
  /** Campo que se muestra (p. ej. "name"). */
  label: string;
}

declare module 'zod' {
  interface GlobalMeta {
    /** Nombre del campo en el portal, en lenguaje simple. */
    label?: string;
    /** Ayuda que aparece bajo el campo. */
    help?: string;
    /** Fuerza un control distinto al que se deduce del tipo. */
    control?: Control;
    /** Fotos: proporción de recorte (p. ej. "16:9"). */
    aspectRatio?: AspectRatio;
    /** Opciones con nombre legible: valor → etiqueta. */
    options?: Record<string, string>;
    /** Valor elegido de otra colección. */
    relation?: Relation;
    /** Slugs: campo del que se genera automáticamente (p. ej. "name"). */
    from?: string;
    /** Texto enriquecido: límite de caracteres del texto total. */
    max?: number;
  }
}

export interface Field {
  name: string;
  label: string;
  help?: string;
  control: Control;
  required: boolean;
  /** Admite vacío (se guarda null). */
  nullable: boolean;
  max?: number;
  min?: number;
  aspectRatio?: AspectRatio;
  options?: { value: string; label: string }[];
  relation?: Relation;
  from?: string;
  /** Solo "group": campos internos. */
  fields?: Field[];
  /** Solo "textList": límite de cada elemento. */
  maxItem?: number;
}

type Any = z.ZodType;

interface Unwrapped {
  base: Any;
  nullable: boolean;
  meta: z.GlobalMeta;
}

/** Quita nullable/optional/default y junta los metadatos de todas las capas. */
function unwrap(schema: Any): Unwrapped {
  let current: Any = schema;
  let nullable = false;
  let meta: z.GlobalMeta = {};
  for (;;) {
    meta = { ...(current.meta() ?? {}), ...meta };
    const type = current._zod.def.type;
    if (type === 'nullable' || type === 'optional' || type === 'default') {
      nullable = nullable || type !== 'default';
      current = (current._zod.def as unknown as { innerType: Any }).innerType;
      continue;
    }
    break;
  }
  return { base: current, nullable, meta };
}

function labelFromName(name: string) {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function optionsOf(values: readonly string[], names?: Record<string, string>) {
  return values.map((value) => ({ value, label: names?.[value] ?? labelFromName(value) }));
}

/** Describe un campo a partir de su esquema. */
export function describeField(name: string, schema: Any): Field {
  const { base, nullable, meta } = unwrap(schema);
  const type = base._zod.def.type;
  const field: Field = {
    name,
    label: meta.label ?? labelFromName(name),
    ...(meta.help ? { help: meta.help } : {}),
    control: 'text',
    required: !nullable,
    nullable,
  };

  if (meta.aspectRatio !== undefined) field.aspectRatio = meta.aspectRatio;
  if (meta.relation) field.relation = meta.relation;
  if (meta.from) field.from = meta.from;

  if (type === 'string') {
    const s = base as z.ZodString;
    if (s.maxLength !== null) field.max = s.maxLength;
    if (s.minLength !== null) field.min = s.minLength;
    field.control =
      meta.control ??
      (meta.relation
        ? 'relation'
        : s.format === 'url'
          ? 'url'
          : (s.maxLength ?? 0) > 160
            ? 'textLong'
            : 'text');
    // Slugs y relaciones validan con expresión regular: son obligatorios si no admiten vacío.
    const hasPattern = field.control === 'slug' || field.control === 'relation';
    field.required = !nullable && ((s.minLength ?? 0) > 0 || hasPattern);
    return field;
  }
  if (type === 'number') {
    field.control = 'number';
    return field;
  }
  if (type === 'boolean') {
    field.control = 'checkbox';
    field.required = false;
    field.nullable = nullable;
    return field;
  }
  if (type === 'enum') {
    field.control = 'option';
    field.options = optionsOf((base as z.ZodEnum).options as string[], meta.options);
    return field;
  }
  if (type === 'object') {
    if (meta.control === 'image' || meta.control === 'video_youtube') {
      field.control = meta.control;
      return field;
    }
    field.control = 'group';
    field.fields = describeObject(base as z.ZodObject);
    field.required = false;
    return field;
  }
  if (type === 'array') {
    if (meta.control === 'rich') {
      field.control = 'rich';
      if (typeof meta.max === 'number') field.max = meta.max;
      field.required = !nullable;
      return field;
    }
    const element = unwrap((base as z.ZodArray<Any>).element);
    const elementType = element.base._zod.def.type;
    field.required = false;
    if (element.meta.control === 'image') {
      field.control = 'gallery';
      return field;
    }
    if (element.meta.control === 'video_youtube') {
      field.control = 'videos_youtube';
      const max = (base as z.ZodArray<Any>)._zod.bag.maximum;
      if (typeof max === 'number') field.max = max;
      else if (typeof meta.max === 'number') field.max = meta.max;
      return field;
    }
    if (elementType === 'enum') {
      field.control = 'options';
      field.options = optionsOf((element.base as z.ZodEnum).options as string[], meta.options);
      return field;
    }
    if (elementType === 'string') {
      field.control = 'textList';
      const max = (element.base as z.ZodString).maxLength;
      if (max !== null) field.maxItem = max;
      return field;
    }
  }
  throw new Error(`Campo "${name}": tipo "${type}" no soportado por el portal`);
}

/** Campos propios de un objeto (sin los de la base del ítem). */
export function describeObject(schema: z.ZodObject, omit: readonly string[] = []): Field[] {
  return Object.entries(schema.shape)
    .filter(([name]) => !omit.includes(name))
    .map(([name, s]) => describeField(name, s as Any));
}

/** Valor vacío para un campo nuevo. */
export function initialFieldValue(field: Field): unknown {
  switch (field.control) {
    case 'gallery':
    case 'videos_youtube':
    case 'textList':
    case 'options':
      return [];
    case 'rich':
      return field.nullable ? null : [];
    case 'group':
      return Object.fromEntries((field.fields ?? []).map((f) => [f.name, initialFieldValue(f)]));
    case 'option':
      return field.nullable ? null : (field.options?.[0]?.value ?? '');
    case 'checkbox':
      return false;
    default:
      return field.nullable ? null : '';
  }
}

/**
 * Limpia los valores antes de validar: quita espacios sobrantes y convierte los
 * textos vacíos en `null` cuando el campo lo admite (así el sitio los trata como
 * "pendiente" y no muestra un texto vacío).
 */
export function normalizeFieldValues(
  fields: Field[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let v = data[f.name];
    if (typeof v === 'string') {
      v = f.control === 'textLong' ? v.replace(/\s+$/g, '').replace(/^\s+/g, '') : v.trim();
      if (v === '' && f.nullable) v = null;
    } else if (f.control === 'group' && v && typeof v === 'object' && !Array.isArray(v)) {
      v = normalizeFieldValues(f.fields ?? [], v as Record<string, unknown>);
    } else if (f.control === 'textList' && Array.isArray(v)) {
      v = v.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '');
    } else if (v === undefined) {
      v = f.nullable ? null : initialFieldValue(f);
    }
    out[f.name] = v;
  }
  return out;
}

/**
 * Ejemplo escrito dentro de la etiqueta de un campo, al final: `Tipo (p. ej. "Portátil")`,
 * `Color, por ejemplo: rojo`. Algunas definiciones importadas del portal anterior lo traen así.
 */
const LABEL_EXAMPLE =
  /\s*(?:\(\s*(?:p\.\s*ej\.?|ej\.|ejemplo|por\s+ejemplo)[\s:][^)]*\)|[,;:—–-]\s*(?:p\.\s*ej\.?|ej\.|por\s+ejemplo)[\s:].*)$/i;

/**
 * Etiqueta de un campo sin el ejemplo que a veces trae dentro (encabezados de tabla, filtros).
 * No cambia la definición: solo cómo se muestra. Si no queda nada, devuelve la etiqueta tal cual.
 */
export function labelWithoutExample(label: string): string {
  const short = label.replace(LABEL_EXAMPLE, '').trim();
  return short || label;
}

/** ¿La etiqueta trae un ejemplo dentro? (para avisar al superadmin; nunca se corrige sola). */
export function labelHasExample(label: string): boolean {
  return labelWithoutExample(label) !== label.trim();
}
