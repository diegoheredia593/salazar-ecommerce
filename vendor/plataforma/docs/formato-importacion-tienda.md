# Formato del paquete de importación de la tienda

> Fuente de verdad del formato (sprint 13b). Lo valida `validateStoreCatalog` en `packages/core/src/storeImport.ts`:
> lo usan la consola y el script `npm run tienda:validar`. Si este documento y el código no coinciden, manda el código
> y hay que corregir el documento.

Sirve para cargar un catálogo grande (cientos de productos con fotos) de una vez. Se sube en la consola: ficha del
cliente → **Tienda** → **Importar catálogo** (solo superadmin).

## El paquete

Un archivo **.zip** con esto en la raíz:

```
catalogo.json
fotos/
  ron7-375.jpg
  ron7-750.jpg
  whisky12.png
  …
```

- `catalogo.json`: el catálogo (abajo).
- `fotos/`: las fotos, en **JPG, PNG o WebP** (se revisa el contenido, no solo la extensión). Pueden ir en subcarpetas
  (`fotos/ron/anejo.jpg`).
- Cualquier otro archivo fuera de `fotos/` se ignora con un aviso. Lo que agregan macOS y Windows al comprimir
  (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) se ignora sin aviso.
- No se aceptan rutas peligrosas: absolutas (`/x.jpg`), con `..` ni con barra invertida. Un zip así se rechaza entero.
- Sin contraseña. Compresión normal (la de Windows, macOS, 7-Zip o `zip`). Hasta 2 GB.

## catalogo.json

```json
{
  "version": 1,
  "categorias": [
    { "nombre": "Licores", "slug": "licores" },
    { "nombre": "Ron", "slug": "ron", "padre": "licores" }
  ],
  "productos": [
    {
      "nombre": "Ron Añejo 7 Años",
      "slug": "ron-anejo-7-anos",
      "descripcionCorta": "Añejado en barricas de roble",
      "descripcion": "Ron añejo de caña, siete años en barricas de roble americano.",
      "categoria": "ron",
      "estado": "Publicado",
      "iva": 15,
      "pesoGramos": 1300,
      "especificaciones": [
        { "nombre": "Volumen", "valor": "750 ml" },
        { "nombre": "Grado", "valor": "40 %" }
      ],
      "opciones": [{ "nombre": "Volumen", "valores": ["375 ml", "750 ml"] }],
      "variantes": [
        { "sku": "RON7-375", "opciones": ["375 ml"], "precio": 9.5, "stock": 12, "fotos": ["ron7-375.jpg"] },
        {
          "sku": "RON7-750",
          "opciones": ["750 ml"],
          "precio": 16.9,
          "precioAnterior": 18.5,
          "stock": 20,
          "fotos": ["ron7-750.jpg"]
        }
      ]
    }
  ]
}
```

### Raíz

| Campo        | Obligatorio | Qué es                                       |
| ------------ | ----------- | -------------------------------------------- |
| `version`    | sí          | Siempre `1`.                                 |
| `categorias` | no          | Lista de categorías (hasta 60).              |
| `productos`  | sí          | Lista de productos (hasta 5000 por paquete). |

### Categoría

| Campo    | Obligatorio | Qué es                                                                                                                       |
| -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `nombre` | sí          | Hasta 60 caracteres.                                                                                                         |
| `slug`   | no          | Minúsculas, números y guiones. Sin él, sale del nombre («Café molido» → `cafe-molido`).                                      |
| `padre`  | no          | Slug de la categoría padre (del paquete o una que ya tenga la tienda). **Hasta dos niveles**: el padre no puede tener padre. |

Una categoría cuyo slug ya existe en la tienda no se toca (ni el nombre ni el padre). Las que no existen se crean
(aviso «Categoría nueva»).

### Producto

| Campo              | Obligatorio | Qué es                                                                                                   |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| `nombre`           | sí          | Hasta 120 caracteres.                                                                                    |
| `slug`             | no          | La dirección en la vitrina. Sin él, sale del nombre; si ya existe, se le agrega `-2`, `-3`…              |
| `descripcionCorta` | no          | Hasta 160 caracteres (la línea bajo el nombre).                                                          |
| `descripcion`      | no          | Hasta 2000 caracteres.                                                                                   |
| `categoria`        | no          | Slug de una categoría del paquete o de la tienda.                                                        |
| `estado`           | sí          | `Publicado` o `Borrador`.                                                                                |
| `iva`              | no          | `15` (por defecto) o `0`. Los precios ya incluyen el IVA.                                                |
| `pesoGramos`       | no          | Peso **con empaque**, en gramos (entero).                                                                |
| `especificaciones` | no          | Pares `{ "nombre", "valor" }` (hasta 20): «Volumen: 750 ml», «Grado: 40 %».                              |
| `opciones`         | no          | Hasta 3 opciones `{ "nombre", "valores" }` (hasta 20 valores cada una). Sin opciones, una sola variante. |
| `variantes`        | sí          | De 1 a 100.                                                                                              |

### Variante

| Campo            | Obligatorio     | Qué es                                                                                     |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `sku`            | **sí**          | La llave (hasta 40 caracteres). Único en todo el paquete y en la tienda.                   |
| `opciones`       | si hay opciones | Un valor por opción, en el mismo orden. Cada combinación una sola vez.                     |
| `precio`         | sí              | En dólares, con hasta dos decimales (`9.5`, `16.90`). Se acepta también texto (`"16,90"`). |
| `precioAnterior` | no              | El precio tachado. Si no es mayor que el precio, se ignora (aviso).                        |
| `stock`          | sí              | Unidades en bodega (entero, 0 o más).                                                      |
| `fotos`          | no              | Nombres de archivo dentro de `fotos/` (`"ron7-375.jpg"` o `"fotos/ron7-375.jpg"`).         |

La galería del producto son las fotos de sus variantes, en orden y sin repetir (hasta 10). Cada variante guarda
además las suyas.

## El SKU es la llave

- **Reimportar actualiza, nunca duplica.** Un producto del paquete se reconoce por los SKU de sus variantes.
- Un SKU que no existe en la tienda crea su producto (o, en un producto que ya existe, una variante nueva).
- Una variante que la tienda tiene y el paquete no trae **no se borra**. Si el paquete cambia las opciones del producto
  y esa variante ya no cabe, el producto sale con error: inclúyela o quítala a mano antes.
- Un producto con una variante sin SKU es un error (ese producto no se importa). Un SKU repetido también.
- Si los SKU de un producto del paquete están en dos productos distintos de la tienda, es un error.

## Modos

| Modo                     | Qué hace                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **Crear y actualizar**   | Crea los nuevos y actualiza todo lo de los que ya existen (nombre, textos, categoría, estado, fotos…).    |
| **Solo nuevos**          | Solo crea los productos cuyos SKU no existen; los demás no se tocan.                                      |
| **Solo precios y stock** | Solo cambia precio, precio anterior y stock de SKU que ya existen. No crea nada ni toca nombres ni fotos. |

## Fotos

- Van a la biblioteca de **Fotos** del cliente, con sus tamaños para la web (480, 960 y 1600 px).
- **Si el mismo archivo ya está en la biblioteca, no se sube otra vez** (se reconoce por su contenido, SHA-256).
- Una foto de más de 2 MB se reduce a 2000 px de ancho al importarla (aviso). Una de más de 20 MB no se importa
  (aviso). Una foto que falta en el zip no impide importar el producto (aviso «Foto faltante»).

## Errores y avisos

- **Errores del paquete** (no se importa nada): zip dañado o con contraseña, sin `catalogo.json`, JSON inválido,
  versión distinta de 1, rutas peligrosas, archivos en `fotos/` que no son imágenes, categorías mal armadas.
- **Errores de un producto** (ese producto no entra, el resto sí): falta un dato obligatorio, SKU vacío o repetido,
  precio inválido, combinación que no está en las opciones, categoría desconocida…
- **Avisos** (no impiden): foto faltante, foto muy grande, precio en 0, categoría nueva, precio anterior ignorado,
  demasiadas fotos, archivo ignorado.

Todos los mensajes dicen qué producto (`Producto 12 «Ron Añejo 7 Años»`), qué variante (`SKU RON7-750`) o qué
archivo falla, y por qué.

## Antes de subirlo

```bash
npm run tienda:validar -- ruta/al/paquete.zip
```

Corre el mismo validador que la consola y además revisa el contenido entero de cada foto. Sale con código 1 si hay
errores. No conoce las categorías que ya tiene la tienda: una categoría que no está en el paquete sale como error aquí
aunque allá exista.

## Paquete de ejemplo

`docs/tienda-ejemplo.zip` (5 productos de una licorería, uno con variantes, categorías en dos niveles) y su contenido en
`docs/tienda-ejemplo/`. `docs/tienda-ejemplo-precios.zip` es el mismo con 2 precios cambiados, para probar la
reimportación. Se regeneran con `npm run tienda:ejemplo` (y `-- --precios`).

## Después de importar

- La importación corre en segundo plano, por lotes, con su avance en la consola. Mientras corre, no se puede lanzar
  otra para el mismo cliente (tampoco el Excel del portal).
- Queda **una** fila en el historial por importación, con el resumen.
- **Deshacer esta importación** (24 horas, solo la última): borra lo que creó (productos, variantes, categorías y las
  fotos que nada más usa) y devuelve lo que cambió a su valor anterior. El stock vuelve por diferencia: lo vendido
  mientras tanto sigue descontado.
- Lo importado se edita a mano después como cualquier producto.

## Excel de precios y stock (portal)

En el portal, **Tienda → Productos** (solo el administrador del negocio):

- **Exportar a Excel**: una fila por variante con `SKU`, `Producto`, `Variante`, `Precio`, `Precio anterior`, `Stock`
  y `Estado`.
- **Importar Excel**: solo cambia precio, precio anterior, stock y estado de SKU que ya existen. Nunca crea ni borra.
  Las columnas se buscan por su nombre (no importa el orden). El estado es del producto (`Publicado`, `Borrador` o
  `Archivado`): todas las filas de un producto deben decir lo mismo. Muestra la revisión antes de aplicar («38 precios
  cambian, 2 SKU no existen») y se deshace igual que la importación de la consola.
