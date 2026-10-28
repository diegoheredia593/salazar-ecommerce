// npm run paquete — genera paquete/migracion-salazar-home.zip (migracion.json + fotos/…) para Contenido → Importar
// paquete. Antes corre verificar-modelo (ver package.json) y al final valida el resultado con migrationPackageSchema,
// el mismo esquema que usa el importador de la plataforma.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import JSZip from 'jszip';
import {
  MIGRATION_FILE, MIGRATION_PACKAGE_VERSION, migrationPackageSchema, type MigrationPackageInput, type MigrationPhoto,
} from '../vendor/plataforma/core/src/content/migration.ts';
import { PLATAFORMA, RAIZ, datosDeElemento, esFoto, fotosEn, leerModelo, valorDeBloque, type Foto } from './lib/modelo.ts';

const SLUG = 'salazar-home';
const REPO = 'salazar-home-web'; // [PENDIENTE: owner/repo]

function commitActual(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'sin-commit';
  }
}

async function main() {
  const modelo = leerModelo();
  const zip = new JSZip();
  const fotos = new Map<string, MigrationPhoto>();

  const registrarFoto = (foto: Foto) => {
    if (fotos.has(foto.src)) return;
    const archivo = join(PLATAFORMA, foto.src.replace(/^\//, ''));
    if (!existsSync(archivo)) throw new Error(`La foto ${foto.src} no existe.`);
    const datos = readFileSync(archivo);
    const { width, height } = imageSize(datos);
    const ruta = foto.src.replace(/^\//, '');
    zip.file(ruta, datos);
    fotos.set(foto.src, { ruta, origen: foto.src, ancho: width, alto: height, alt: foto.alt });
  };

  const bloques = modelo.bloques.map((b) => {
    if (esFoto(b.value)) registrarFoto(b.value);
    return { ...b, help: b.help || null, value: valorDeBloque(b) };
  });

  const elementos = Object.entries(modelo.semilla).flatMap(([coleccion, lista]) => {
    const def = modelo.colecciones.find((c) => c.key === coleccion)!;
    return lista.map((e) => {
      fotosEn(e.datos).forEach(registrarFoto);
      return { coleccion, idOrigen: e.idOrigen, slug: e.slug, estado: e.estado, orden: e.orden, datos: datosDeElemento(def, e.datos) };
    });
  });

  const migracion: MigrationPackageInput = {
    version: MIGRATION_PACKAGE_VERSION,
    origen: `${REPO}@${commitActual()}`,
    generadoEn: new Date().toISOString(),
    colecciones: modelo.colecciones as unknown as Record<string, unknown>[],
    formularios: modelo.formularios as unknown as Record<string, unknown>[],
    bloques,
    elementos,
    fotos: [...fotos.values()],
    advertencias: [],
  };
  const r = migrationPackageSchema.safeParse(migracion);
  if (!r.success) {
    throw new Error(`El paquete no cumple migrationPackageSchema:\n${r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }
  zip.file(MIGRATION_FILE, JSON.stringify(migracion, null, 2));

  mkdirSync(join(RAIZ, 'paquete'), { recursive: true });
  writeFileSync(join(RAIZ, 'paquete', `migracion-${SLUG}.zip`), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

  console.log(`✓ paquete/migracion-${SLUG}.zip (origen ${migracion.origen}), válido según migrationPackageSchema`);
  console.log(
    `  ${modelo.colecciones.length} colecciones · ${modelo.formularios.length} formularios · ` +
      `${bloques.length} bloques · ${elementos.length} elementos · ${fotos.size} fotos`,
  );
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
