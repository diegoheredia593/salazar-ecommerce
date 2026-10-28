/**
 * Solo rutas internas (/...), https:, mailto: o tel: — nunca javascript:, data: ni otro
 * esquema. Vive en su propio archivo, sin zod, para que content/richText.ts (y el SDK,
 * que lo importa por esta misma ruta) puedan quedar con cero dependencias en tiempo de
 * ejecución. content/schema.ts lo re-exporta para que nada que ya lo importe desde
 * '@plataforma/core' note el cambio.
 */
export const LINK_PATTERN = /^(\/|https:\/\/|mailto:|tel:)/;
