/**
 * Utilidades de presentación. `textoEnriquecidoAHtml` importa la MISMA función que usa
 * el servidor para `?formato=html` (packages/core/src/content/richText.ts, subruta
 * `@plataforma/core/content/richText` — sin zod, cero dependencias en tiempo de
 * ejecución) — nunca una copia: así nunca hay dos lugares donde el HTML pueda drift.
 */
import { richTextToHtml } from '@plataforma/core/content/richText';
import { youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl } from '@plataforma/core/content/youtube';
import type { TextoEnriquecido, VideoYoutube } from './tipos';

export * from './imagen';

export { richTextToHtml as textoEnriquecidoAHtml };

/**
 * Si `valor` ya viene como HTML (se pidió `?formato=html` al servidor), se devuelve tal
 * cual; si viene como el JSON estructurado (formato por defecto), se convierte aquí
 * mismo, en el cliente, con la misma lógica.
 */
export function textoEnriquecido(valor: TextoEnriquecido): string {
  return typeof valor === 'string' ? valor : richTextToHtml(valor as never);
}

export interface VideoDiferido {
  thumbnail: string;
  embedUrl: string;
  watchUrl: string;
  title: string;
}

/** Miniatura + enlaces de un video de YouTube, listos para un reproductor diferido (nunca carga el iframe hasta que el visitante haga clic). */
export function videoYoutubeDiferido(video: VideoYoutube): VideoDiferido {
  return {
    thumbnail: youtubeThumbnail(video.id),
    embedUrl: youtubeEmbedUrl(video.id),
    watchUrl: youtubeWatchUrl(video.id),
    title: video.title,
  };
}
