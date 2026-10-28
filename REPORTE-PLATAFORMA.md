# Reporte — Salazar Home Solutions conectado a la plataforma

Estado al 28-oct-2026: **Fase 2 terminada** (el sitio completo en modo semilla). Fases 3 y 4 pendientes de la llave.
Decisiones de la Fase 0 y lo que confirmó el código de la plataforma: `../FASE-0-SALAZAR.md`.

## Mapa de páginas

| Página (`key`) | Ruta | Bloques | Colecciones | Formularios | Tienda (SDK) |
|---|---|---|---|---|---|
| (global) | todas | `global.*` | `sucursales`, `marcas` (menú) | — | `categorias()`, catálogo (marcas por categoría), `verCarrito()` (contador) |
| `inicio` | `/` | `inicio.*` | `bannersPortada`, `beneficios`, `tarjetasCategoria`, `marcas` | — | `categorias()`, destacados del catálogo |
| `tienda` | `/tienda`, `/tienda?categoria=` | `tienda.*` | `marcas` (filtro) | — | `productos({ categoria, pagina, porPagina: 24 })`; con filtros, catálogo completo |
| `tienda` (prefijo `producto`) | `/tienda/<slug>` | `producto.*` | `beneficios`, `preguntas`, `marcas` | `avisoStock` | `producto(slug)`; relacionados `productos({ categoria, porPagina: 5 })` |
| `marca` | `/marca`, `/marca/<slug>` | `marca.*` | `marcas` | — | catálogo filtrado por marca |
| `promociones` | `/promociones` | `promociones.*` | — | — | catálogo con `descuento` o `precioAnterior` |
| `buscar` | `/buscar?q=` | `buscar.*` | — | — | `productos({ buscar, porPagina: 100 })` |
| `carrito` | `/carrito` | `carrito.*` | — | — | `verCarrito`, avisos, totales, código, `urlDePago(token)` |
| `nosotros` | `/nosotros` | `nosotros.*` | `sucursales` | — | — |
| `contacto` | `/contacto` | `contacto.*` | `sucursales` | `contacto`, `cotizacion` | — |
| `pedido` | `/mi-pedido` | `pedido.*` | — | — | — |
| `terminos`, `privacidad`, `garantias` | `/terminos`, `/privacidad`, `/garantias-y-devoluciones` | `<pagina>.*` | `preguntas` (garantías) | — | — |
| Plataforma | `/pagar…`, `/compra/<token>`, `/assets/tienda-app/…` | — | — | — | `reenviarTienda` en `src/middleware.ts` |

Rutas técnicas: `/api/carrito`, `/api/formularios/[tipo]`, `/api/visita`, `/sitemap.xml`, `/robots.txt` y la 404.

## Lo que resuelve el sitio porque la API no lo hace

| Necesidad | Cómo | Dónde |
|---|---|---|
| Marca del producto (D1) | `nombreEnProductos` de la colección `marcas`, como palabra completa en el nombre | `src/lib/tienda/catalogo.ts` → `marcaDe()` (único lugar) |
| Destacados, filtro por marca, precio y oferta, orden | Catálogo completo (`porPagina: 100`) con una caché de 60 s en memoria, **separada** de la caché por versión | `todosLosProductos()`, `filtrar()` |
| Ficha técnica | `/v1/tienda` no entrega `especificaciones`: se leen de la descripción, una línea `Nombre: valor` | `leerDescripcion()` |
| «Agregar al carrito» desde una tarjeta | `ProductoResumen` no trae el id de la variante: la tarjeta manda el slug y `/api/carrito` resuelve la variante (si hay varias, lleva a la ficha) | `src/pages/api/carrito.ts` |
| Avisos del carrito sin JavaScript | Los avisos de una acción (p. ej. código inválido) solo vienen en esa respuesta: viajan a `/carrito` en una cookie HttpOnly de un solo uso | `guardarAvisos()` / `tomarAvisos()` |

**Pedido a la plataforma** (le sirve a cualquier tienda): un campo «Marca» con filtro en `productos()`;
`especificaciones` en `ProductoTienda`; el id de la variante en `ProductoResumen` cuando hay una sola; un filtro
`destacado` en `productos()`.

## Textos que quedan en el código (interfaz técnica)

- **Encabezado y menú:** «¿Qué producto estás buscando?», «Buscar», «Mi pedido», «Carrito», «N artículos», «Abrir/Cerrar menú de categorías», «Categorías», «Marcas en <categoría>», «Ver toda la categoría», «Marcas», «Contacto».
- **Tarjeta:** «Agregar al carrito», «Ver producto», «Agotado», «Oferta», «Desde», «Antes».
- **Ficha:** «Modelo:», «Disponible · quedan N», «Quedan N», «Queda 1», «Agotado», «Cantidad», «Preguntar por WhatsApp», «Avisarme», «Ficha técnica», «Preguntas frecuentes», «Ver foto N».
- **Tienda y filtros:** «Filtrar», «Categoría», «Marca», «Todas», «Precio (USD)», «Desde/Hasta», «Solo en oferta», «Ordenar por», «Destacados», «Menor precio», «Mayor precio», «Aplicar», «Limpiar», «N productos», «Anterior», «Siguiente», «Página N».
- **Carrito:** «Resumen», «Código de descuento», «Aplicar», «Quitar código», «(no aplicado)», «Subtotal», «Descuentos», «Envío», «Se calcula en el pago», «Total», «Ir a pagar · $X», «Seguir comprando», «Actualizar», «Quitar», «c/u», «Ver la tienda», y los mensajes de error del carrito.
- **Formularios:** «(opcional)», «Elige una opción», «Enviando…», «Enviar mensaje», «Pedir cotización», los mensajes de éxito, error y límite, y el señuelo «No llenes este campo».
- **Páginas:** «Escríbenos», «Nuestras sucursales», «Visítanos», «Cómo llegar», «Escríbenos por WhatsApp», «Resultados para «q»», «Buscar productos», la 404 completa, «Saltar al contenido», «Ver nuestras N sucursales», «Ayuda» y «Contacto» del pie, «© <año>».
- **Migas:** «Inicio» y «Estás en».

Si Salazar quiere editar alguno (por ejemplo «Escríbenos»), se agrega como bloque y avisaré del cambio de modelo.

## `[PENDIENTE]` (47 valores)

- **Bloques (39):**
  - `global.contacto.whatsapp`, `.mensajeWhatsapp`, `.telefono`, `.correo`
  - `global.footer.frase`, `.direccion`, `.horario`, `.pagos`
  - `global.seo.descripcion`
  - `inicio.seo.titulo`, `.descripcion`
  - `tienda.encabezado.texto`, `tienda.vacio.texto`, `tienda.seo.titulo`, `.descripcion`
  - `producto.confianza.envio`, `.retiro`, `.garantia`, `.pagos`; `producto.agotado.texto`, `producto.whatsapp.mensaje`
  - `marca.vacio.texto`
  - `promociones.encabezado.texto`, `promociones.vacio.texto`, `promociones.seo.titulo`, `.descripcion`
  - `buscar.vacio.texto`, `carrito.vacio.texto`
  - `nosotros.hero.titulo`, `.texto`; `nosotros.historia.texto`, `nosotros.seo.descripcion`
  - `contacto.encabezado.texto`; `contacto.cotizacion.titulo`, `.texto`; `contacto.seo.descripcion`
  - `terminos.contenido.texto`, `privacidad.contenido.texto`, `garantias.contenido.texto`
- **Semilla (8):**
  - beneficios: detalle de la garantía, de la instalación y de las formas de pago;
  - sucursal: nombre, dirección, ciudad, horario y teléfono.
- **Fotos (sin valor):**
  - el logo, la imagen para compartir y la foto del cierre;
  - las fotos de Nosotros y de Promociones;
  - las fotos y fotos móviles de los banners de portada;
  - los logos y fotos de las marcas;
  - las 7 tarjetas de categoría;
  - las 125 fotos de producto.
- **Catálogo:** stock, peso con empaque, garantía y fotos de los 125 productos. Precios por confirmar: son
  estimaciones, y 12 terminan en ,01 o ,02 como resto de redondeo (filas 43, 48, 62, 71, 78, 88, 89, 90, 92, 94, 119
  y 125 de la hoja).
- **Datos del proyecto:** repo, dominio, color exacto, comisión de la tienda y nombre real del Worker de la plataforma.

## Conflictos entre documentos

Los 15 de la Fase 0, con su resolución, están en `../FASE-0-SALAZAR.md` (§8 y «Confirmado con el código»).
Los nuevos de la Fase 2:

| # | Fuente A | Fuente B | Gana | Por qué |
|---|---|---|---|---|
| 16 | `tienda-en-sitios.md`: el carrito vuelve a `/carrito` con 303 y muestra `carrito.avisos` | Un código inválido «no queda guardado»: su aviso solo viene en la respuesta de la acción | Ambos, con una cookie de un solo uso | Sin ella, el visitante sin JavaScript no ve por qué no se aplicó su código |
| 17 | Prompt: cookie `Secure` | `astro dev` corre en `http://localhost` | `Secure` en producción; sin `Secure` solo en dev | Se decide en `guardarToken()` |
| 18 | Prompt: «Si no hay reenvío configurado, usa `carrito.urlPago`» | El middleware siempre reenvía `/pagar` | `urlDePago(token)` (relativa) | El pago queda en el dominio de Salazar. Si algún día se quita el reenvío, se cambia en `carrito.astro` |
| 19 | Prompt: usar `component-library` | La biblioteca es React + framer-motion; el sitio es Astro sin React | No se integra ningún componente | Solo se tomó la idea del *Flow Button* (la flecha que avanza al pasar el mouse) en CSS |
| 20 | `api.md`: `X-Visitor-UA` y país | El SDK los manda solos con `registrarVisita` | El SDK | — |
| 21 | Prompt maestro: TypeScript estricto | `@astrojs/check` no admite TypeScript 7 | TypeScript 6 | `npm test` corre `astro check` |

## Notas técnicas

- **Semilla fuera de producción:** la semilla (`src/lib/content/semilla.ts`, `src/lib/tienda/semilla.ts`) solo se carga en `import.meta.env.DEV`. Comprobado: el build no la incluye. En producción, sin llave, el sitio falla con un mensaje claro.
- **Configuración del Worker:** no tiene KV, D1 ni R2 (`session: false`, `imageService: 'passthrough'`). Comprobado en `dist/server/wrangler.json`: el único binding es `PLATAFORMA`.
- **`.dev.vars` en el build:** el adaptador lo copia a `dist/server/`. `dist/` no va al repo y `wrangler deploy` nunca sube `.dev.vars` como secreto, pero no hay que compartir `dist/`.
- **Fotos:** toda foto pasa por `src/components/Imagen.astro` (`urlPublicaDeMedio()` + `imagenResponsiva()` con sus variantes). La única excepción, el `<source>` móvil del banner, también usa `urlPublicaDeMedio()`.
- **Favicon:** una casa blanca sobre rojo, genérica. Se reemplaza cuando llegue el logo.

## Verificación de la Fase 2 (modo semilla, `astro dev`)

| Prueba | Resultado |
|---|---|
| `npm test` (`verificar-modelo` con los esquemas de la plataforma + `astro check`) | ✓ 0 errores. Los 93 bloques se usan en el código, las 12 rutas existen y los formularios cuadran |
| `npm run paquete` | ✓ válido según `migrationPackageSchema` |
| `npm run catalogo` | ✓ 125 productos válidos según `validateStoreCatalog`; la semilla coincide con la hoja |
| Las 25 URLs probadas | ✓ 200; ficha inexistente o en borrador → 302 a `/tienda`; marca inexistente y ruta inexistente → 404 |
| Carrito sin JavaScript (curl con cookie) | ✓ agregar desde la tarjeta, cantidad recortada al stock con aviso, código inexistente con aviso, código con 10 %, «se aplica el mayor» frente al −10 % automático, quitar código, quitar línea, agotado → ficha, origen ajeno → 403 |
| Carrito con JavaScript | ✓ agrega sin recargar; contador y aviso flotante; en `/carrito`, «+» y el código actualizan sin recargar |
| Formularios | ✓ 201 válido; 422 con un error por campo (el validador real de la plataforma); campo de más → 422; señuelo → 201 falso; origen ajeno → 403; sin JS → 303 con mensaje; con JS → errores junto al campo y foco en el primero |
| `/api/visita` | ✓ 202 |
| Build de producción | ✓ |
| Capturas a 390 y 1440 px | ✓ 36 capturas en `capturas/` (`npm run capturas`) |

Lo que **no** se pudo probar todavía: la conexión real (`/v1`, la caché por versión, el reenvío de `/pagar` y
`/compra`), Turnstile y las fotos reales. Eso es la Fase 3.

## Verificación de la Fase 3 (modo `plataforma` en `astro dev`, 28-oct-2026)

Con el contenido y el catálogo ya importados, y la llave «Sitio Salazar» en `.dev.vars`.
**Todavía no está en el Worker** (`wrangler secret put` pendiente) y no hay repo ni push.

| Prueba | Resultado |
|---|---|
| Conflicto 1: URL base `/c/salazar-home/v1` frente a `/v1` | **Resuelto a favor de `api.md`: `/v1`.** Bajo `/c/salazar-home/v1` las listas funcionan, pero los endpoints de detalle (`/tienda/productos/<slug>`, `/colecciones/<x>/<slug>`) responden 404: una ficha publicada redirigía a `/tienda`. Con `/v1` todo responde. El cliente usa `https://agencia-plataforma/v1` por el binding y la URL pública `/v1` en local. Vale la pena avisar a la plataforma (o corregir el prompt maestro) |
| `contenido:leer` | ✓ versión 1; 93 bloques; `bannersPortada` 1, `beneficios` 7, `tarjetasCategoria` 7, `marcas` 22, `sucursales` 1, `preguntas` 0 (lo mismo que el paquete) |
| `tienda:leer` | ✓ las 7 categorías con los slugs del catálogo; 0 productos publicados (los 125 están en Borrador) |
| `tienda:carrito` | ✓ crea un carrito (201) |
| `formularios:enviar` | ✓ un tipo inexistente da 404 y `contacto` vacío da 422 por campo (no se guardó ningún envío) |
| `visitas:registrar` | ✓ 202 (se probó con un agente de robot, que no se cuenta) |
| Las 19 rutas en modo plataforma | ✓ 200; la ficha de un producto en **Borrador da 302 a `/tienda`**; la ruta inexistente da 404 |
| Fotos con el host `agencia-plataforma` | ✓ ninguna (aún no hay fotos) |
| Reenvío de `/pagar?carrito=<token>` por el sitio | ✓ la página de la plataforma con el nombre de Salazar: «La tienda no está recibiendo pedidos», como corresponde sin cobros ni envíos activos |
| Reenvío sin llave o con una llave falsa | ✓ 401 «Reenvío no autorizado» |
| Capturas plataforma frente a semilla (`capturas-plataforma/`) | ✓ las páginas de contenido son idénticas píxel a píxel salvo el encabezado. A 390 px cambia solo el contador del carrito; a 1440 px, además, las flechas del menú de marcas por categoría. Las dos diferencias se deben a que no hay productos publicados |

**Con productos publicados** (6 refrigeradoras Samsung, publicadas por Diego para la prueba):

| Prueba | Resultado |
|---|---|
| API de Tienda | ✓ `Cache-Control: no-store`, como dice la guía |
| `/tienda` | ✓ 6 productos; la marca Samsung se detecta por el nombre; el filtro de marca solo ofrece Samsung; orden por precio correcto; una categoría sin publicados muestra el texto de vacío |
| Ficha `/tienda/<slug>` | ✓ (después de pasar a `/v1`) marca, modelo, precio, «Disponible · quedan 10», especificaciones leídas de la descripción, 4 relacionados y JSON-LD `Product` con `Offer` en USD e `InStock` |
| `/marca/samsung`, `/marca/lg` | ✓ 6 y 0 productos |
| `/buscar?q=side by side` | ✓ 2 resultados (`productos({ buscar })` de la Tienda) |
| `/promociones` | ✓ vacía (ningún producto con descuento ni precio anterior) |
| `sitemap.xml` | ✓ 6 fichas y la marca Samsung |
| Menú | ✓ la categoría Refrigeración ofrece la marca Samsung |
| Carrito real sin JavaScript | ✓ agregar desde la tarjeta; cantidad 50 → la plataforma la deja en el stock y avisa «De «…» solo quedan 15.»; «El código NOEXISTE no existe.» llega a `/carrito` por la cookie de un solo uso; totales calculados por la plataforma; respuesta JSON con los artículos |
| `/pagar` con el carrito real, por el sitio | ✓ 200, la página de la plataforma con la marca de Salazar |
| Capturas (`capturas-plataforma/`) | ✓ la ficha y la tienda con datos reales se ven igual que con la semilla (mismos componentes, otros datos) |

Lo que falta:
- **`/compra/<token>`**, que necesita un pedido. Con un token inventado, la plataforma responde «Sitio no encontrado» y no el 404 del pedido: hay que confirmarlo con uno real.
- **`urlPago`** sale con `portal.equatorial.dev` porque todavía no está fijado el «dominio de la tienda». El sitio usa `urlDePago()` (relativa), así que no le afecta.

**Seguridad:** la llave actual pasó por el chat (captura y mensaje). Antes de producción hay que revocarla, crear
otra «Sitio Salazar» con los mismos cinco alcances y cargarla solo con `wrangler secret put` y `.dev.vars`.

## Verificación de la Fase 4

### Primer despliegue (28-oct-2026, en workers.dev)

- Repo `diegoheredia593/salazar-ecommerce`, commit `d6669ab` en `main`. Desplegado con `wrangler deploy` desde ese
  commit: Worker `salazar-home-web`, versión `7c8ecf68-1e0a-4d23-a0ac-3d7633f8d5b9`, en
  `https://salazar-home-web.herediadiego963.workers.dev`. El repo todavía no está conectado a Workers Builds: un push
  no despliega solo.
- Bindings: `PLATAFORMA` → `agencia-plataforma` (confirmado en la cuenta), `ASSETS`, `TURNSTILE_SITE_KEY` vacía.
  Secreto: `PLATAFORMA_LLAVE`.
- **Tropiezo:** la primera carga del secreto con `… | wrangler secret put` en PowerShell 5.1 le antepuso un BOM
  (`EF BB BF`) y todo dio 500 («Llave inválida o revocada»). Se cargó otra vez desde un archivo UTF-8 sin BOM con
  `cmd /c "wrangler secret put … < archivo"`. No canalizar secretos con `|` en PowerShell 5.1.
- Rutas: `/`, `/tienda`, `/marca/samsung`, `/contacto`, `/carrito` y `/sitemap.xml` responden 200; `/robots.txt` 200;
  `/no-existe` 404. Las 6 fichas publicadas responden 200, y ninguna foto sale con el host `agencia-plataforma`.
- Carrito real por `/api/carrito` y `/pagar?carrito=…` con 200: la página de la plataforma con la marca de Salazar
  («La tienda no está recibiendo pedidos», porque faltan cobros y envíos). `/pagar` sin carrito da «Sitio no
  encontrado» (404), igual que en local.
- Capturas a 390 y 1440 px en `capturas/produccion/`: iguales a las de `astro dev`.
- **Volver atrás:** `npx wrangler rollback` (a la versión anterior) o `npx wrangler versions list` y
  `npx wrangler rollback <id>`.

Falta: dominio propio, llave rotada, Turnstile (opcional), cobros y envíos, un pedido real para `/compra/<token>`,
una prueba «PRUEBA» por formulario y medir que un cambio de texto aparezca en menos de 20 s.
