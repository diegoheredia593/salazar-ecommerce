// npm run capturas — capturas de página completa a 390 y 1440 px de todas las páginas (con el sitio corriendo en
// astro dev). Usa el Edge instalado en Windows (playwright-core, sin descargar navegadores). Salen en capturas/.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { RAIZ } from './lib/modelo.ts';

const BASE = process.env.URL_SITIO ?? 'http://localhost:4321';
const PAGINAS: [string, string][] = [
  ['inicio', '/'],
  ['tienda', '/tienda'],
  ['tienda-categoria', '/tienda?categoria=pequenos-electrodomesticos'],
  ['ficha', process.env.FICHA ?? '/tienda/refrigeradora-french-door-samsung-495-l'],
  ['ficha-agotada', '/tienda/refrigeradora-mabe-331-l'],
  ['marcas', '/marca'],
  ['marca-lg', '/marca/lg'],
  ['promociones', '/promociones'],
  ['buscar', '/buscar?q=lavadora'],
  ['carrito-vacio', '/carrito'],
  ['carrito', '/carrito'],
  ['nosotros', '/nosotros'],
  ['contacto', '/contacto'],
  ['mi-pedido', '/mi-pedido'],
  ['terminos', '/terminos'],
  ['privacidad', '/privacidad'],
  ['garantias', '/garantias-y-devoluciones'],
  ['404', '/no-existe'],
];
const ANCHOS = [390, 1440];

// CAPTURAS=capturas-plataforma para comparar los dos modos (semilla y plataforma).
const destino = join(RAIZ, process.env.CAPTURAS ?? 'capturas');
mkdirSync(destino, { recursive: true });
const navegador = await chromium.launch({ channel: 'msedge' });
for (const ancho of ANCHOS) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: ancho < 768 ? 844 : 900 }, locale: 'es-EC' });
  const pagina = await contexto.newPage();
  for (const [nombre, ruta] of PAGINAS) {
    if (nombre === 'carrito') {
      // Un carrito con productos, por el mismo endpoint que usa el sitio.
      for (const producto of ['refrigeradora-french-door-samsung-495-l', 'lavadora-carga-frontal-lg-25-kg']) {
        await pagina.request.post(`${BASE}/api/carrito`, { form: { accion: 'agregar', producto }, headers: { Origin: BASE } });
      }
    }
    // astro dev mantiene abierta la conexión de recarga: «networkidle» nunca llega. Basta con la carga y las fuentes.
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(destino, `${ancho}-${nombre}.png`), fullPage: true });
    console.log(`✓ ${ancho}-${nombre}.png`);
  }
  await contexto.close();
}
await navegador.close();
