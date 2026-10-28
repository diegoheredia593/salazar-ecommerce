# Salazar Home Solutions — sitio e-commerce conectado a `agencia-plataforma`

Respuestas, reportes y commits en español. Código en español (como está).

## Qué es

Astro (`output: 'server'`) en un Worker de Cloudflare. La vitrina (portada, catálogo, ficha, carrito) es del sitio. El
motor (productos, stock, descuentos, pedidos, cobros, envíos, facturación) es el **módulo Tienda** de la plataforma.
`/pagar…` y `/compra/<token>` son de la plataforma y se sirven en este dominio con `reenviarTienda`.

## Reglas que no se negocian

1. **Nada editable en el código:** texto → bloque (`plataforma/bloques.json`); lista → colección personalizada; foto → plataforma; formulario → definición en `plataforma/formularios/`. Solo quedan en código los textos técnicos de interfaz (lista en `REPORTE-PLATAFORMA.md`).
2. **Productos y categorías nunca en colecciones** (ni `products`/`categories`): viven en la Tienda.
3. **La llave nunca llega al navegador.** El navegador solo habla con `/api/*` del sitio.
4. **Producción por service binding** (`PLATAFORMA` → `agencia-plataforma`), nunca por workers.dev (error 1042). En `astro dev`, la URL pública.
5. **Toda foto por `src/components/Imagen.astro`** (`urlPublicaDeMedio()` + `imagenResponsiva()`).
6. **Git:** push después de cada commit; secretos y bindings ANTES del push que los necesita (cada push a main puede desplegar).
7. **Sin datos inventados:** lo que falta queda `[PENDIENTE: …]`. Sin estrellas, reseñas, favoritos ni «Más vendido». Ningún texto promete una forma de pago que no esté activa.

## Tienda: reglas

- Montos en **centavos con IVA**. Siempre `formatearPrecio()`. El sitio nunca calcula un total ni confía en un precio del navegador.
- La API de Tienda es `no-store`: nunca entra en la caché por versión de `/v1`. El catálogo completo tiene una caché propia de 60 s (`src/lib/tienda/catalogo.ts`).
- `/api/carrito` es el **único** lugar donde el navegador toca el carrito. Cookie `carrito` HttpOnly, SameSite=Lax, 30 días (Secure en producción). Siempre se muestran los avisos.
- Ficha en `/tienda/<slug>`; filtro de categoría `/tienda?categoria=<slug>`. Un borrador da 302 a `/tienda`.
- `src/middleware.ts`: primero las rutas propias (la `/tienda` del sitio nunca se reenvía); `reenviarTienda` SOLO para `/pagar`, `/compra` y `/assets/tienda-app`; luego `next()`.
- **Marca:** la Tienda no tiene campo. `marcaDe()` busca el `nombreEnProductos` de la colección `marcas` en el nombre del producto. Es el único lugar donde se decide.
- **Ficha técnica:** `npm run catalogo` la carga en `especificaciones` y en la descripción (`Nombre: valor` por línea), porque `/v1` aún no entrega `especificaciones`.

## Correcciones al esquema (ya decididas)

Rutas `/tienda/<slug>` (no `/producto/`) · llave con `contenido:leer`, `formularios:enviar`, `visitas:registrar`,
`tienda:leer` y `tienda:carrito` · pago hoy: transferencia y enlace externo · caché separadas · montos en centavos ·
binding `agencia-plataforma` · middleware con las rutas propias primero · fotos por un único helper.
También: tres páginas legales (D2), `avisoStock` (D4), un producto por modelo (D5). Las rutas de `paginas.json` no
aceptan `[slug]`: la ficha es un `blockPrefixes` de `tienda`, y `marca` tiene su índice en `/marca`.

## Modelo y herramientas

- `plataforma/`: `paginas.json`, `bloques.json`, `colecciones/`, `formularios/`, `semilla/`, `fotos/`. Texto enriquecido en texto plano (párrafos separados por una línea vacía, listas con «- »).
- `desarrollo/tienda-semilla.json`: la Tienda en modo semilla (productos reales de la hoja; stock y descuentos de prueba).
- `vendor/plataforma/`: copia sin cambios del SDK y del núcleo (commit en `ORIGEN.md`). Los scripts validan con esos esquemas: no reescribir las reglas.
- `npm test`: `verificar-modelo` (modelo + uso en el código) y `astro check`. Si cambias una colección o un bloque: `npm run verificar-modelo -- --escribir` regenera `src/lib/content/colecciones.generado.ts`.
- `npm run paquete`: zip de contenido. `npm run catalogo`: zip de la Tienda (lee `../Salazar-Home-catalogo-precios.xlsx`; **nunca** las columnas de costo, markup, comisiones ni proveedor). `npm run capturas`: 390 y 1440 px con el Edge instalado (con `astro dev` corriendo).
- Modo de datos: `.dev.vars` → `FUENTE=semilla` (solo dev, sin llave) o `PLATAFORMA_LLAVE=…`.
- **Cambios de modelo después de importar:** una colección o un formulario ya importado no se pisa al reimportar. Avisar a Diego explícitamente cada vez que cambie una definición importada.

## Entorno (Windows)

Node 24 y Git se instalaron con winget. En cada sesión de PowerShell, recargar el PATH:
`$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
