# Copia de `agencia-plataforma`

Estos archivos son una copia **sin cambios** de `diegoheredia593/agencia-plataforma`, commit
`f4174116d87bfa741ea3ccaf15cd41f96eaf8830` (main, 28-oct-2026). `@plataforma/sdk` no está publicado en npm: se consume
como paquete del workspace (ver `api.md`, sección SDK). No se editan aquí: si la plataforma cambia, se vuelven a copiar.

| Carpeta | Qué es | Para qué lo usa el sitio |
|---|---|---|
| `sdk/src/` | `index.ts`, `tipos.ts`, `tienda.ts`, `render.ts`, `imagen.ts` de `packages/sdk/src` | El cliente de `/v1` y de la Tienda en el sitio (`@plataforma/sdk`) |
| `core/src/content/richText.ts`, `youtube.ts`, `linkPattern.ts` | Las dos subrutas sin zod que importa el SDK | Lo mismo |
| `core/src/` (resto) | `custom.ts`, `schema.ts`, `migration.ts`, `forms.ts`, `sitePages.ts`, `collections.ts`, `fields.ts`, `storeImport.ts`, `store.ts`, `storefront.ts`, `events.ts` | Solo en los scripts: `verificar-modelo`, `paquete` y `catalogo` validan con los MISMOS esquemas que la consola |
| `docs/formato-importacion-tienda.md` | Formato del paquete de la Tienda | Referencia de `npm run catalogo` |

Únicos cambios frente al original:
- `sdk/package.json`: sin la subruta `./react` ni React (el sitio es Astro; `react.tsx` no se copió).
- `sdk/tsconfig.json` no se copió: extiende el `tsconfig.base.json` del monorepo.

Para actualizar: volver a copiar los mismos archivos desde el commit nuevo, cambiar el commit de arriba y correr
`npm test`.
