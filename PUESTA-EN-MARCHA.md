# Puesta en marcha — Salazar Home Solutions

Pasos en la consola de `agencia-plataforma`, en este orden. Sin código. Los archivos salen de este repo:

```
npm run paquete    → paquete/migracion-salazar-home.zip
npm run catalogo   → paquete/catalogo-salazar-home.zip
```

## 1. Crear el cliente

- **Nombre:** Salazar Home Solutions
- **Slug:** `salazar-home`
- **Color de acento:** `#D7141A` (provisional: confirmar con el logo en alta)

## 2. Importar el contenido

Ficha del cliente → **Contenido** → **Importar paquete** → subir `paquete/migracion-salazar-home.zip` → revisar la
vista previa → **Aplicar**.

Trae 6 colecciones (`bannersPortada`, `marcas`, `beneficios`, `tarjetasCategoria`, `sucursales`, `preguntas`),
3 formularios (`contacto`, `cotizacion`, `avisoStock`), 93 bloques y 38 elementos. Todavía no trae fotos. Las
advertencias del importador van al `REPORTE-PLATAFORMA.md`.

## 3. Páginas del sitio

**Páginas y contenido** → pegar el contenido de `plataforma/paginas.json` → **Validar** → **Guardar**.
Son 12 páginas. La ficha de producto no tiene página propia: sus textos (`producto.*`) se editan en «Tienda y ficha de
producto».

## 4. Módulos

Encender:
- **tienda**;
- **metricas** (visitas);
- **contactos**, si el plan es Pro (los formularios crean el contacto por el correo o el teléfono).

## 5. Ajustes de la Tienda (consola → ficha del cliente → Tienda)

| Ajuste | Valor |
|---|---|
| **Comisión** | `[PENDIENTE: % del contrato]` (la referencia muestra 3 %). **Sin comisión no se confirma ningún pago** |
| **Dominio de la tienda** | `[PENDIENTE: dominio]`. Mientras no haya dominio: la URL del Worker del sitio (`https://salazar-home-web.<subdominio>.workers.dev`). De aquí salen los enlaces del pago y de los correos |
| **Tipografía de títulos** | La más pesada de la lista (el sitio usa Archivo en 900) |
| **Prefijo de pedidos** | `SAL` |
| **Enlace de condiciones** | `<dominio>/terminos` |
| **Enlace de privacidad** | `<dominio>/privacidad` |

## 6. Llave de API

**API** → nueva llave **«Sitio Salazar»** con los **cinco** alcances, porque no se cambian después:

- `contenido:leer`
- `formularios:enviar`
- `visitas:registrar`
- `tienda:leer`
- `tienda:carrito`

Copia el token (solo se muestra una vez) y pásamelo por un canal seguro: con eso empieza la Fase 3.

## 7. Catálogo

Ficha del cliente → **Tienda** → **Importar catálogo** → `paquete/catalogo-salazar-home.zip` → modo
**Crear y actualizar**.

- Son 125 productos en 7 categorías, todos en **Borrador**, con **stock 0** y **sin fotos**.
- Los precios son el PVP sugerido de la hoja, una **estimación**: confírmalos antes de publicar.
- El SKU es el modelo del fabricante. Reimportar actualiza, nunca duplica.
- Cuando Salazar entregue sus fotos (fondo blanco, cuadradas, webp, menos de 2 MB), se agregan a `fotos/` del paquete y se reimporta.
- Stock y precios: en el portal, **Tienda → Productos → Exportar a Excel**, llenar y **Importar Excel** (solo cambia precio, precio anterior, stock y estado).
- **Publicar solo los productos con foto y precio confirmado.** Un borrador no aparece en el sitio, y su ficha redirige a `/tienda`.
- Marcar «Destacado en la portada» en los que van en la sección «Productos destacados» de la portada.
- **Marca:** el sitio la reconoce por el nombre del producto (campo «Cómo aparece en el nombre» de la colección Marcas). Un producto renombrado sin la marca deja de salir en su marca.

## 8. Lo que activa el cliente en su portal

- **Tienda → Cobros:** al menos una forma de pago. Hoy existen **transferencia bancaria** (cuentas de Salazar) y
  **enlace de pago externo**.
- **Tienda → Envíos:** al menos una forma de entrega. Para línea blanca: **retiro en el local** y **tarifas propias por
  destino**, porque un courier de paquetería no lleva una refrigeradora de 100 kg. Sendifico solo para los pequeños.
- Mientras falte alguna de las dos, el pago muestra «Esta tienda todavía no recibe pedidos» y el portal dice qué falta. El sitio no lo oculta ni lo imita.
- Después de activarlas, actualizar los textos que las nombran: `producto.confianza.*`, `global.footer.pagos` y el beneficio «Múltiples formas de pago».

## 9. Equipo

**Equipo** → invitar al cliente (administrador).

## 10. Antes del primer despliegue (lo hago yo)

- Confirmar el nombre real del Worker de la plataforma (`services` en `wrangler.jsonc` dice `agencia-plataforma`).
- `wrangler secret put PLATAFORMA_LLAVE` **antes** del push que la necesita.
- `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET`, si se quiere Turnstile en los formularios.
