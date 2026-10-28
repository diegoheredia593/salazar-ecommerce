/**
 * Tipos del contrato PÚBLICO (sprint 4a) — deliberadamente independientes de los
 * esquemas zod internos del editor (packages/core/src/content/collections.ts): el
 * contrato que un sitio externo consume no debe atarse a cómo evoluciona el editor, y
 * este paquete no puede depender de zod (ver src/index.ts). Reflejan exactamente lo que
 * GET /v1/colecciones/... devuelve: relaciones ya resueltas a {slug,nombre}, fotos con
 * URL absoluta, nunca campos internos (state/scheduledAt/deletedAt/authorUserId).
 */

/** Una versión más angosta de una foto (webp), con URL absoluta. */
export interface VarianteFoto {
  src: string;
  width: number;
  height: number;
}

export interface Foto {
  src: string;
  width: number;
  height: number;
  alt: string;
  /**
   * Versiones de 480, 960 y/o 1600 px de ancho (nunca más anchas que el original), de menor a
   * mayor. Puede venir vacío (foto chica o aún sin procesar) y no existir en respuestas viejas.
   */
  variantes?: VarianteFoto[];
}

export interface VideoYoutube {
  id: string;
  title: string;
}

/** Texto enriquecido: el JSON estructurado (formato por defecto) o el HTML ya generado (?formato=html). */
export type TextoEnriquecido = unknown[] | string;

export interface Relacion {
  slug: string;
  nombre: string;
}

/** Campos comunes a todo elemento de una colección. */
export interface ElementoBase {
  id: string;
  slug: string | null;
  orden: number;
  creadoEn: string;
  actualizadoEn: string;
}

export type Disponibilidad = 'available' | 'out_of_stock' | 'on_request';

export interface Categoria extends ElementoBase {
  name: string;
}

export interface Producto extends ElementoBase {
  name: string;
  sku: string | null;
  category: Relacion | null;
  price: number | null;
  availability: Disponibilidad;
  shortDescription: string | null;
  fullDescription: TextoEnriquecido | null;
  mainPhoto: Foto | null;
  photos: Foto[];
  features: string[];
  featured: boolean;
}

export interface Promocion extends ElementoBase {
  title: string;
  product: Relacion | null;
  previousPrice: number;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  banner: Foto | null;
}

export interface Articulo extends ElementoBase {
  title: string;
  date: string;
  cover: Foto | null;
  summary: string;
  body: TextoEnriquecido;
  category: Relacion | null;
}

export interface AlbumGaleria extends ElementoBase {
  title: string;
  date: string;
  photos: Foto[];
  videos: VideoYoutube[];
}

export interface IntegranteEquipo extends ElementoBase {
  name: string;
  role: string;
  photo: Foto | null;
  bio: string | null;
}

export interface Testimonio extends ElementoBase {
  name: string;
  text: string;
  photo: Foto | null;
}

export interface PreguntaFrecuente extends ElementoBase {
  question: string;
  answer: TextoEnriquecido;
}

export interface Sucursal extends ElementoBase {
  name: string;
  address: string;
  phone: string | null;
  hours: string[];
  mapUrl: string | null;
}

/** Los nueve módulos, por su clave — mismas claves que packages/core/src/content/collections.ts. */
export interface Colecciones {
  categories: Categoria;
  products: Producto;
  promotions: Promocion;
  articles: Articulo;
  gallery: AlbumGaleria;
  team: IntegranteEquipo;
  testimonials: Testimonio;
  faq: PreguntaFrecuente;
  branches: Sucursal;
}

export type ClaveColeccion = keyof Colecciones;

/**
 * Elemento de una colección PERSONALIZADA del cliente (sprint 4b): además de los campos
 * comunes trae los que el superadmin definió, con los mismos formatos de siempre (fotos
 * con `src` absoluto, relaciones como `{slug, nombre}`, texto enriquecido JSON o HTML).
 * Sus campos no se conocen en tiempo de compilación, así que se tipan como registro
 * genérico; se puede acotar con un genérico propio en el sitio del cliente.
 */
export type ElementoPersonalizado = ElementoBase & Record<string, unknown>;

export interface Bloque {
  pagina: string;
  seccion: string;
  valor: unknown;
}
