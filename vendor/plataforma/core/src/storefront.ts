/**
 * Vitrina básica de la plataforma (sprint 13a-2): reglas PURAS de la tienda que sirve el Worker en `/tienda/<cliente>` para los
 * negocios sin sitio propio (el enlace va en su Instagram o su WhatsApp) y para probar la tienda. La vitrina a la
 * medida en el sitio del cliente (SDK) sigue siendo el modelo principal.
 *
 * Rutas: en PORTAL_HOST y en el dominio propio del portal `/tienda/<cliente>/…` (en el dominio propio, `/tienda` a secas
 * es la pantalla «Tienda» del portal); en el sitio del cliente (reenvío del SDK) `/tienda/…`. Lo que sigue es igual:
 * `/c/<categoría>`, `/p/<producto>`, `/carrito`, `/sitemap.xml` y la API del carrito de la propia vitrina.
 */

import { formatMoneyExact } from './events';

export const SHOWCASE_LIMITS = {
  titleMax: 80,
  welcomeMax: 300,
  announcementMax: 120,
  specsMax: 20,
  specLabelMax: 40,
  specValueMax: 200,
  /** La vista previa firmada de un borrador vale 24 h. */
  previewHours: 24,
  /** Productos por página del catálogo. */
  pageSize: 24,
} as const;

/** Una fila de «Especificaciones» del producto: «Origen · Vilcabamba, Loja». */
export interface ProductSpec {
  label: string;
  value: string;
}

export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialLinks = Partial<Record<SocialNetwork, string>>;

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const SOCIAL_HOSTS: Record<SocialNetwork, string> = {
  instagram: 'instagram.com',
  facebook: 'facebook.com',
  tiktok: 'tiktok.com',
};

/**
 * «@cumbrecafe», «cumbrecafe» o «https://instagram.com/cumbrecafe» → «https://www.instagram.com/cumbrecafe»; null si
 * no es una cuenta de ESA red (nunca se enlaza otra dirección desde el pie).
 */
export function socialUrl(network: SocialNetwork, value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const host = SOCIAL_HOSTS[network];
  let handle: string;
  if (/^https?:\/\//i.test(raw) || raw.toLowerCase().includes(`${host}/`)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
    const h = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    if (h !== host) return null;
    handle = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  } else handle = raw;
  handle = handle.replace(/^@/, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;
  return network === 'tiktok' ? `https://www.${host}/@${handle}` : `https://www.${host}/${handle}`;
}

/** Solo las redes que sirven, ya normalizadas. */
export function cleanSocialLinks(input: Partial<Record<string, unknown>>): SocialLinks {
  const out: SocialLinks = {};
  for (const network of SOCIAL_NETWORKS) {
    const value = input[network];
    if (typeof value !== 'string') continue;
    const url = socialUrl(network, value);
    if (url) out[network] = url;
  }
  return out;
}

/** Ajustes de la vitrina (las columnas nuevas de `store_settings`). */
export interface ShowcaseSettings {
  /** null = automático: encendida si el negocio NO tiene sitio propio («dominio de la tienda»). */
  showcaseEnabled: boolean | null;
  /** null = automático: se indexa (cuando la vitrina está encendida). */
  showcaseIndex: boolean | null;
  storeOrigin: string | null;
  announcementText: string | null;
  announcementEndsAt: Date | null;
}

/** ¿Se muestra la vitrina de la plataforma? Por defecto sí, salvo que el negocio tenga su sitio propio. */
export const showcaseOn = (s: Pick<ShowcaseSettings, 'showcaseEnabled' | 'storeOrigin'>): boolean =>
  s.showcaseEnabled ?? !s.storeOrigin;

/** «Indexar en buscadores»: encendido por defecto. */
export const showcaseIndexed = (s: Pick<ShowcaseSettings, 'showcaseIndex'>): boolean =>
  s.showcaseIndex ?? true;

/** La barra de anuncio, si hay texto y no pasó su fecha de fin. */
export function activeAnnouncement(
  s: Pick<ShowcaseSettings, 'announcementText' | 'announcementEndsAt'>,
  now: Date,
): string | null {
  const text = s.announcementText?.trim();
  if (!text) return null;
  if (s.announcementEndsAt && s.announcementEndsAt.getTime() <= now.getTime()) return null;
  return text;
}

/** Precio de la tarjeta: «$9,50» o, con variantes de distinto precio, «Desde $9,50». */
export function fromPriceText(minCents: number, maxCents: number): string {
  return minCents === maxCents ? formatMoneyExact(minCents) : `Desde ${formatMoneyExact(minCents)}`;
}

/** Cuánto falta para el envío gratis (null = no hay envío gratis o ya llegó). */
export function freeShippingGap(productsCents: number, freeFromCents: number | null): number | null {
  if (freeFromCents === null || freeFromCents <= 0) return null;
  const gap = freeFromCents - productsCents;
  return gap > 0 ? gap : null;
}

/** «Disponible · quedan 12», «Quedan 2», «Agotado». */
export function stockText(available: number): { text: string; level: 'ok' | 'low' | 'out' } {
  if (available <= 0) return { text: 'Agotado', level: 'out' };
  if (available <= 3) return { text: available === 1 ? 'Queda 1' : `Quedan ${available}`, level: 'low' };
  return { text: `Disponible · quedan ${available}`, level: 'ok' };
}

/** El mensaje prellenado de «Preguntar por WhatsApp». */
export function productAskText(product: string, variant: string, url: string): string {
  const what = variant ? `${product} (${variant})` : product;
  return `Hola, quiero preguntar por «${what}»: ${url}`;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

export type ShopRoute =
  | { page: 'home' }
  | { page: 'category'; slug: string }
  | { page: 'product'; slug: string }
  | { page: 'cart' }
  | { page: 'sitemap' }
  | { page: 'api' };

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Qué página es `rest` (lo que sigue a `/tienda` o a `/tienda/<cliente>`, sin la barra final). null = no existe.
 */
export function parseShopPath(rest: string): ShopRoute | null {
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'home' };
  const [a, b] = parts;
  if (parts.length === 1 && a === 'carrito') return { page: 'cart' };
  if (parts.length === 1 && a === 'sitemap.xml') return { page: 'sitemap' };
  if (parts.length === 2 && a === 'api' && b === 'carrito') return { page: 'api' };
  if (parts.length === 2 && a === 'c' && b && SEGMENT.test(b)) return { page: 'category', slug: b };
  if (parts.length === 2 && a === 'p' && b && SEGMENT.test(b)) return { page: 'product', slug: b };
  return null;
}
