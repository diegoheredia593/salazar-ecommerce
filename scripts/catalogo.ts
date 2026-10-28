// npm run catalogo — lee la hoja de precios y genera paquete/catalogo-salazar-home.zip (catalogo.json) para la consola:
// ficha del cliente → Tienda → Importar catálogo. Formato: vendor/plataforma/docs/formato-importacion-tienda.md, y se
// valida con validateStoreCatalog, el mismo validador de la consola.
// Solo se leen las columnas de LECTURA_PERMITIDA: costo, markup, comisiones, margen y proveedor nunca salen de la hoja.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { normalizeText } from '../vendor/plataforma/core/src/store.ts';
import { STORE_IMPORT_FILE, STORE_IMPORT_VERSION, validateStoreCatalog } from '../vendor/plataforma/core/src/storeImport.ts';
import { RAIZ, leerJson } from './lib/modelo.ts';

const HOJA_POR_DEFECTO = resolve(RAIZ, '..', 'Salazar-Home-catalogo-precios.xlsx');
const ARCHIVO = process.argv[2] ? resolve(process.argv[2]) : HOJA_POR_DEFECTO;

const LECTURA_PERMITIDA = {
  numero: '#',
  categoria: 'Categoría',
  marca: 'Marca',
  modelo: 'Modelo',
  nombre: 'Nombre para la tienda',
  detalle: 'Capacidad / detalle',
  pvp: 'PVP sugerido Salazar (con IVA, USD)',
} as const;

/** Las 7 categorías del menú, con el slug que usan tarjetasCategoria y los enlaces del sitio. */
const CATEGORIAS = [
  { nombre: 'Refrigeración', slug: 'refrigeracion' },
  { nombre: 'Lavado y Secado', slug: 'lavado-y-secado' },
  { nombre: 'Cocción', slug: 'coccion' },
  { nombre: 'Microondas', slug: 'microondas' },
  { nombre: 'Lavavajillas', slug: 'lavavajillas' },
  { nombre: 'Climatización', slug: 'climatizacion' },
  { nombre: 'Pequeños Electrodomésticos', slug: 'pequenos-electrodomesticos' },
];

type Fila = Record<keyof typeof LECTURA_PERMITIDA, string> & { centavos: number; filaHoja: number };

/** Igual que el slug que la Tienda calcula del nombre (storeImport.ts), para que la semilla y la Tienda coincidan. */
export const slugDe = (nombre: string) =>
  normalizeText(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object' && 'result' in valor) return texto(valor.result as ExcelJS.CellValue);
  if (typeof valor === 'object' && 'richText' in valor) return valor.richText.map((r) => r.text).join('');
  return String(valor).trim();
}

const usd = (centavos: number) => (centavos / 100).toFixed(2);

async function main() {
  if (!existsSync(ARCHIVO)) throw new Error(`No encuentro la hoja: ${ARCHIVO}`);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ARCHIVO);
  const hoja = libro.getWorksheet('Productos');
  if (!hoja) throw new Error('La hoja «Productos» no existe en el archivo.');

  const encabezados = new Map<string, number>();
  hoja.getRow(1).eachCell((celda, col) => encabezados.set(texto(celda.value), col));
  const columnas = Object.fromEntries(
    Object.entries(LECTURA_PERMITIDA).map(([clave, titulo]) => {
      const col = encabezados.get(titulo);
      if (!col) throw new Error(`Falta la columna «${titulo}» en la hoja Productos.`);
      return [clave, col];
    }),
  ) as Record<keyof typeof LECTURA_PERMITIDA, number>;

  const errores: string[] = [];
  const avisos: string[] = [];
  const filas: Fila[] = [];
  hoja.eachRow((fila, n) => {
    const leer = (k: keyof typeof LECTURA_PERMITIDA) => texto(fila.getCell(columnas[k]).value);
    // Solo filas de producto: las de totales y notas no tienen número en «#».
    if (n === 1 || !/^\d+$/.test(leer('numero'))) return;
    const pvp = Number(leer('pvp'));
    const f: Fila = {
      numero: leer('numero'), categoria: leer('categoria'), marca: leer('marca'), modelo: leer('modelo'),
      nombre: leer('nombre'), detalle: leer('detalle') === '—' ? '' : leer('detalle'), pvp: leer('pvp'),
      centavos: Math.round(pvp * 100), filaHoja: n,
    };
    if (!CATEGORIAS.some((c) => c.nombre === f.categoria)) errores.push(`Fila ${n}: categoría desconocida «${f.categoria}».`);
    if (!Number.isFinite(pvp) || pvp <= 0) errores.push(`Fila ${n}: PVP inválido «${f.pvp}».`);
    if (f.centavos % 100 !== 0 && f.centavos % 100 <= 2) avisos.push(`Fila ${n} (${f.modelo}): PVP ${usd(f.centavos)} parece un resto de redondeo.`);
    filas.push(f);
  });

  const slugs = new Map<string, number>();
  for (const f of filas) {
    const s = slugDe(f.nombre);
    if (slugs.has(s)) errores.push(`Dos productos dan la misma dirección «${s}» (filas ${slugs.get(s)} y ${f.filaHoja}).`);
    slugs.set(s, f.filaHoja);
  }

  const catalogo = {
    version: STORE_IMPORT_VERSION,
    categorias: CATEGORIAS,
    productos: filas.map((f) => {
      const especificaciones = [
        { nombre: 'Marca', valor: f.marca },
        { nombre: 'Modelo', valor: f.modelo },
        ...(f.detalle ? [{ nombre: 'Características', valor: f.detalle }] : []),
        { nombre: 'Garantía', valor: '[PENDIENTE: garantía]' },
      ];
      return {
        nombre: f.nombre,
        slug: slugDe(f.nombre),
        ...(f.detalle ? { descripcionCorta: f.detalle } : {}),
        // La API de la vitrina (/v1/tienda) todavía no entrega «especificaciones»: mientras tanto la ficha del sitio
        // las lee de la descripción, una por línea «Nombre: valor».
        descripcion: especificaciones.map((e) => `${e.nombre}: ${e.valor}`).join('\n'),
        categoria: CATEGORIAS.find((c) => c.nombre === f.categoria)!.slug,
        estado: 'Borrador',
        iva: 15,
        especificaciones,
        variantes: [{ sku: f.modelo, precio: usd(f.centavos), stock: 0 }],
      };
    }),
  };

  const validado = validateStoreCatalog(catalogo, []);
  for (const e of [...validado.fatal, ...validado.productErrors]) errores.push(`${e.ref}: ${e.message}`);

  // La semilla de la vitrina debe usar nombres, SKU, precios y direcciones reales.
  const semilla = leerJson<{ productos: { slug: string; sku: string; nombre: string; precio: number }[] }>(
    join(RAIZ, 'desarrollo', 'tienda-semilla.json'),
  );
  for (const p of semilla.productos) {
    const f = filas.find((x) => x.modelo === p.sku);
    if (!f) errores.push(`Semilla: el SKU «${p.sku}» no está en la hoja.`);
    else if (f.nombre !== p.nombre || f.centavos !== p.precio || slugDe(f.nombre) !== p.slug) {
      errores.push(`Semilla: «${p.sku}» no coincide con la hoja (${f.nombre}, ${f.centavos} centavos, ${slugDe(f.nombre)}).`);
    }
  }

  if (errores.length) {
    console.error(errores.map((e) => `✗ ${e}`).join('\n'));
    process.exit(1);
  }

  const zip = new JSZip();
  zip.file(STORE_IMPORT_FILE, JSON.stringify(catalogo, null, 2));
  mkdirSync(join(RAIZ, 'paquete'), { recursive: true });
  writeFileSync(join(RAIZ, 'paquete', 'catalogo-salazar-home.zip'), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  const porCategoria = CATEGORIAS.map((c) => `${c.nombre}: ${filas.filter((f) => f.categoria === c.nombre).length}`).join(' · ');
  console.log(`✓ ${validado.products.length} productos → paquete/catalogo-salazar-home.zip, válido según validateStoreCatalog (todos en Borrador, stock 0, sin fotos)`);
  console.log(`  ${porCategoria}`);
  console.log(`✓ Semilla de la vitrina: ${semilla.productos.length} productos coinciden con la hoja`);
  const resumen = new Map<string, number>();
  for (const w of validado.warnings) resumen.set(w.kind, (resumen.get(w.kind) ?? 0) + 1);
  for (const [tipo, n] of resumen) console.log(`! Aviso de la plataforma «${tipo}»: ${n}`);
  if (avisos.length) console.log(avisos.map((a) => `! ${a}`).join('\n'));
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
