/**
 * Páginas del sitio por cliente (sprint UI-1). El portal ordena todo el contenido por
 * página de la web del cliente, no por "colección": cada cliente define sus páginas
 * (clave, nombre, ruta, orden) y asigna cada colección a una página principal y,
 * opcionalmente, a otras donde "también aparece" (solo informativo).
 *
 * Los bloques ya llevan la página en su clave (`catalogo.hero.titulo`); una página puede
 * declarar más prefijos de bloque (`blockPrefixes`) cuando el sitio nombró distinto la
 * página y sus textos (p. ej. `ayudar` y `donacion` en Fluvida). La página especial
 * `global` ("En todo el sitio") es fija: no se define ni se guarda.
 *
 * Formato y reglas: docs/decisiones.md, sección "Páginas del sitio (sprint UI-1)".
 */
import { z } from 'zod';

export const GLOBAL_PAGE_KEY = 'global';
export const PAGE_KEY_PATTERN = /^[a-z][a-z0-9]{0,39}$/;
const ROUTE_PATTERN = /^\/[a-zA-Z0-9\-_/]*$/;

export const sitePageSchema = z
  .object({
    key: z
      .string()
      .regex(PAGE_KEY_PATTERN, 'La clave empieza con minúscula y solo lleva letras minúsculas y números.')
      .refine((k) => k !== GLOBAL_PAGE_KEY, '"global" está reservada para "En todo el sitio".'),
    name: z.string().trim().min(1, 'Escribe el nombre de la página.').max(60),
    route: z
      .string()
      .regex(ROUTE_PATTERN, 'La ruta empieza con / y no lleva espacios (ej.: /catalogo).')
      .max(80),
    blockPrefixes: z
      .array(z.string().regex(PAGE_KEY_PATTERN, 'Prefijo de bloque no válido.'))
      .max(6)
      .optional(),
  })
  .strict();

export const collectionPageSchema = z
  .object({
    collection: z.string().min(1).max(60),
    page: z.string().regex(PAGE_KEY_PATTERN),
    alsoOn: z.array(z.string().regex(PAGE_KEY_PATTERN)).max(8).optional(),
  })
  .strict();

export const sitePagesDocumentSchema = z
  .object({
    pages: z.array(sitePageSchema).max(40),
    collections: z.array(collectionPageSchema).max(200),
  })
  .strict();

export type SitePageInput = z.infer<typeof sitePageSchema>;
export type CollectionPageInput = z.infer<typeof collectionPageSchema>;
export type SitePagesDocument = z.infer<typeof sitePagesDocumentSchema>;

export interface SitePagesIssue {
  path: string;
  message: string;
}

/** Valida forma y coherencia (claves únicas, páginas existentes). `knownCollections` se comprueba aparte. */
export function parseSitePagesDocument(
  input: unknown,
): { ok: true; document: SitePagesDocument } | { ok: false; issues: SitePagesIssue[] } {
  const parsed = sitePagesDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  const doc = parsed.data;
  const issues: SitePagesIssue[] = [];
  const keys = new Set<string>();
  const routes = new Set<string>();
  const prefixes = new Map<string, string>();
  doc.pages.forEach((p, i) => {
    if (keys.has(p.key))
      issues.push({ path: `pages.${i}.key`, message: `La página "${p.key}" está repetida.` });
    keys.add(p.key);
    if (routes.has(p.route))
      issues.push({ path: `pages.${i}.route`, message: `La ruta "${p.route}" está repetida.` });
    routes.add(p.route);
    for (const prefix of [p.key, ...(p.blockPrefixes ?? [])]) {
      const owner = prefixes.get(prefix);
      if (owner && owner !== p.key)
        issues.push({
          path: `pages.${i}.blockPrefixes`,
          message: `El prefijo "${prefix}" ya pertenece a la página "${owner}".`,
        });
      prefixes.set(prefix, p.key);
    }
  });
  const assigned = new Set<string>();
  doc.collections.forEach((c, i) => {
    if (assigned.has(c.collection))
      issues.push({ path: `collections.${i}.collection`, message: `"${c.collection}" está repetida.` });
    assigned.add(c.collection);
    if (!keys.has(c.page))
      issues.push({ path: `collections.${i}.page`, message: `La página "${c.page}" no está definida.` });
    (c.alsoOn ?? []).forEach((k, j) => {
      if (!keys.has(k))
        issues.push({ path: `collections.${i}.alsoOn.${j}`, message: `La página "${k}" no está definida.` });
      if (k === c.page)
        issues.push({
          path: `collections.${i}.alsoOn.${j}`,
          message: 'La página principal no va en "también aparece".',
        });
    });
  });
  return issues.length ? { ok: false, issues } : { ok: true, document: doc };
}

/** Página a la que pertenece un bloque, según su clave y los prefijos declarados. `global` si no hay página. */
export function pageKeyOfBlock(
  blockKey: string,
  pages: { key: string; blockPrefixes?: string[] | undefined }[],
): string {
  const prefix = blockKey.split('.')[0] ?? '';
  if (prefix === GLOBAL_PAGE_KEY) return GLOBAL_PAGE_KEY;
  const page = pages.find((p) => p.key === prefix || (p.blockPrefixes ?? []).includes(prefix));
  return page ? page.key : GLOBAL_PAGE_KEY;
}

// ---------------------------------------------------------------------------
// "Solicitar un cambio": campos nuevos (sprint UI-1)
// ---------------------------------------------------------------------------

export const CHANGE_REQUEST_TYPES = ['content', 'photos', 'design', 'broken', 'other'] as const;
export type ChangeRequestType = (typeof CHANGE_REQUEST_TYPES)[number];
export const CHANGE_REQUEST_TYPE_LABELS: Record<ChangeRequestType, string> = {
  content: 'Texto o contenido',
  photos: 'Fotos',
  design: 'Diseño',
  broken: 'Algo no funciona',
  other: 'Otro',
};
export const CHANGE_REQUEST_URGENCIES = ['normal', 'urgent'] as const;
export type ChangeRequestUrgency = (typeof CHANGE_REQUEST_URGENCIES)[number];
export const MAX_CHANGE_ATTACHMENTS = 3;
export const DEFAULT_RESPONSE_TIME = '1 día hábil';
