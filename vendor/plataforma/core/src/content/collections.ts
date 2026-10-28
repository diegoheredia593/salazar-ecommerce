/**
 * Registro de las 9 colecciones del sprint 3 — compartido por todos los clientes.
 * Lo que varía por cliente es solo qué colecciones están activas (tenant_modules,
 * clave "content:<key>") y los valores (tabla items). Agregar una colección 10 en el
 * futuro es agregar una entrada aquí: sin migración ni pantalla nueva (sección 5 del
 * encargo).
 */
import { z } from 'zod';
import {
  imageSchema,
  richTextSchema,
  withItemBase,
  youtubeVideoSchema,
  type CollectionDefinition,
} from './schema';

const featuredSchema = z.boolean().default(false).meta({ label: 'Destacado' });

// ─── Categorías ──────────────────────────────────────────────────────────
// (declarada antes que Productos: Productos la referencia como relación)

const categorySchema = withItemBase({
  name: z.string().trim().min(2).max(80).meta({ label: 'Nombre' }),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .meta({ control: 'slug', from: 'name', label: 'Dirección' }),
});

export const categoriesCollection: CollectionDefinition<typeof categorySchema> = {
  key: 'categories',
  schema: categorySchema,
  label: 'Categorías',
  singular: 'categoría',
  gender: 'f',
  description: 'Agrupan los productos del catálogo.',
  titleField: 'name',
  searchFields: ['name'],
  sortBy: 'order',
  slugField: 'slug',
  group: 'Catálogo',
};

// ─── Productos ───────────────────────────────────────────────────────────

const AVAILABILITY_OPTIONS = {
  available: 'Disponible',
  out_of_stock: 'Agotado',
  on_request: 'Bajo pedido',
} as const;

const productSchema = withItemBase({
  name: z.string().trim().min(2).max(120).meta({ label: 'Nombre' }),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .meta({ control: 'slug', from: 'name', label: 'Dirección' }),
  sku: z.string().trim().max(40).nullable().meta({ label: 'SKU' }),
  category: z
    .string()
    .nullable()
    .meta({ label: 'Categoría', relation: { collection: 'categories', value: 'slug', label: 'name' } }),
  /** Vacío = "Consultar precio". */
  price: z
    .number()
    .positive()
    .nullable()
    .meta({ label: 'Precio', help: 'Déjalo vacío para mostrar "Consultar precio".' }),
  availability: z.enum(Object.keys(AVAILABILITY_OPTIONS) as (keyof typeof AVAILABILITY_OPTIONS)[]).meta({
    label: 'Disponibilidad',
    options: AVAILABILITY_OPTIONS,
  }),
  shortDescription: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .meta({ control: 'textLong', label: 'Descripción corta' }),
  fullDescription: richTextSchema.nullable().meta({ label: 'Descripción completa', max: 3000 }),
  mainPhoto: imageSchema.nullable().meta({ label: 'Foto principal', aspectRatio: '1:1' }),
  photos: z.array(imageSchema).max(12).meta({ label: 'Más fotos' }),
  features: z.array(z.string().trim().max(80)).max(20).meta({ label: 'Características' }),
  featured: featuredSchema,
});

export const productsCollection: CollectionDefinition<typeof productSchema> = {
  key: 'products',
  schema: productSchema,
  label: 'Productos',
  singular: 'producto',
  gender: 'm',
  description: 'El catálogo del cliente.',
  titleField: 'name',
  searchFields: ['name', 'sku'],
  sortBy: 'order',
  slugField: 'slug',
  group: 'Catálogo',
};

// ─── Promociones ─────────────────────────────────────────────────────────

const promotionSchema = withItemBase({
  title: z.string().trim().min(2).max(120).meta({ label: 'Título' }),
  product: z
    .string()
    .nullable()
    .meta({
      label: 'Producto relacionado',
      relation: { collection: 'products', value: 'slug', label: 'name' },
    }),
  previousPrice: z.number().positive().meta({ label: 'Precio anterior' }),
  salePrice: z.number().positive().meta({ label: 'Precio de oferta' }),
  startsAt: z.string().meta({ control: 'date', label: 'Inicio' }),
  endsAt: z.string().meta({ control: 'date', label: 'Fin' }),
  banner: imageSchema.nullable().meta({ label: 'Banner', aspectRatio: '16:9' }),
});

export const promotionsCollection: CollectionDefinition<typeof promotionSchema> = {
  key: 'promotions',
  schema: promotionSchema,
  label: 'Promociones',
  singular: 'promoción',
  gender: 'f',
  description: 'Ofertas por tiempo limitado, con precio anterior y de oferta.',
  titleField: 'title',
  searchFields: ['title'],
  sortBy: { field: 'startsAt' },
  group: 'Catálogo',
};

/** Estado visible en la lista: activa/próxima/vencida — se calcula, nunca se guarda. */
export type PromotionStatus = 'upcoming' | 'active' | 'expired';
export function promotionStatus(startsAt: string, endsAt: string, now: Date = new Date()): PromotionStatus {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'active';
}

// ─── Artículos ───────────────────────────────────────────────────────────

const articleSchema = withItemBase({
  title: z.string().trim().min(2).max(160).meta({ label: 'Título' }),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .meta({ control: 'slug', from: 'title', label: 'Dirección' }),
  date: z.string().meta({ control: 'date', label: 'Fecha' }),
  cover: imageSchema.nullable().meta({ label: 'Portada', aspectRatio: '16:9' }),
  summary: z.string().trim().max(300).meta({ control: 'textLong', label: 'Resumen' }),
  body: richTextSchema.meta({ label: 'Texto', max: 8000 }),
  category: z
    .string()
    .nullable()
    .meta({ label: 'Categoría', relation: { collection: 'categories', value: 'slug', label: 'name' } }),
});

export const articlesCollection: CollectionDefinition<typeof articleSchema> = {
  key: 'articles',
  schema: articleSchema,
  label: 'Artículos',
  singular: 'artículo',
  gender: 'm',
  description: 'Noticias y novedades del sitio.',
  titleField: 'title',
  searchFields: ['title', 'summary'],
  sortBy: { field: 'date' },
  slugField: 'slug',
  group: 'Contenido',
};

// ─── Galería ─────────────────────────────────────────────────────────────

const gallerySchema = withItemBase({
  title: z.string().trim().min(2).max(120).meta({ label: 'Título' }),
  date: z.string().meta({ control: 'date', label: 'Fecha' }),
  photos: z.array(imageSchema).max(60).meta({ label: 'Fotos' }),
  videos: z.array(youtubeVideoSchema).max(20).meta({ label: 'Videos de YouTube' }),
});

export const galleryCollection: CollectionDefinition<typeof gallerySchema> = {
  key: 'gallery',
  schema: gallerySchema,
  label: 'Galería',
  singular: 'álbum',
  gender: 'm',
  description: 'Álbumes de fotos y videos.',
  titleField: 'title',
  searchFields: ['title'],
  sortBy: { field: 'date' },
  group: 'Contenido',
};

// ─── Equipo ──────────────────────────────────────────────────────────────

const teamSchema = withItemBase({
  name: z.string().trim().min(2).max(80).meta({ label: 'Nombre' }),
  role: z.string().trim().min(2).max(80).meta({ label: 'Cargo' }),
  photo: imageSchema.nullable().meta({ label: 'Foto', aspectRatio: '1:1' }),
  bio: z.string().trim().max(600).nullable().meta({ control: 'textLong', label: 'Biografía' }),
});

export const teamCollection: CollectionDefinition<typeof teamSchema> = {
  key: 'team',
  schema: teamSchema,
  label: 'Equipo',
  singular: 'integrante',
  gender: 'm',
  description: 'Quiénes forman el equipo.',
  titleField: 'name',
  searchFields: ['name', 'role'],
  sortBy: 'order',
  group: 'Sobre el negocio',
};

// ─── Testimonios ─────────────────────────────────────────────────────────

const testimonialSchema = withItemBase({
  name: z.string().trim().min(2).max(80).meta({ label: 'Nombre' }),
  text: z.string().trim().min(2).max(600).meta({ control: 'textLong', label: 'Texto' }),
  photo: imageSchema.nullable().meta({ label: 'Foto', aspectRatio: '1:1' }),
});

export const testimonialsCollection: CollectionDefinition<typeof testimonialSchema> = {
  key: 'testimonials',
  schema: testimonialSchema,
  label: 'Testimonios',
  singular: 'testimonio',
  gender: 'm',
  description: 'Lo que dicen los clientes.',
  titleField: 'name',
  searchFields: ['name', 'text'],
  sortBy: 'order',
  group: 'Sobre el negocio',
};

// ─── Preguntas frecuentes ────────────────────────────────────────────────

const faqSchema = withItemBase({
  question: z.string().trim().min(2).max(160).meta({ label: 'Pregunta' }),
  answer: richTextSchema.meta({ label: 'Respuesta', max: 2000 }),
});

export const faqCollection: CollectionDefinition<typeof faqSchema> = {
  key: 'faq',
  schema: faqSchema,
  label: 'Preguntas frecuentes',
  singular: 'pregunta',
  gender: 'f',
  description: 'Preguntas y respuestas comunes.',
  titleField: 'question',
  searchFields: ['question'],
  sortBy: 'order',
  group: 'Sobre el negocio',
};

// ─── Sucursales ──────────────────────────────────────────────────────────

const branchSchema = withItemBase({
  name: z.string().trim().min(2).max(80).meta({ label: 'Nombre' }),
  address: z.string().trim().min(2).max(200).meta({ control: 'textLong', label: 'Dirección' }),
  phone: z.string().trim().max(30).nullable().meta({ label: 'Teléfono' }),
  hours: z.array(z.string().trim().max(80)).max(14).meta({ label: 'Horario' }),
  mapUrl: z.url().nullable().meta({ label: 'Enlace de mapa' }),
});

export const branchesCollection: CollectionDefinition<typeof branchSchema> = {
  key: 'branches',
  schema: branchSchema,
  label: 'Sucursales',
  singular: 'sucursal',
  gender: 'f',
  description: 'Direcciones y horarios de cada local.',
  titleField: 'name',
  searchFields: ['name', 'address'],
  sortBy: 'order',
  group: 'Sobre el negocio',
};

// ─── Registro ────────────────────────────────────────────────────────────

export const COLLECTIONS: readonly CollectionDefinition[] = [
  categoriesCollection as CollectionDefinition,
  productsCollection as CollectionDefinition,
  promotionsCollection as CollectionDefinition,
  articlesCollection as CollectionDefinition,
  galleryCollection as CollectionDefinition,
  teamCollection as CollectionDefinition,
  testimonialsCollection as CollectionDefinition,
  faqCollection as CollectionDefinition,
  branchesCollection as CollectionDefinition,
];

const BY_KEY = new Map(COLLECTIONS.map((c) => [c.key, c]));

/** Claves de las colecciones fijas: una colección personalizada no puede usarlas. */
export const RESERVED_COLLECTION_KEYS: readonly string[] = COLLECTIONS.map((c) => c.key);

export const CONTENT_MODULE_PREFIX = 'content:';

/** null = la clave no corresponde a ninguna colección declarada. */
export function collectionByKey(key: string): CollectionDefinition | null {
  return BY_KEY.get(key) ?? null;
}

/** Clave de tenant_modules para activar/desactivar una colección concreta. */
export function contentModuleKey(collectionKey: string): string {
  return `${CONTENT_MODULE_PREFIX}${collectionKey}`;
}
