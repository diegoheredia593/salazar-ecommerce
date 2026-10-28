// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  // Sin KV propio (regla del prompt maestro): el sitio no usa sesiones de Astro; el carrito vive en la plataforma.
  session: false,
  adapter: cloudflare({ imageService: 'passthrough' }),
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});
