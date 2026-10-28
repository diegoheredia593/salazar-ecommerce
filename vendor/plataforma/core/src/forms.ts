/**
 * Formularios por cliente (sprint 4d): un tipo de formulario definido como DATOS (JSON),
 * igual que las colecciones personalizadas. `buildFormValidator()` es la única función
 * que convierte la definición en validación: la recepción (POST /v1/formularios/:tipo)
 * y cualquier uso futuro pasan por ella.
 *
 * Pensado para el CRM del sprint 5: los tipos `email` y `phone` identifican sin
 * configuración extra qué campo de un envío es el correo o el teléfono del contacto.
 *
 * Formato y reglas: docs/decisiones.md, sección "Formularios (sprint 4d)".
 */
import { z } from 'zod';

export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'textLong', 'option'] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Alcances de una llave de API. Las llaves anteriores al sprint 4d quedan como solo lectura. */
export const API_KEY_SCOPES = [
  'contenido:leer',
  'formularios:enviar',
  'visitas:registrar',
  'agenda:reservar',
  // Sprint 13a: la vitrina del sitio (catálogo) y el carrito.
  'tienda:leer',
  'tienda:carrito',
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ['contenido:leer'];

export const FORM_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*$/;
const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-.\s]+$/;

/** Máximo por defecto de cada tipo cuando la definición no fija uno. */
export const FORM_DEFAULT_MAX: Record<FormFieldType, number> = {
  text: 200,
  email: 160,
  phone: 30,
  textLong: 2000,
  option: 80,
};
const ABSOLUTE_MAX = 5000;

export interface FormFieldInput {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  max?: number | undefined;
  options?: { value: string; label: string }[] | undefined;
}

const formFieldSchema = z.object({
  name: z
    .string()
    .regex(FIELD_NAME_PATTERN, 'El nombre del campo empieza con minúscula y solo lleva letras y números.'),
  label: z.string().trim().min(1, 'Escribe la etiqueta del campo.').max(80),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().default(false),
  max: z.number().int().positive().max(ABSOLUTE_MAX).optional(),
  options: z
    .array(z.object({ value: z.string().min(1).max(80), label: z.string().min(1).max(80) }))
    .max(50)
    .optional(),
});

export const formDefinitionSchema = z
  .object({
    key: z
      .string()
      .regex(FORM_KEY_PATTERN, 'La clave empieza con minúscula y solo lleva letras, números y guiones.')
      .max(40),
    label: z.string().trim().min(1, 'Escribe la etiqueta del formulario.').max(80),
    active: z.boolean().default(true),
    fields: z.array(formFieldSchema).min(1, 'Agrega al menos un campo.').max(30),
  })
  .strict()
  .superRefine((def, ctx) => {
    const seen = new Set<string>();
    def.fields.forEach((f, i) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path: ['fields', i, ...path], message });
      if (seen.has(f.name)) issue(['name'], `El campo "${f.name}" está repetido.`);
      seen.add(f.name);
      if (f.type === 'option') {
        if (!f.options?.length) issue(['options'], 'Un campo de opción necesita al menos una opción.');
        else if (new Set(f.options.map((o) => o.value)).size !== f.options.length)
          issue(['options'], 'Hay opciones con el mismo valor.');
      } else if (f.options) {
        issue(['options'], 'Solo los campos de tipo "option" llevan opciones.');
      }
    });
  });

export type FormDefinitionInput = z.input<typeof formDefinitionSchema>;
export type FormDefinition = z.output<typeof formDefinitionSchema>;

export interface FormIssue {
  path: string;
  message: string;
}

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, part) =>
      typeof part === 'number' ? `${acc}[${part}]` : acc ? `${acc}.${String(part)}` : String(part),
    '',
  );
}

export type ParsedFormDefinition =
  { ok: true; definition: FormDefinition } | { ok: false; issues: FormIssue[] };

/** Valida una definición recibida (JSON del editor o del paquete de migración). */
export function parseFormDefinition(input: unknown): ParsedFormDefinition {
  const parsed = formDefinitionSchema.safeParse(input);
  if (parsed.success) return { ok: true, definition: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({ path: formatPath(i.path), message: i.message })),
  };
}

export interface SubmissionIssue {
  field: string;
  message: string;
}

export type ValidatedSubmission =
  { ok: true; data: Record<string, string> } | { ok: false; errors: SubmissionIssue[] };

function fieldValidator(f: FormDefinition['fields'][number]): z.ZodType<string> {
  const max = f.max ?? FORM_DEFAULT_MAX[f.type];
  const tooLong = `Máximo ${max} caracteres.`;
  const base = z.string({ error: 'Debe ser texto.' }).trim();
  switch (f.type) {
    case 'email':
      return base
        .toLowerCase()
        .max(max, tooLong)
        .refine((v) => v === '' || EMAIL_PATTERN.test(v), 'Escribe un correo válido.');
    case 'phone':
      return base
        .max(max, tooLong)
        .refine((v) => v === '' || (PHONE_PATTERN.test(v) && v.length >= 6), 'Escribe un teléfono válido.');
    case 'option': {
      const allowed = new Set((f.options ?? []).map((o) => o.value));
      return base.refine((v) => v === '' || allowed.has(v), 'Elige una de las opciones disponibles.');
    }
    default:
      return base.max(max, tooLong);
  }
}

/**
 * Valida el cuerpo de un envío contra la definición: campos desconocidos rechazados,
 * obligatorios presentes, tipos y máximos respetados. Los opcionales vacíos no se guardan.
 * Devuelve TODOS los errores (uno por campo), no solo el primero.
 */
export function validateFormSubmission(def: FormDefinition, input: unknown): ValidatedSubmission {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return { ok: false, errors: [{ field: '', message: 'Los datos deben ser un objeto.' }] };

  const raw = input as Record<string, unknown>;
  const errors: SubmissionIssue[] = [];
  const known = new Set(def.fields.map((f) => f.name));
  for (const key of Object.keys(raw))
    if (!known.has(key)) errors.push({ field: key, message: 'Este campo no existe en el formulario.' });

  const data: Record<string, string> = {};
  for (const f of def.fields) {
    const value = raw[f.name];
    if (value === undefined || value === null) {
      if (f.required) errors.push({ field: f.name, message: 'Este campo es obligatorio.' });
      continue;
    }
    const parsed = fieldValidator(f).safeParse(value);
    if (!parsed.success) {
      errors.push({ field: f.name, message: parsed.error.issues[0]?.message ?? 'Valor no válido.' });
      continue;
    }
    if (parsed.data === '') {
      if (f.required) errors.push({ field: f.name, message: 'Este campo es obligatorio.' });
      continue;
    }
    data[f.name] = parsed.data;
  }
  return errors.length ? { ok: false, errors } : { ok: true, data };
}
