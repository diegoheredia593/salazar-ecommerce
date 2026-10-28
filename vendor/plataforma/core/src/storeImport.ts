/**
 * Importación masiva de la tienda (sprint 13b): el formato del paquete (`catalogo.json` + `fotos/` dentro de un .zip),
 * su validador y el plan de cada producto, más las reglas del Excel de precios y stock del portal. Todo PURO: lo usan
 * la consola (revisión y aplicación por lotes), el script `npm run tienda:validar` y los tests. La fuente de verdad
 * del formato para quien arma un paquete es docs/formato-importacion-tienda.md.
 *
 * El SKU es la llave: reimportar actualiza, nunca duplica. Los mensajes van en español y dicen qué producto, variante
 * o fila falla y por qué.
 */

import { formatMoneyExact } from './events';
import {
  PRODUCT_STATUS_LABELS,
  STORE_LIMITS,
  STORE_SLUG_PATTERN,
  comboKey,
  normalizeText,
  variantCombos,
  variantLabel,
  type ProductOption,
  type ProductStatus,
} from './store';
import { SHOWCASE_LIMITS, type ProductSpec } from './storefront';

export const STORE_IMPORT_VERSION = 1;
export const STORE_IMPORT_FILE = 'catalogo.json';
export const STORE_IMPORT_PHOTOS_DIR = 'fotos/';

export const STORE_IMPORT_LIMITS = {
  /** El .zip sube directo a R2 (no pasa por el Worker): hasta 2 GB. */
  packageMaxBytes: 2 * 1024 * 1024 * 1024,
  productsMax: 5000,
  categoriesMax: STORE_LIMITS.categoriesMax,
  /** Una foto más pesada que esto no se importa (aviso). */
  photoMaxBytes: 20 * 1024 * 1024,
  /** Más pesada que esto (el tope de la biblioteca de Fotos) se reduce a `photoReduceWidth` px al importar (aviso). */
  photoDirectBytes: 2 * 1024 * 1024,
  photoReduceWidth: 2000,
  /** «Deshacer esta importación» vale este tiempo desde que terminó. */
  undoHours: 24,
  excelMaxBytes: 5 * 1024 * 1024,
  excelRowsMax: 10_000,
} as const;

/** Crear y actualizar · Solo nuevos · Solo precios y stock. */
export const STORE_IMPORT_MODES = ['upsert', 'new_only', 'prices_stock'] as const;
export type StoreImportMode = (typeof STORE_IMPORT_MODES)[number];

export const STORE_IMPORT_MODE_LABELS: Record<StoreImportMode, string> = {
  upsert: 'Crear y actualizar',
  new_only: 'Solo nuevos',
  prices_stock: 'Solo precios y stock',
};

/** Avisos: no impiden importar; se muestran en la revisión. */
export const STORE_IMPORT_WARNING_KINDS = [
  'foto_faltante',
  'foto_grande',
  'precio_cero',
  'categoria_nueva',
  'precio_anterior',
  'fotos_de_mas',
  'archivo_ignorado',
] as const;
export type StoreImportWarningKind = (typeof STORE_IMPORT_WARNING_KINDS)[number];

export const STORE_IMPORT_WARNING_LABELS: Record<StoreImportWarningKind, string> = {
  foto_faltante: 'Foto faltante',
  foto_grande: 'Foto muy grande',
  precio_cero: 'Precio en 0',
  categoria_nueva: 'Categoría nueva',
  precio_anterior: 'Precio anterior ignorado',
  fotos_de_mas: 'Demasiadas fotos',
  archivo_ignorado: 'Archivo ignorado',
};

export interface StoreImportWarning {
  kind: StoreImportWarningKind;
  /** Qué producto, variante o archivo: «Producto 12 «Ron añejo»», «fotos/ron.jpg». */
  ref: string;
  message: string;
}

export interface StoreImportIssue {
  ref: string;
  message: string;
}

export interface ImportCategory {
  slug: string;
  name: string;
  /** Slug de la categoría padre (hasta dos niveles), o null. */
  parent: string | null;
}

export interface ImportVariant {
  sku: string;
  optionValues: string[];
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  /** Rutas dentro del zip (`fotos/…`), ya comprobadas: existen y se pueden importar. */
  photos: string[];
}

export interface ImportProduct {
  /** Posición en `productos` (0, 1, 2…). */
  index: number;
  ref: string;
  name: string;
  /** null = se calcula del nombre (y en una actualización se conserva la que ya tiene). */
  slug: string | null;
  shortDescription: string | null;
  description: string | null;
  /** Slug de la categoría (del paquete o ya existente en la tienda), o null. */
  category: string | null;
  status: Extract<ProductStatus, 'published' | 'draft'>;
  taxRateBp: number;
  weightGrams: number | null;
  specs: ProductSpec[];
  options: ProductOption[];
  variants: ImportVariant[];
  /** La galería del producto: las fotos de sus variantes, en orden y sin repetir (hasta 10). */
  photos: string[];
}

/** Lo que el validador necesita saber de cada archivo del zip (del directorio central; `head` = primeros bytes). */
export interface StoreImportFile {
  name: string;
  size: number;
  head?: Uint8Array | undefined;
}

export interface StoreImportPhotoInfo {
  path: string;
  size: number;
  /** Más pesada que `photoDirectBytes`: se reduce al importar. */
  reduce: boolean;
}

export interface ValidatedCatalog {
  categories: ImportCategory[];
  /** Solo los productos sin errores. */
  products: ImportProduct[];
  /** Las fotos que usan esos productos (ruta → tamaño). */
  photos: StoreImportPhotoInfo[];
  /** Errores de un producto: ese producto no se importa; el resto sí. */
  productErrors: StoreImportIssue[];
  /** Errores del paquete entero: mientras haya alguno no se importa nada. */
  fatal: StoreImportIssue[];
  warnings: StoreImportWarning[];
  /** Productos en el paquete (con y sin errores). */
  total: number;
}

// ---------------------------------------------------------------------------
// Archivos del zip
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Basura que dejan los compresores de macOS y Windows: se ignora sin aviso. */
export function isJunkFile(name: string): boolean {
  const base = name.split('/').pop() ?? '';
  return (
    name.startsWith('__MACOSX/') || base === '.DS_Store' || base === 'Thumbs.db' || base.startsWith('._')
  );
}

/** Ruta peligrosa dentro de un zip: absoluta, con `..`, con barra invertida, con unidad de Windows o caracteres de control. */
export function isUnsafeZipPath(name: string): boolean {
  if (!name || name.startsWith('/') || name.includes('\\') || /^[a-zA-Z]:/.test(name)) return true;
  // eslint-disable-next-line no-control-regex -- justamente se buscan caracteres de control
  if (/[\u0000-\u001f]/.test(name)) return true;
  return name.split('/').some((part) => part === '..' || part === '.');
}

export type SniffedImage = 'png' | 'jpeg' | 'webp';

const signature = (bytes: Uint8Array, offset: number, sig: number[]) =>
  sig.every((byte, i) => bytes[offset + i] === byte);

/** Firma binaria real (PNG, JPEG o WebP), o null. Nunca se confía en la extensión. */
export function sniffImageType(bytes: Uint8Array): SniffedImage | null {
  if (signature(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (signature(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (signature(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && signature(bytes, 8, [0x57, 0x45, 0x42, 0x50]))
    return 'webp';
  return null;
}

const mb = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString('es-EC', { maximumFractionDigits: 1 })} MB`;

/** `ron.jpg` o `fotos/ron.jpg` → `fotos/ron.jpg`. */
export const photoPathOf = (name: string): string =>
  name.startsWith(STORE_IMPORT_PHOTOS_DIR) ? name : `${STORE_IMPORT_PHOTOS_DIR}${name}`;

// ---------------------------------------------------------------------------
// Valores sueltos (compartidos con el Excel)
// ---------------------------------------------------------------------------

/**
 * Dinero escrito por una persona o por un script: 12.5, «12,50», «$ 1.250,00», «1250.00». Devuelve centavos, null si
 * está vacío o 'invalid'. Nunca acepta más de dos decimales ni negativos.
 */
export function parseMoney(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 'invalid';
    const cents = Math.round(value * 100);
    return Math.abs(value * 100 - cents) < 1e-6 ? cents : 'invalid';
  }
  if (typeof value !== 'string') return 'invalid';
  let text = value.replace(/[\s$]/g, '').replace(/USD/i, '');
  if (!text) return null;
  // «1.250,50» (miles con punto) o «1,250.50» (miles con coma): el último separador es el decimal.
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid';
  return parseMoney(Number(text));
}

/** Entero ≥ 0 (stock, peso): número o texto («12»). null si está vacío. */
export function parseCount(value: unknown, max: number): number | null | 'invalid' {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? (value.trim() ? Number(value.trim()) : NaN) : value;
  if (typeof value === 'string' && !value.trim()) return null;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > max) return 'invalid';
  return n;
}

/** «Publicado», «borrador», «Archivado» (o las claves en inglés) → el estado. */
export function parseProductStatus(value: unknown): ProductStatus | null {
  if (typeof value !== 'string') return null;
  const text = normalizeText(value);
  for (const [key, label] of Object.entries(PRODUCT_STATUS_LABELS))
    if (text === normalizeText(label) || text === key) return key as ProductStatus;
  return null;
}

// ---------------------------------------------------------------------------
// Validar catalogo.json
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Valida el paquete completo: `catalogo.json` (ya leído como JSON) contra la lista de archivos del zip. Lo que no se
 * puede leer o es peligroso va a `fatal`; lo que solo afecta a un producto, a `productErrors` (ese producto no se
 * importa). `knownCategories` = slugs de categorías que ya tiene la tienda (una referencia a ellas no es un error).
 */
export function validateStoreCatalog(
  json: unknown,
  files: StoreImportFile[],
  knownCategories: ReadonlySet<string> = new Set(),
): ValidatedCatalog {
  const fatal: StoreImportIssue[] = [];
  const productErrors: StoreImportIssue[] = [];
  const warnings: StoreImportWarning[] = [];
  const out: ValidatedCatalog = {
    categories: [],
    products: [],
    photos: [],
    productErrors,
    fatal,
    warnings,
    total: 0,
  };

  // 1. Archivos: rutas seguras, solo imágenes dentro de fotos/.
  const photoFiles = new Map<string, StoreImportFile>();
  for (const f of files) {
    if (isUnsafeZipPath(f.name)) {
      fatal.push({
        ref: f.name,
        message: 'Ruta peligrosa dentro del zip (absoluta o con «..»): no se importa nada.',
      });
      continue;
    }
    if (f.name.endsWith('/') || isJunkFile(f.name) || f.name === STORE_IMPORT_FILE) continue;
    if (!f.name.startsWith(STORE_IMPORT_PHOTOS_DIR)) {
      warnings.push({
        kind: 'archivo_ignorado',
        ref: f.name,
        message: `Está fuera de ${STORE_IMPORT_PHOTOS_DIR}; no se usa.`,
      });
      continue;
    }
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
      fatal.push({ ref: f.name, message: 'No es una imagen: en fotos/ solo van archivos JPG, PNG o WebP.' });
      continue;
    }
    if (f.head && f.size > 0 && !sniffImageType(f.head)) {
      fatal.push({
        ref: f.name,
        message: `Se llama .${ext} pero su contenido no es una imagen JPG, PNG ni WebP.`,
      });
      continue;
    }
    photoFiles.set(f.name, f);
  }

  if (!isObject(json)) {
    fatal.push({ ref: STORE_IMPORT_FILE, message: 'No tiene el formato esperado: debe ser un objeto JSON.' });
    return out;
  }
  if (json['version'] !== STORE_IMPORT_VERSION)
    fatal.push({
      ref: `${STORE_IMPORT_FILE} · version`,
      message: `La versión del formato debe ser ${STORE_IMPORT_VERSION}.`,
    });
  const rawProducts = json['productos'];
  if (!Array.isArray(rawProducts)) {
    fatal.push({ ref: `${STORE_IMPORT_FILE} · productos`, message: 'Falta la lista «productos».' });
    return out;
  }
  out.total = rawProducts.length;
  if (rawProducts.length > STORE_IMPORT_LIMITS.productsMax)
    fatal.push({
      ref: `${STORE_IMPORT_FILE} · productos`,
      message: `Trae ${rawProducts.length} productos; el máximo por paquete es ${STORE_IMPORT_LIMITS.productsMax}.`,
    });

  // 2. Categorías: hasta dos niveles, slugs únicos.
  const rawCategories = json['categorias'] ?? [];
  const categorySlugs = new Set<string>();
  if (!Array.isArray(rawCategories))
    fatal.push({ ref: `${STORE_IMPORT_FILE} · categorias`, message: '«categorias» debe ser una lista.' });
  else {
    if (rawCategories.length > STORE_IMPORT_LIMITS.categoriesMax)
      fatal.push({
        ref: `${STORE_IMPORT_FILE} · categorias`,
        message: `Hasta ${STORE_IMPORT_LIMITS.categoriesMax} categorías.`,
      });
    rawCategories.forEach((raw, i) => {
      const ref = `Categoría ${i + 1}`;
      if (!isObject(raw)) return fatal.push({ ref, message: 'Debe ser un objeto con «nombre».' });
      const name = text(raw['nombre']);
      if (!name || name.length > 60)
        return fatal.push({ ref, message: 'Escribe su «nombre» (de 1 a 60 caracteres).' });
      const slug = text(raw['slug']) ?? slugOf(name);
      if (!STORE_SLUG_PATTERN.test(slug))
        return fatal.push({
          ref: `${ref} «${name}»`,
          message: 'El «slug» solo lleva minúsculas, números y guiones.',
        });
      if (categorySlugs.has(slug))
        return fatal.push({ ref: `${ref} «${name}»`, message: `Hay dos categorías con el slug «${slug}».` });
      categorySlugs.add(slug);
      out.categories.push({ slug, name, parent: text(raw['padre']) });
      return undefined;
    });
    const bySlug = new Map(out.categories.map((c) => [c.slug, c]));
    for (const c of out.categories) {
      if (!c.parent) continue;
      const parent = bySlug.get(c.parent);
      if (!parent && !knownCategories.has(c.parent))
        fatal.push({
          ref: `Categoría «${c.name}»`,
          message: `Su «padre» («${c.parent}») no está en el paquete ni en la tienda.`,
        });
      else if (parent?.parent || c.parent === c.slug)
        fatal.push({
          ref: `Categoría «${c.name}»`,
          message: 'Las categorías van hasta dos niveles: el padre no puede tener a su vez un padre.',
        });
    }
  }

  // 3. Productos.
  const skuOwner = new Map<string, string>();
  const usedPhotos = new Map<string, StoreImportPhotoInfo>();
  const warnedPhotos = new Set<string>();
  rawProducts.forEach((raw, index) => {
    const before = productErrors.length;
    const product = parseProduct(raw, index, {
      productErrors,
      warnings,
      photoFiles,
      warnedPhotos,
      categorySlugs,
      knownCategories,
      skuOwner,
    });
    if (product && productErrors.length === before) {
      out.products.push(product);
      for (const p of product.photos) {
        const f = photoFiles.get(p)!;
        usedPhotos.set(p, { path: p, size: f.size, reduce: f.size > STORE_IMPORT_LIMITS.photoDirectBytes });
      }
    }
  });
  out.photos = [...usedPhotos.values()];
  return out;
}

const slugOf = (name: string) =>
  normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

interface ParseContext {
  productErrors: StoreImportIssue[];
  warnings: StoreImportWarning[];
  photoFiles: Map<string, StoreImportFile>;
  warnedPhotos: Set<string>;
  categorySlugs: Set<string>;
  knownCategories: ReadonlySet<string>;
  skuOwner: Map<string, string>;
}

function parseProduct(raw: unknown, index: number, ctx: ParseContext): ImportProduct | null {
  const baseRef = `Producto ${index + 1}`;
  const fail = (ref: string, message: string) => {
    ctx.productErrors.push({ ref, message });
    return null;
  };
  if (!isObject(raw)) return fail(baseRef, 'Debe ser un objeto con nombre y variantes.');
  const name = text(raw['nombre']);
  if (!name) return fail(baseRef, 'Le falta el «nombre».');
  const ref = `${baseRef} «${name}»`;
  if (name.length > STORE_LIMITS.nameMax)
    return fail(ref, `El nombre pasa de ${STORE_LIMITS.nameMax} caracteres.`);
  const errors: string[] = [];

  const slug = text(raw['slug']);
  if (slug && (!STORE_SLUG_PATTERN.test(slug) || slug.length > 80))
    errors.push('El «slug» solo lleva minúsculas, números y guiones (hasta 80).');
  const shortDescription = text(raw['descripcionCorta']);
  if (shortDescription && shortDescription.length > STORE_LIMITS.shortDescriptionMax)
    errors.push(`La «descripcionCorta» pasa de ${STORE_LIMITS.shortDescriptionMax} caracteres.`);
  const description = text(raw['descripcion']);
  if (description && description.length > STORE_LIMITS.descriptionMax)
    errors.push(`La «descripcion» pasa de ${STORE_LIMITS.descriptionMax} caracteres.`);

  const category = text(raw['categoria']);
  if (category && !ctx.categorySlugs.has(category) && !ctx.knownCategories.has(category))
    errors.push(`La categoría «${category}» no está en «categorias» ni en la tienda.`);

  const statusRaw = raw['estado'];
  const status = parseProductStatus(statusRaw);
  if (status !== 'published' && status !== 'draft')
    errors.push('El «estado» debe ser «Publicado» o «Borrador».');

  let taxRateBp = 1500;
  if (raw['iva'] !== undefined && raw['iva'] !== null) {
    if (raw['iva'] === 15 || raw['iva'] === 0) taxRateBp = raw['iva'] * 100;
    else errors.push('El «iva» es 15 o 0.');
  }

  const weight = parseCount(raw['pesoGramos'], STORE_LIMITS.weightMaxGrams);
  if (weight === 'invalid') errors.push('El «pesoGramos» es un número entero de gramos.');

  // Especificaciones: pares nombre/valor.
  const specs: ProductSpec[] = [];
  const rawSpecs = raw['especificaciones'] ?? [];
  if (!Array.isArray(rawSpecs)) errors.push('«especificaciones» debe ser una lista de { nombre, valor }.');
  else {
    if (rawSpecs.length > SHOWCASE_LIMITS.specsMax)
      errors.push(`Hasta ${SHOWCASE_LIMITS.specsMax} especificaciones.`);
    for (const s of rawSpecs.slice(0, SHOWCASE_LIMITS.specsMax)) {
      const label = isObject(s) ? text(s['nombre']) : null;
      const value = isObject(s)
        ? text(typeof s['valor'] === 'number' ? String(s['valor']) : s['valor'])
        : null;
      if (!label || !value) {
        errors.push('Cada especificación lleva «nombre» y «valor» (p. ej. Volumen: 750 ml).');
        break;
      }
      if (label.length > SHOWCASE_LIMITS.specLabelMax || value.length > SHOWCASE_LIMITS.specValueMax) {
        errors.push(`La especificación «${label}» es demasiado larga.`);
        break;
      }
      specs.push({ label, value });
    }
  }

  // Opciones.
  const options: ProductOption[] = [];
  const rawOptions = raw['opciones'] ?? [];
  if (!Array.isArray(rawOptions)) errors.push('«opciones» debe ser una lista de { nombre, valores }.');
  else {
    if (rawOptions.length > STORE_LIMITS.optionsMax)
      errors.push(`Hasta ${STORE_LIMITS.optionsMax} opciones.`);
    for (const o of rawOptions) {
      const optionName = isObject(o) ? text(o['nombre']) : null;
      const values = isObject(o) && Array.isArray(o['valores']) ? o['valores'].map((v) => text(v)) : null;
      if (
        !optionName ||
        optionName.length > 40 ||
        !values?.length ||
        values.some((v) => !v || v.length > 40)
      ) {
        errors.push('Cada opción lleva «nombre» y una lista de «valores» (hasta 40 caracteres cada uno).');
        break;
      }
      if (values.length > STORE_LIMITS.optionValuesMax)
        errors.push(`«${optionName}» tiene más de ${STORE_LIMITS.optionValuesMax} valores.`);
      if (new Set(values.map((v) => normalizeText(v!))).size !== values.length)
        errors.push(`«${optionName}» tiene valores repetidos.`);
      options.push({ name: optionName, values: values as string[] });
    }
    if (new Set(options.map((o) => normalizeText(o.name))).size !== options.length)
      errors.push('Dos opciones tienen el mismo nombre.');
  }

  // Variantes.
  const variants: ImportVariant[] = [];
  const rawVariants = raw['variantes'];
  const allowed = new Map(variantCombos(options).map((c) => [comboKey(c), c]));
  const seenCombos = new Set<string>();
  const productPhotos: string[] = [];
  if (!Array.isArray(rawVariants) || !rawVariants.length)
    errors.push('Le falta «variantes»: al menos una, con su SKU y su precio.');
  else if (rawVariants.length > STORE_LIMITS.variantsMax)
    errors.push(`Hasta ${STORE_LIMITS.variantsMax} variantes.`);
  else
    rawVariants.forEach((rv, vi) => {
      const vRef = `variante ${vi + 1}`;
      if (!isObject(rv)) return errors.push(`La ${vRef} debe ser un objeto.`);
      const sku = text(typeof rv['sku'] === 'number' ? String(rv['sku']) : rv['sku']);
      if (!sku)
        return errors.push(
          `La ${vRef} no tiene SKU: cada variante lleva el suyo (es la llave para reimportar).`,
        );
      const label = `SKU ${sku}`;
      if (sku.length > STORE_LIMITS.skuMax)
        return errors.push(`El ${label} pasa de ${STORE_LIMITS.skuMax} caracteres.`);
      const owner = ctx.skuOwner.get(sku);
      if (owner) return errors.push(`El ${label} se repite (ya lo usa ${owner}).`);
      ctx.skuOwner.set(sku, ref);

      const valuesRaw = rv['opciones'] ?? [];
      const values = Array.isArray(valuesRaw) ? valuesRaw.map((v) => text(v) ?? '') : null;
      if (!values || values.length !== options.length)
        return errors.push(
          options.length
            ? `El ${label} necesita un valor por opción (${options.map((o) => o.name).join(', ')}).`
            : `El ${label} no lleva «opciones»: el producto no tiene opciones.`,
        );
      const key = comboKey(values);
      const combo = allowed.get(key);
      if (!combo)
        return errors.push(`El ${label} dice «${variantLabel(values)}», que no está en las opciones.`);
      if (seenCombos.has(key)) return errors.push(`La combinación «${variantLabel(values)}» se repite.`);
      seenCombos.add(key);
      const optionValues = combo;

      const price = parseMoney(rv['precio']);
      if (price === null || price === 'invalid' || price > STORE_LIMITS.priceMaxCents)
        return errors.push(`El precio del ${label} no es válido (un número con hasta dos decimales).`);
      if (price === 0)
        ctx.warnings.push({ kind: 'precio_cero', ref: `${ref} · ${label}`, message: 'Tiene precio $0,00.' });
      let compareAt = parseMoney(rv['precioAnterior']);
      if (compareAt === 'invalid') return errors.push(`El precio anterior del ${label} no es válido.`);
      if (compareAt !== null && compareAt <= price) {
        ctx.warnings.push({
          kind: 'precio_anterior',
          ref: `${ref} · ${label}`,
          message: `El precio anterior (${formatMoneyExact(compareAt)}) no es mayor que el precio; se ignora.`,
        });
        compareAt = null;
      }
      const stock = parseCount(rv['stock'], STORE_LIMITS.stockMax);
      if (stock === 'invalid' || stock === null)
        return errors.push(`El stock del ${label} debe ser un número entero de 0 en adelante.`);

      const photos: string[] = [];
      const rawPhotos = rv['fotos'] ?? [];
      if (!Array.isArray(rawPhotos)) return errors.push(`Las «fotos» del ${label} van en una lista.`);
      for (const p of rawPhotos) {
        const name = text(p);
        if (!name) continue;
        const path = photoPathOf(name);
        const file = ctx.photoFiles.get(path);
        if (!file) {
          if (!ctx.warnedPhotos.has(`falta:${path}`)) {
            ctx.warnedPhotos.add(`falta:${path}`);
            ctx.warnings.push({
              kind: 'foto_faltante',
              ref: `${ref} · ${label}`,
              message: `${path} no está en el zip; el producto se importa sin ella.`,
            });
          }
          continue;
        }
        if (file.size > STORE_IMPORT_LIMITS.photoMaxBytes) {
          if (!ctx.warnedPhotos.has(`grande:${path}`)) {
            ctx.warnedPhotos.add(`grande:${path}`);
            ctx.warnings.push({
              kind: 'foto_grande',
              ref: path,
              message: `Pesa ${mb(file.size)}: no se importa (máximo ${mb(STORE_IMPORT_LIMITS.photoMaxBytes)}).`,
            });
          }
          continue;
        }
        if (file.size > STORE_IMPORT_LIMITS.photoDirectBytes && !ctx.warnedPhotos.has(`reduce:${path}`)) {
          ctx.warnedPhotos.add(`reduce:${path}`);
          ctx.warnings.push({
            kind: 'foto_grande',
            ref: path,
            message: `Pesa ${mb(file.size)}: se reduce a ${STORE_IMPORT_LIMITS.photoReduceWidth} px de ancho al importarla.`,
          });
        }
        if (!photos.includes(path)) photos.push(path);
        if (!productPhotos.includes(path)) productPhotos.push(path);
      }
      variants.push({ sku, optionValues, priceCents: price, compareAtCents: compareAt, stock, photos });
      return undefined;
    });

  if (!options.length && variants.length > 1)
    errors.push('Sin «opciones», el producto lleva una sola variante.');
  if (productPhotos.length > STORE_LIMITS.photosMax)
    ctx.warnings.push({
      kind: 'fotos_de_mas',
      ref,
      message: `Trae ${productPhotos.length} fotos; se importan las primeras ${STORE_LIMITS.photosMax}.`,
    });

  if (errors.length) {
    for (const message of errors) ctx.productErrors.push({ ref, message });
    return null;
  }
  return {
    index,
    ref,
    name,
    slug,
    shortDescription,
    description,
    category,
    status: status as 'published' | 'draft',
    taxRateBp,
    weightGrams: weight === null || weight === 'invalid' ? null : weight,
    specs,
    options,
    variants,
    photos: productPhotos.slice(0, STORE_LIMITS.photosMax),
  };
}

// ---------------------------------------------------------------------------
// Plan de cada producto (revisión y aplicación usan el MISMO cálculo)
// ---------------------------------------------------------------------------

export interface ExistingVariant {
  id: string;
  productId: string;
  sku: string;
  optionValues: string[];
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  /** Nombres originales de sus fotos («tienda:fotos/ron.jpg»). */
  photoNames: string[];
}

export interface ExistingProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  categorySlug: string | null;
  status: ProductStatus;
  taxRateBp: number;
  weightGrams: number | null;
  specs: ProductSpec[];
  options: ProductOption[];
  photoNames: string[];
  variants: ExistingVariant[];
}

export type ProductPlanAction = 'create' | 'update' | 'unchanged' | 'skip' | 'error';

export interface ProductPlan {
  action: ProductPlanAction;
  /** El producto de la tienda que se actualiza (update/unchanged). */
  productId: string | null;
  /** Por qué se omite o falla. */
  message?: string;
  /** Qué cambia, en corto («precio de SKU X», «fotos»), para la revisión. */
  changes: string[];
}

/** Nombre con el que se guarda en la biblioteca una foto importada (y con el que se reconoce al reimportar). */
export const importedPhotoName = (path: string): string => `tienda:${path}`;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Qué pasa con UN producto del paquete según el modo y lo que hay ahora en la tienda. `lookup` devuelve el producto
 * existente al que pertenece un SKU (o null). La revisión lo corre para todos; la aplicación lo vuelve a correr
 * producto por producto, con el estado de ese momento.
 */
export function planImportProduct(
  product: ImportProduct,
  mode: StoreImportMode,
  lookup: (sku: string) => ExistingProduct | null,
): ProductPlan {
  const owners = new Map<string, ExistingProduct>();
  for (const v of product.variants) {
    const owner = lookup(v.sku);
    if (owner) owners.set(owner.id, owner);
  }
  if (owners.size > 1)
    return {
      action: 'error',
      productId: null,
      changes: [],
      message: `Sus SKU están en ${owners.size} productos distintos de la tienda (${[...owners.values()]
        .map((p) => `«${p.name}»`)
        .join(', ')}).`,
    };
  const existing = [...owners.values()][0] ?? null;
  if (!existing) {
    if (mode === 'prices_stock')
      return {
        action: 'skip',
        productId: null,
        changes: [],
        message: 'Sus SKU no existen; en este modo no se crean productos.',
      };
    return { action: 'create', productId: null, changes: [] };
  }
  if (mode === 'new_only')
    return {
      action: 'skip',
      productId: existing.id,
      changes: [],
      message: 'Ya existe; en este modo no se toca.',
    };

  const bySku = new Map(existing.variants.map((v) => [v.sku, v]));
  const changes: string[] = [];
  for (const v of product.variants) {
    const old = bySku.get(v.sku);
    if (!old) {
      if (mode === 'upsert') changes.push(`variante nueva ${v.sku}`);
      continue;
    }
    if (old.priceCents !== v.priceCents) changes.push(`precio de ${v.sku}`);
    if (old.compareAtCents !== v.compareAtCents) changes.push(`precio anterior de ${v.sku}`);
    if (old.stock !== v.stock) changes.push(`stock de ${v.sku}`);
    if (mode === 'upsert') {
      if (!sameJson(old.optionValues, v.optionValues)) changes.push(`opciones de ${v.sku}`);
      if (!sameJson(old.photoNames, v.photos.map(importedPhotoName))) changes.push(`fotos de ${v.sku}`);
    }
  }
  if (mode === 'upsert') {
    // Variantes que la tienda tiene y el paquete no trae: se conservan, pero tienen que caber en las opciones nuevas.
    const allowed = new Set(variantCombos(product.options).map(comboKey));
    const listed = new Set(product.variants.map((v) => v.sku));
    const orphan = existing.variants.find(
      (v) => !listed.has(v.sku) && !allowed.has(comboKey(v.optionValues)),
    );
    if (orphan)
      return {
        action: 'error',
        productId: existing.id,
        changes: [],
        message: `La variante ${orphan.sku || variantLabel(orphan.optionValues)} de la tienda no está en el paquete y no cabe en las opciones nuevas. Inclúyela o quítala a mano antes.`,
      };
    const fields: [string, unknown, unknown][] = [
      ['nombre', existing.name, product.name],
      ['dirección', existing.slug, product.slug ?? existing.slug],
      ['descripción corta', existing.shortDescription, product.shortDescription],
      ['descripción', existing.description, product.description],
      ['categoría', existing.categorySlug, product.category],
      ['estado', existing.status, product.status],
      ['IVA', existing.taxRateBp, product.taxRateBp],
      ['peso', existing.weightGrams, product.weightGrams],
      ['especificaciones', existing.specs, product.specs],
      ['opciones', existing.options, product.options],
      ['fotos', existing.photoNames, product.photos.map(importedPhotoName)],
    ];
    for (const [label, a, b] of fields) if (!sameJson(a, b)) changes.push(label);
  }
  return { action: changes.length ? 'update' : 'unchanged', productId: existing.id, changes };
}

export interface StoreImportCounts {
  create: number;
  update: number;
  unchanged: number;
  skip: number;
  error: number;
}

export const emptyImportCounts = (): StoreImportCounts => ({
  create: 0,
  update: 0,
  unchanged: 0,
  skip: 0,
  error: 0,
});

// ---------------------------------------------------------------------------
// Excel de precios y stock (portal)
// ---------------------------------------------------------------------------

export const STORE_EXCEL_COLUMNS = [
  { key: 'sku', header: 'SKU', width: 18 },
  { key: 'product', header: 'Producto', width: 40 },
  { key: 'variant', header: 'Variante', width: 24 },
  { key: 'price', header: 'Precio', width: 12 },
  { key: 'compareAt', header: 'Precio anterior', width: 16 },
  { key: 'stock', header: 'Stock', width: 10 },
  { key: 'status', header: 'Estado', width: 14 },
] as const;
export type StoreExcelColumn = (typeof STORE_EXCEL_COLUMNS)[number]['key'];

export type ExcelCell = string | number | boolean | null;

export interface ExcelVariant {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  label: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  status: ProductStatus;
}

export interface ExcelVariantChange {
  variantId: string;
  productId: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
}

export interface ExcelPlan {
  variants: ExcelVariantChange[];
  statuses: { productId: string; status: ProductStatus }[];
  counts: { prices: number; compareAts: number; stocks: number; statuses: number; unchanged: number };
  /** SKU del Excel que no existen en ESTA tienda (nunca se crean). */
  unknownSkus: string[];
  /** Filas que no se aplican, con el porqué. */
  errors: { row: number; message: string }[];
  /** Filas con datos (sin el encabezado). */
  rows: number;
}

/** Busca cada columna por su encabezado (sin importar mayúsculas, tildes ni el orden). */
export function excelColumnIndexes(
  header: ExcelCell[],
): { ok: true; index: Record<StoreExcelColumn, number> } | { ok: false; missing: string[] } {
  const names = header.map((h) => (h === null ? '' : normalizeText(String(h))));
  const index = {} as Record<StoreExcelColumn, number>;
  const missing: string[] = [];
  for (const col of STORE_EXCEL_COLUMNS) {
    const i = names.indexOf(normalizeText(col.header));
    if (i < 0) missing.push(col.header);
    else index[col.key] = i;
  }
  return missing.length ? { ok: false, missing } : { ok: true, index };
}

/**
 * Compara las filas del Excel con la tienda. Solo cambia precio, precio anterior, stock y estado de SKU que YA existen
 * en esta tienda: nunca crea ni borra. Una fila con un error no se aplica (las demás sí); un SKU desconocido se lista.
 * El estado es del producto: dos filas del mismo producto con estados distintos son un error de ambas.
 */
export function planExcelUpdate(
  rows: ExcelCell[][],
  existing: ReadonlyMap<string, ExcelVariant>,
): ExcelPlan | { error: string } {
  const [header, ...body] = rows;
  if (!header) return { error: 'La hoja está vacía.' };
  const cols = excelColumnIndexes(header);
  if (!cols.ok)
    return { error: `Faltan columnas: ${cols.missing.join(', ')}. Usa el archivo de «Exportar a Excel».` };
  if (body.length > STORE_IMPORT_LIMITS.excelRowsMax)
    return { error: `La hoja tiene más de ${STORE_IMPORT_LIMITS.excelRowsMax} filas.` };
  const plan: ExcelPlan = {
    variants: [],
    statuses: [],
    counts: { prices: 0, compareAts: 0, stocks: 0, statuses: 0, unchanged: 0 },
    unknownSkus: [],
    errors: [],
    rows: 0,
  };
  const seen = new Set<string>();
  const statusOf = new Map<string, { status: ProductStatus; rows: number[] }>();
  const pending: { rowNumber: number; change: ExcelVariantChange; old: ExcelVariant }[] = [];
  const at = (row: ExcelCell[], key: StoreExcelColumn) => row[cols.index[key]] ?? null;

  body.forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((cell) => cell === null || String(cell).trim() === '')) return;
    plan.rows += 1;
    const sku = at(row, 'sku') === null ? '' : String(at(row, 'sku')).trim();
    const fail = (message: string) => plan.errors.push({ row: rowNumber, message });
    if (!sku) return fail('No tiene SKU.');
    if (seen.has(sku)) return fail(`El SKU ${sku} se repite en la hoja.`);
    seen.add(sku);
    const old = existing.get(sku);
    if (!old) return plan.unknownSkus.push(sku);
    const price = parseMoney(at(row, 'price'));
    if (price === null) return fail(`Falta el precio de ${sku}.`);
    if (price === 'invalid' || price > STORE_LIMITS.priceMaxCents)
      return fail(`El precio de ${sku} no es válido (un número con hasta dos decimales).`);
    const compareAt = parseMoney(at(row, 'compareAt'));
    if (compareAt === 'invalid') return fail(`El precio anterior de ${sku} no es válido.`);
    if (compareAt !== null && compareAt <= price)
      return fail(`El precio anterior de ${sku} tiene que ser mayor que el precio (o quedar vacío).`);
    const stock = parseCount(at(row, 'stock'), STORE_LIMITS.stockMax);
    if (stock === null) return fail(`Falta el stock de ${sku}.`);
    if (stock === 'invalid') return fail(`El stock de ${sku} debe ser un número entero de 0 en adelante.`);
    const status = parseProductStatus(at(row, 'status'));
    if (!status) return fail(`El estado de ${sku} debe ser Publicado, Borrador o Archivado.`);
    const entry = statusOf.get(old.productId);
    if (entry) {
      entry.rows.push(rowNumber);
      if (entry.status !== status) {
        fail(`«${old.productName}» tiene estados distintos en sus filas (${entry.rows.join(', ')}).`);
        entry.status = 'conflict' as ProductStatus;
        return undefined;
      }
    } else statusOf.set(old.productId, { status, rows: [rowNumber] });
    pending.push({
      rowNumber,
      old,
      change: {
        variantId: old.variantId,
        productId: old.productId,
        sku,
        priceCents: price,
        compareAtCents: compareAt,
        stock,
      },
    });
    return undefined;
  });

  const conflicted = new Set(
    [...statusOf.entries()].filter(([, v]) => (v.status as string) === 'conflict').map(([k]) => k),
  );
  for (const { change, old } of pending) {
    if (conflicted.has(change.productId)) continue;
    const priceChanged = old.priceCents !== change.priceCents;
    const compareChanged = old.compareAtCents !== change.compareAtCents;
    const stockChanged = old.stock !== change.stock;
    if (priceChanged) plan.counts.prices += 1;
    if (compareChanged) plan.counts.compareAts += 1;
    if (stockChanged) plan.counts.stocks += 1;
    if (priceChanged || compareChanged || stockChanged) plan.variants.push(change);
    else plan.counts.unchanged += 1;
  }
  const currentStatus = new Map([...existing.values()].map((v) => [v.productId, v.status]));
  for (const [productId, { status }] of statusOf)
    if (!conflicted.has(productId) && currentStatus.get(productId) !== status) {
      plan.statuses.push({ productId, status });
      plan.counts.statuses += 1;
    }
  return plan;
}
