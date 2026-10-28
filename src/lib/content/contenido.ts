// Lo que usan las páginas para leer bloques y colecciones. Las claves están tipadas (colecciones.generado.ts):
// una clave que no existe en bloques.json no compila.
import { textoEnriquecido, type Foto, type TextoEnriquecido } from '@plataforma/sdk';
import type { ClaveColeccionSitio, ClaveFoto, ClaveRico, ClaveTexto, ColeccionesSitio } from './colecciones.generado';
import { fuente } from './fuente';

export interface Contenido {
  /** Texto de un bloque ('' si está vacío). */
  texto(clave: ClaveTexto): string;
  /** HTML seguro de un bloque de texto enriquecido (lo genera la misma función que /v1 ?formato=html). */
  rico(clave: ClaveRico): string;
  foto(clave: ClaveFoto): Foto | null;
  coleccion<K extends ClaveColeccionSitio>(clave: K): Promise<ColeccionesSitio[K][]>;
}

export async function contenido(): Promise<Contenido> {
  const f = await fuente();
  const bloques = await f.bloques();
  const valor = (clave: string) => bloques[clave]?.valor ?? null;
  return {
    texto: (clave) => {
      const v = valor(clave);
      return typeof v === 'string' ? v : '';
    },
    rico: (clave) => {
      const v = valor(clave);
      return v ? textoEnriquecido(v as TextoEnriquecido) : '';
    },
    foto: (clave) => {
      const v = valor(clave);
      return v && typeof v === 'object' && 'src' in v ? (v as Foto) : null;
    },
    coleccion: (clave) => f.coleccion(clave),
  };
}

/** HTML de un campo de texto enriquecido de una colección ('' si está vacío). */
export const ricoDe = (valor: TextoEnriquecido | null | undefined): string => (valor ? textoEnriquecido(valor) : '');
