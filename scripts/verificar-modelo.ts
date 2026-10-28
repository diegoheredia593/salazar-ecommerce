// npm run verificar-modelo — falla si el modelo (plataforma/) o el código del sitio (src/) no cuadran.
// Las definiciones se validan con los esquemas de la plataforma (vendor/plataforma/core); lo que esos esquemas no
// cubren (claves de bloque, fotos en disco, uso en el código) se comprueba aquí. Lo de src/ se activa en la Fase 2.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildCollectionDefinition, parseCustomDefinition } from '../vendor/plataforma/core/src/content/custom.ts';
import { validateBlockValue } from '../vendor/plataforma/core/src/content/schema.ts';
import { parseFormDefinition } from '../vendor/plataforma/core/src/forms.ts';
import { GLOBAL_PAGE_KEY, pageKeyOfBlock, parseSitePagesDocument } from '../vendor/plataforma/core/src/sitePages.ts';
import {
  PLATAFORMA, RAIZ, TOPE_FOTO, datosDeElemento, esFoto, esPendiente, fotosEn, leerModelo, valorDeBloque,
  type Foto,
} from './lib/modelo.ts';
import { generarTipos } from './lib/tipos.ts';

const PATRON_CLAVE_BLOQUE = /^[a-z0-9][a-zA-Z0-9]*\.[a-z0-9][a-zA-Z0-9]*\.[a-z0-9][a-zA-Z0-9]*$/;

const errores: string[] = [];
const pendientes: string[] = [];
const error = (m: string) => errores.push(m);

const modelo = leerModelo();
const colecciones = new Map(modelo.colecciones.map((c) => [c.key, c]));

// Páginas (sitePages.ts)
const paginasDoc = parseSitePagesDocument(modelo.paginas);
if (!paginasDoc.ok) for (const i of paginasDoc.issues) error(`paginas.json ${i.path}: ${i.message}`);
for (const a of modelo.paginas.collections) {
  if (!colecciones.has(a.collection)) error(`paginas.json asigna «${a.collection}», que no tiene definición.`);
}
const asignadas = new Set(modelo.paginas.collections.map((a) => a.collection));
for (const c of modelo.colecciones) if (!asignadas.has(c.key)) error(`La colección «${c.key}» no tiene página en paginas.json.`);

// Colecciones (custom.ts)
for (const c of modelo.colecciones) {
  const r = parseCustomDefinition(c);
  if (!r.ok) for (const e of r.errors) error(`colecciones/${c.key}.json ${e.path}: ${e.message}`);
}

// Formularios (forms.ts)
for (const f of modelo.formularios) {
  const r = parseFormDefinition(f);
  if (!r.ok) for (const i of r.issues) error(`formularios/${f.key}.json ${i.path}: ${i.message}`);
  if (!f.fields.some((c) => c.type === 'email' || c.type === 'phone')) {
    error(`formularios/${f.key}.json: necesita un campo email o phone para que el CRM cree el contacto.`);
  }
}

// Bloques (schema.ts + reglas del prompt maestro)
const claves = new Set<string>();
for (const b of modelo.bloques) {
  const donde = `Bloque «${b.key}»`;
  if (!PATRON_CLAVE_BLOQUE.test(b.key)) error(`${donde}: la clave no cumple pagina.seccion.campo.`);
  if (claves.has(b.key)) error(`${donde}: repetido.`);
  claves.add(b.key);
  const [prefijo, seccion] = b.key.split('.');
  if (b.page !== prefijo || b.section !== seccion) error(`${donde}: page/section no coinciden con la clave.`);
  if (prefijo !== GLOBAL_PAGE_KEY && pageKeyOfBlock(b.key, modelo.paginas.pages) === GLOBAL_PAGE_KEY) {
    error(`${donde}: «${prefijo}» no es una página ni un blockPrefixes de paginas.json.`);
  }
  if (!b.label?.trim()) error(`${donde}: sin etiqueta para el portal.`);
  if (esPendiente(b.value)) {
    pendientes.push(b.key);
    continue; // un [PENDIENTE] puede pasar del largo máximo: se reemplaza antes de publicar
  }
  const problema = validateBlockValue({ ...b, value: valorDeBloque(b) });
  if (problema) error(`${donde}: ${problema}`);
}
for (const p of modelo.paginas.pages) {
  for (const campo of ['titulo', 'descripcion']) {
    if (!claves.has(`${p.key}.seo.${campo}`)) error(`Falta el bloque ${p.key}.seo.${campo}.`);
  }
}

// Semilla: cada elemento contra el esquema de su colección (el mismo que valida el portal)
for (const [clave, lista] of Object.entries(modelo.semilla)) {
  const def = colecciones.get(clave);
  if (!def) {
    error(`semilla/${clave}.json no tiene definición de colección.`);
    continue;
  }
  if (!parseCustomDefinition(def).ok) continue; // ya se reportó arriba
  const esquema = buildCollectionDefinition(def).schema.omit({
    id: true, state: true, order: true, createdAt: true, updatedAt: true,
  });
  const ids = new Set<string>();
  for (const e of lista) {
    const donde = `semilla/${clave} «${e.idOrigen}»`;
    if (!e.idOrigen || ids.has(e.idOrigen)) error(`${donde}: idOrigen vacío o repetido.`);
    ids.add(e.idOrigen);
    const extra = Object.keys(e.datos).filter((k) => !def.fields.some((f) => f.name === k));
    for (const k of extra) error(`${donde}: el campo «${k}» no existe en la definición.`);
    const r = esquema.safeParse(datosDeElemento(def, e.datos));
    if (!r.success) for (const i of r.error.issues) error(`${donde} ${i.path.join('.')}: ${i.message}`);
    for (const [k, v] of Object.entries(e.datos)) if (esPendiente(v)) pendientes.push(`${clave}/${e.idOrigen}.${k}`);
  }
}

// Fotos citadas: existen, pesan menos de 2 MB y tienen alt
const fotos: { foto: Foto; donde: string }[] = [
  ...modelo.bloques.filter((b) => esFoto(b.value)).map((b) => ({ foto: b.value as Foto, donde: b.key })),
  ...Object.entries(modelo.semilla).flatMap(([k, l]) =>
    l.flatMap((e) => fotosEn(e.datos).map((foto) => ({ foto, donde: `${k}/${e.idOrigen}` }))),
  ),
];
for (const { foto, donde } of fotos) {
  const archivo = join(PLATAFORMA, foto.src.replace(/^\//, ''));
  if (!foto.src.startsWith('/fotos/')) error(`${donde}: la foto debe estar en /fotos/ (${foto.src}).`);
  else if (!existsSync(archivo)) error(`${donde}: la foto ${foto.src} no existe.`);
  else if (statSync(archivo).size >= TOPE_FOTO) error(`${donde}: la foto ${foto.src} pesa 2 MB o más.`);
  if (!foto.alt?.trim()) error(`${donde}: la foto ${foto.src} no tiene alt.`);
}

// Código del sitio (Fase 2)
const SRC = join(RAIZ, 'src');
if (existsSync(SRC)) {
  // Tipos de las colecciones: el compilador (astro check) controla que el código solo lea campos definidos.
  const rutaTipos = join(SRC, 'lib', 'content', 'colecciones.generado.ts');
  const tipos = generarTipos(modelo.colecciones, modelo.bloques);
  if (process.argv.includes('--escribir')) writeFileSync(rutaTipos, tipos, 'utf8');
  else if (!existsSync(rutaTipos) || readFileSync(rutaTipos, 'utf8') !== tipos) {
    error('src/lib/content/colecciones.generado.ts no corresponde a las definiciones: corre npm run verificar-modelo -- --escribir.');
  }

  const archivos = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? archivos(join(dir, d.name)) : [join(dir, d.name)]));
  const codigo = archivos(SRC).filter((f) => /\.(astro|ts|tsx)$/.test(f)).map((f) => ({ f, t: readFileSync(f, 'utf8') }));

  // Bloques usados en el código ↔ bloques.json
  const prefijos = [GLOBAL_PAGE_KEY, ...modelo.paginas.pages.flatMap((p) => [p.key, ...(p.blockPrefixes ?? [])])].join('|');
  const patron = new RegExp(`['"\`]((?:${prefijos})\\.[a-z0-9][a-zA-Z0-9]*\\.[a-z0-9][a-zA-Z0-9]*)['"\`]`, 'g');
  const usados = new Set<string>();
  for (const { f, t } of codigo) {
    for (const m of t.matchAll(patron)) {
      usados.add(m[1]!);
      if (!claves.has(m[1]!)) error(`${relative(RAIZ, f)}: usa el bloque «${m[1]}», que no está en bloques.json.`);
    }
  }
  for (const b of modelo.bloques) if (!usados.has(b.key)) error(`El bloque «${b.key}» no se usa en ninguna parte.`);

  // name de los formularios HTML ↔ definición
  const TECNICOS = new Set(['sitioWeb', 'cf-turnstile-response']);
  for (const { f, t } of codigo.filter((x) => x.f.endsWith('.astro'))) {
    for (const m of t.matchAll(/<form[^>]*action=["'`{]+\/api\/formularios\/([a-zA-Z0-9]+)[\s\S]*?<\/form>/g)) {
      const def = modelo.formularios.find((x) => x.key === m[1]);
      if (!def) {
        error(`${relative(RAIZ, f)}: formulario «${m[1]}» sin definición.`);
        continue;
      }
      const nombres = new Set([...m[0].matchAll(/\sname=["']([^"']+)["']/g)].map((n) => n[1]!));
      for (const n of nombres) if (!TECNICOS.has(n) && !def.fields.some((c) => c.name === n)) error(`${relative(RAIZ, f)}: «${n}» no está en el formulario «${def.key}».`);
      for (const c of def.fields) if (c.required && !nombres.has(c.name)) error(`${relative(RAIZ, f)}: falta el campo obligatorio «${c.name}» de «${def.key}».`);
    }
  }

  // <FormularioPlataforma tipo="x" ocultos={{ campo: … }}>: los campos salen de la definición al compilar; aquí se
  // comprueba que el tipo exista y que los campos ocultos sean de esa definición.
  for (const { f, t } of codigo.filter((x) => x.f.endsWith('.astro'))) {
    for (const m of t.matchAll(/<FormularioPlataforma\s[^>]*?tipo="([^"]+)"([^>]*?)\/>/gs)) {
      const def = modelo.formularios.find((x) => x.key === m[1]);
      if (!def) {
        error(`${relative(RAIZ, f)}: formulario «${m[1]}» sin definición.`);
        continue;
      }
      const ocultos = /ocultos=\{\{([\s\S]*?)\}\}/.exec(m[2] ?? '')?.[1] ?? '';
      for (const k of ocultos.matchAll(/(?:^|,)\s*([a-zA-Z0-9]+)\s*:/g)) {
        if (!def.fields.some((c) => c.name === k[1])) error(`${relative(RAIZ, f)}: «${k[1]}» no está en el formulario «${def.key}».`);
      }
    }
  }

  // Rutas de paginas.json ↔ src/pages
  for (const p of modelo.paginas.pages) {
    const base = join(SRC, 'pages', p.route === '/' ? 'index' : p.route.slice(1));
    if (![`${base}.astro`, join(base, 'index.astro')].some(existsSync)) error(`La ruta ${p.route} (${p.key}) no existe en src/pages.`);
  }
} else {
  console.log('· src/ todavía no existe: las comprobaciones del código se activan en la Fase 2.');
}

if (errores.length) {
  console.error(errores.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\n${errores.length} error(es).`);
  process.exit(1);
}
console.log(
  `✓ Modelo correcto según los esquemas de la plataforma: ${modelo.paginas.pages.length} páginas · ` +
    `${modelo.bloques.length} bloques · ${modelo.colecciones.length} colecciones · ${modelo.formularios.length} formularios · ` +
    `${Object.values(modelo.semilla).flat().length} elementos · ${fotos.length} fotos`,
);
console.log(`! ${pendientes.length} valores [PENDIENTE] (se listan en REPORTE-PLATAFORMA.md)`);
