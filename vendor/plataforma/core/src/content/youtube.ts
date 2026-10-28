/**
 * Enlaces de YouTube: se acepta lo que la gente copia (del navegador, del botón
 * Compartir o de un Short) y se guarda solo el id de 11 caracteres. Portado de
 * fluvida-web/packages/cms-core/src/youtube.ts.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const DOMAINS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

/** Devuelve el id del video, o null si el texto no es un enlace válido de YouTube. */
export function extractYoutubeId(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!DOMAINS.has(host)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null | undefined;
  if (host.endsWith('youtu.be')) id = parts[0];
  else if (parts[0] === 'watch') id = url.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0] ?? '')) id = parts[1];
  else if (parts.length === 0) id = url.searchParams.get('v');

  return id && ID_PATTERN.test(id) ? id : null;
}

/** Miniatura pública (480×360; existe para todos los videos). */
export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Enlace para ver el video en YouTube. */
export function youtubeWatchUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Reproductor sin cookies de seguimiento, que empieza al cargarse. */
export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}
