// Solo el tipo (se borra al compilar): schema.ts depende de zod, que nunca llega al sitio.
import type { RichText } from '../../../vendor/plataforma/core/src/content/schema';

/**
 * Texto enriquecido escrito como texto plano en plataforma/ (párrafos separados por una línea vacía; listas con
 * líneas que empiezan con «- ») → el RichText que guarda la plataforma. Lo usan el paquete de importación y el modo
 * semilla, para que los dos entreguen lo mismo que /v1.
 */
export function aTextoEnriquecido(texto: string): RichText {
  if (!texto.trim()) return [];
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map((bloque) => {
      const lineas = bloque.split('\n').map((l) => l.trim());
      if (lineas.every((l) => l.startsWith('- '))) {
        return { type: 'list' as const, ordered: false, items: lineas.map((l) => [{ text: l.slice(2) }]) };
      }
      return { type: 'paragraph' as const, content: [{ text: lineas.join(' ') }] };
    });
}
