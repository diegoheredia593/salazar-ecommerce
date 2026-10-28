/**
 * Imágenes responsivas (sprint 6a). Archivo SIN dependencias (solo tipos): es el que los sitios de
 * los clientes copian junto con `sdk.ts` y `tipos.ts` (ver README de cada sitio).
 */
import type { Foto } from './tipos';

export interface AtributosImagen {
  src: string;
  /** Solo cuando la foto tiene variantes: "url 480w, url 960w, …". */
  srcSet?: string;
  /** Solo junto con `srcSet`: el ancho con que se muestra la foto (por defecto "100vw"). */
  sizes?: string;
  width: number;
  height: number;
  alt: string;
  loading: 'lazy' | 'eager';
  decoding: 'async';
  fetchPriority?: 'high';
}

export interface OpcionesImagenResponsiva {
  /**
   * Atributo `sizes` del <img>: el ancho con que se muestra la foto según la pantalla, p. ej.
   * "(min-width: 1024px) 33vw, 100vw". Sin esto el navegador asume "100vw".
   */
  sizes?: string | undefined;
  /** La imagen principal de la página: se carga ya (sin lazy) y con prioridad alta. */
  prioritaria?: boolean | undefined;
}

/**
 * Atributos para un <img>. Si la foto trae `variantes`, devuelve también `srcSet` y `sizes`: el
 * navegador elige la más angosta que alcance. El original entra al `srcSet` solo si no pasa de
 * 1600 px (una foto de 4000 px nunca se ofrece entera). Sin variantes devuelve lo de siempre
 * (`src`, sin `srcSet`): un sitio que no las use, o una foto aún sin procesar, funciona igual.
 */
export function imagenResponsiva(imagen: Foto, opciones: OpcionesImagenResponsiva = {}): AtributosImagen {
  const atributos: AtributosImagen = {
    src: imagen.src,
    width: imagen.width,
    height: imagen.height,
    alt: imagen.alt,
    loading: opciones.prioritaria ? 'eager' : 'lazy',
    decoding: 'async',
  };
  if (opciones.prioritaria) atributos.fetchPriority = 'high';
  const variantes = imagen.variantes ?? [];
  if (variantes.length) {
    const candidatas = new Map<number, string>(variantes.map((v) => [v.width, v.src]));
    if (imagen.width <= MAX_ANCHO_SRCSET && !candidatas.has(imagen.width))
      candidatas.set(imagen.width, imagen.src);
    atributos.srcSet = [...candidatas]
      .sort(([a], [b]) => a - b)
      .map(([ancho, url]) => `${url} ${ancho}w`)
      .join(', ');
    atributos.sizes = opciones.sizes ?? '100vw';
  }
  return atributos;
}

const MAX_ANCHO_SRCSET = 1600;
