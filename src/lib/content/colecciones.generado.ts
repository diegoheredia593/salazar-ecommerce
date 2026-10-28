// ARCHIVO GENERADO por `npm run verificar-modelo -- --escribir` a partir de plataforma/colecciones/*.json.
// No se edita a mano: se cambia la definición y se vuelve a generar.
import type { ElementoBase, Foto, TextoEnriquecido } from '@plataforma/sdk';

/** Banners de portada: El carrusel grande de la portada. Entre 2 y 4 banners. La última palabra del título sale en rojo. */
export interface ElementoBannersPortada extends ElementoBase {
  antetitulo: string | null;
  titulo: string;
  texto: string | null;
  botonTexto: string | null;
  botonEnlace: string | null;
  foto: Foto | null;
  fotoMovil: Foto | null;
}

/** Beneficios: Los sellos bajo el banner, la franja de cuatro beneficios de la portada y el bloque de confianza de la ficha. */
export interface ElementoBeneficios extends ElementoBase {
  titulo: string;
  detalle: string | null;
  icono: "envio" | "garantia" | "instalacion" | "asesoria" | "pago" | "seguridad" | "eficiencia";
  dondeAparece: ("bajoBanner" | "franja" | "ficha")[];
}

/** Marcas: Las marcas que vendes: su página propia, el filtro de la tienda y los banners de la portada. */
export interface ElementoMarcas extends ElementoBase {
  nombre: string;
  slug: string;
  nombreEnProductos: string;
  logo: Foto | null;
  frase: string | null;
  botonTexto: string | null;
  fotoBanner: Foto | null;
  fondo: "oscuro" | "claro" | "azul" | null;
  mostrarEnPortada: boolean;
  descripcion: TextoEnriquecido | null;
}

/** Preguntas frecuentes: Se ven en Garantías y devoluciones y, por tema, en la ficha de producto. */
export interface ElementoPreguntas extends ElementoBase {
  pregunta: string;
  respuesta: TextoEnriquecido;
  tema: "envios" | "pagos" | "garantia" | "instalacion";
}

/** Sucursales: Los locales de Salazar: se ven en el pie, en Contacto y en Nosotros. */
export interface ElementoSucursales extends ElementoBase {
  nombre: string;
  direccion: string;
  ciudad: string | null;
  horario: string | null;
  telefono: string | null;
  mapa: string | null;
  foto: Foto | null;
}

/** Tarjetas de categoría: La foto de cada categoría en la portada. Las categorías y sus productos se manejan en Tienda → Productos. */
export interface ElementoTarjetasCategoria extends ElementoBase {
  nombre: string;
  categoria: string;
  foto: Foto | null;
}

export interface ColeccionesSitio {
  bannersPortada: ElementoBannersPortada;
  beneficios: ElementoBeneficios;
  marcas: ElementoMarcas;
  preguntas: ElementoPreguntas;
  sucursales: ElementoSucursales;
  tarjetasCategoria: ElementoTarjetasCategoria;
}

export type ClaveColeccionSitio = keyof ColeccionesSitio;

/** Las claves de bloques.json, por control. */
export type ClaveTexto =
  | "buscar.seo.descripcion"
  | "buscar.seo.titulo"
  | "buscar.vacio.texto"
  | "carrito.envio.texto"
  | "carrito.seo.descripcion"
  | "carrito.seo.titulo"
  | "carrito.vacio.texto"
  | "contacto.cotizacion.texto"
  | "contacto.cotizacion.titulo"
  | "contacto.encabezado.texto"
  | "contacto.encabezado.titulo"
  | "contacto.mapa.enlace"
  | "contacto.seo.descripcion"
  | "contacto.seo.titulo"
  | "garantias.contenido.titulo"
  | "garantias.preguntas.titulo"
  | "garantias.seo.descripcion"
  | "garantias.seo.titulo"
  | "global.anuncio.texto"
  | "global.contacto.correo"
  | "global.contacto.mensajeWhatsapp"
  | "global.contacto.telefono"
  | "global.contacto.whatsapp"
  | "global.encabezado.botonWhatsapp"
  | "global.footer.direccion"
  | "global.footer.frase"
  | "global.footer.horario"
  | "global.footer.notaPrecios"
  | "global.footer.pagos"
  | "global.marca.nombre"
  | "global.menu.promociones"
  | "global.redes.facebook"
  | "global.redes.instagram"
  | "global.redes.tiktok"
  | "global.seo.codigoVerificacion"
  | "global.seo.descripcion"
  | "global.seo.titulo"
  | "inicio.categorias.enlaceTexto"
  | "inicio.categorias.subtitulo"
  | "inicio.categorias.titulo"
  | "inicio.cierre.boton"
  | "inicio.cierre.enlace"
  | "inicio.cierre.texto"
  | "inicio.cierre.titulo"
  | "inicio.destacados.enlaceTexto"
  | "inicio.destacados.titulo"
  | "inicio.marcas.titulo"
  | "inicio.seo.descripcion"
  | "inicio.seo.titulo"
  | "marca.encabezado.titulo"
  | "marca.seo.descripcion"
  | "marca.seo.titulo"
  | "marca.vacio.texto"
  | "nosotros.hero.texto"
  | "nosotros.hero.titulo"
  | "nosotros.seo.descripcion"
  | "nosotros.seo.titulo"
  | "pedido.explicacion.titulo"
  | "pedido.seo.descripcion"
  | "pedido.seo.titulo"
  | "privacidad.contenido.titulo"
  | "privacidad.seo.descripcion"
  | "privacidad.seo.titulo"
  | "producto.agotado.texto"
  | "producto.confianza.envio"
  | "producto.confianza.garantia"
  | "producto.confianza.pagos"
  | "producto.confianza.retiro"
  | "producto.relacionados.titulo"
  | "producto.whatsapp.mensaje"
  | "promociones.encabezado.texto"
  | "promociones.encabezado.titulo"
  | "promociones.seo.descripcion"
  | "promociones.seo.titulo"
  | "promociones.vacio.texto"
  | "terminos.contenido.titulo"
  | "terminos.seo.descripcion"
  | "terminos.seo.titulo"
  | "tienda.encabezado.texto"
  | "tienda.encabezado.titulo"
  | "tienda.seo.descripcion"
  | "tienda.seo.titulo"
  | "tienda.vacio.texto";
export type ClaveRico =
  | "garantias.contenido.texto"
  | "nosotros.historia.texto"
  | "pedido.explicacion.texto"
  | "privacidad.contenido.texto"
  | "terminos.contenido.texto";
export type ClaveFoto =
  | "global.marca.logo"
  | "global.seo.imagen"
  | "inicio.cierre.foto"
  | "nosotros.hero.foto"
  | "promociones.encabezado.foto";
