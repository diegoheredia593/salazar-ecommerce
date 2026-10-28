// Genera src/lib/content/colecciones.generado.ts a partir de plataforma/colecciones/*.json. Con esos tipos, el
// compilador (astro check) falla si el código lee un campo que no existe en la definición de su colección.
import type { Bloque, Campo, Coleccion } from './modelo.ts';

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function tipoDe(c: Campo, sangria: string): string {
  const nulo = (t: string) => (c.required ? t : `${t} | null`);
  const union = () => (c.options ?? []).map((o) => JSON.stringify(o.value)).join(' | ');
  switch (c.control) {
    case 'text': case 'textLong': case 'date': case 'url': case 'link': return nulo('string');
    case 'slug': return nulo('string');
    case 'option': return nulo(union());
    case 'options': return `(${union()})[]`;
    case 'number': return nulo('number');
    case 'checkbox': return 'boolean';
    case 'textList': return 'string[]';
    case 'image': return nulo('Foto');
    case 'gallery': return 'Foto[]';
    case 'rich': return nulo('TextoEnriquecido');
    case 'video_youtube': return nulo('VideoYoutube');
    case 'videos_youtube': return 'VideoYoutube[]';
    case 'relation': return nulo('Relacion');
    case 'group': return `{\n${campos((c as Campo & { fields?: Campo[] }).fields ?? [], `${sangria}  `)}${sangria}}`;
    default: return 'unknown';
  }
}

function campos(lista: Campo[], sangria: string): string {
  return lista.map((c) => `${sangria}${c.name}: ${tipoDe(c, sangria)};\n`).join('');
}

export function generarTipos(colecciones: Coleccion[], bloques: Bloque[]): string {
  const ordenadas = [...colecciones].sort((a, b) => a.key.localeCompare(b.key));
  const interfaces = ordenadas
    .map((c) => `/** ${c.label}: ${c.description} */\nexport interface Elemento${pascal(c.key)} extends ElementoBase {\n${campos(c.fields, '  ')}}\n`)
    .join('\n');
  const mapa = ordenadas.map((c) => `  ${c.key}: Elemento${pascal(c.key)};\n`).join('');
  const usados = ['ElementoBase', 'Foto', 'Relacion', 'TextoEnriquecido', 'VideoYoutube'].filter(
    (t) => t === 'ElementoBase' || new RegExp(`\\b${t}\\b`).test(interfaces),
  );
  return (
    '// ARCHIVO GENERADO por `npm run verificar-modelo -- --escribir` a partir de plataforma/colecciones/*.json.\n' +
    '// No se edita a mano: se cambia la definición y se vuelve a generar.\n' +
    `import type { ${usados.join(', ')} } from '@plataforma/sdk';\n\n` +
    interfaces +
    `\nexport interface ColeccionesSitio {\n${mapa}}\n\nexport type ClaveColeccionSitio = keyof ColeccionesSitio;\n` +
    `\n/** Las claves de bloques.json, por control. */\n` +
    porControl(bloques)
  );
}

function porControl(bloques: Bloque[]): string {
  const grupos: [string, Bloque['control'][]][] = [
    ['ClaveTexto', ['text', 'textLong', 'url']],
    ['ClaveRico', ['rich']],
    ['ClaveFoto', ['image']],
  ];
  return grupos
    .map(([nombre, controles]) => {
      const claves = bloques.filter((b) => controles.includes(b.control)).map((b) => JSON.stringify(b.key)).sort();
      return `export type ${nombre} =\n${claves.map((c) => `  | ${c}`).join('\n') || '  never'};\n`;
    })
    .join('');
}
