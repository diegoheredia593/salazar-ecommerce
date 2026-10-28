/**
 * SDK público para los sitios de los clientes (sprint 4a) — TypeScript sin dependencias
 * de terceros, solo `fetch` (inyectable, ver `fetch?` en OpcionesCliente). Consume
 * GET /v1/* (ver docs/api.md): siempre con la llave en Authorization: Bearer, nunca con
 * sesión. `elemento()` devuelve `null` en un 404 (no existe no es una excepción para un
 * getter puntual); todo lo demás lanza ErrorApiPlataforma en cualquier respuesta que no
 * sea 2xx/304.
 */
import type {
  Carrito,
  CategoriaTienda,
  OpcionesProductos,
  PaginaDeProductos,
  ProductoTienda,
} from './tienda';
import type { Bloque, ClaveColeccion, Colecciones, ElementoPersonalizado } from './tipos';

export * from './tipos';
export * from './render';
export * from './tienda';

export class ErrorApiPlataforma extends Error {
  readonly status: number;
  readonly detalle: unknown;
  /** En un 429: segundos que indica el encabezado Retry-After (si vino). */
  readonly reintentarEnSegundos: number | undefined;

  constructor(status: number, message: string, detalle: unknown, reintentarEnSegundos?: number) {
    super(message);
    this.name = 'ErrorApiPlataforma';
    this.status = status;
    this.detalle = detalle;
    this.reintentarEnSegundos = reintentarEnSegundos;
  }

  /**
   * En un 422 de enviarFormulario: un error por campo (`campo` vacío = error general).
   * Vacío en cualquier otro caso.
   */
  get errores(): { campo: string; mensaje: string }[] {
    const lista =
      this.detalle && typeof this.detalle === 'object' && 'errores' in this.detalle
        ? (this.detalle as { errores: unknown }).errores
        : undefined;
    return Array.isArray(lista) ? (lista as { campo: string; mensaje: string }[]) : [];
  }
}

export interface OpcionesCliente {
  /** URL base de /v1 (ver docs/api.md por modo: temporal o dominio). Sin la barra final. */
  url: string;
  /** Llave de lectura del cliente (pk_...), creada desde la ficha del superadmin. */
  llave: string;
  /** Para inyectar un fetch propio (tests, runtimes sin fetch global). Por defecto, el global. */
  fetch?: typeof fetch;
}

export interface OpcionesColeccion {
  pagina?: number;
  porPagina?: number;
  /** "campo:asc" o "campo:desc". */
  ordenarPor?: string;
  /** Igualdad exacta por campo, p. ej. { category: "ropa" }. */
  filtro?: Record<string, string>;
  formato?: 'json' | 'html';
}

export interface OpcionesElemento {
  formato?: 'json' | 'html';
}

export interface OpcionesEnvio {
  /**
   * IP del visitante que llenó el formulario. La plataforma limita los envíos por cliente e
   * IP (5 cada 15 minutos): sin esto, TODOS los visitantes del sitio compartirían la IP del
   * servidor y se bloquearían entre sí. Viaja en el encabezado X-Visitor-Ip.
   */
  ip?: string | undefined;
  /** Página del sitio desde la que se envió (p. ej. "/contacto"); se muestra en la bandeja. */
  pagina?: string | undefined;
}

/** Lo que el navegador del visitante le cuenta al sitio (ver `scriptVisitas`). */
export interface DatosVisita {
  /** Ruta de la página vista, sin parámetros: "/contacto". */
  pagina: string;
  /** Sitio desde el que llegó (el origen, p. ej. "https://www.google.com"); vacío si entró directo. */
  referente?: string | undefined;
  utm?:
    { source?: string | undefined; medium?: string | undefined; campaign?: string | undefined } | undefined;
  /** `screen.width` en px, para distinguir móvil, tableta y escritorio. */
  anchoPantalla?: number | undefined;
  /** Dominio del propio sitio ("www.ejemplo.com"), para reconocer la navegación interna. */
  sitio?: string | undefined;
}

/**
 * De la petición del visitante al servidor del sitio: lo que ESE servidor reenvía como encabezados de
 * confianza. La plataforma los usa para decidir robot/dispositivo/país y calcular el visitante del día, y
 * los descarta: nunca guarda la IP ni el user-agent.
 */
export interface OpcionesVisita {
  /** IP del visitante (`cf-connecting-ip`). */
  ip?: string | undefined;
  /** User-agent del visitante. */
  ua?: string | undefined;
  /** País ISO de dos letras (`request.cf.country`). */
  country?: string | undefined;
  /** Ciudad (`request.cf.city`). */
  city?: string | undefined;
}

/** Dónde es una cita: presencial (con dirección), llamada o videollamada (con enlace, solo en el correo). */
export type TipoDeLugar = 'in_person' | 'phone' | 'video';

/** Un tipo de cita reservable (GET /v1/agenda/tipos). Sin datos de las personas que atienden. */
export interface TipoDeCita {
  slug: string;
  nombre: string;
  descripcion: string | null;
  duracionMin: number;
  lugar: { tipo: TipoDeLugar; detalle: string | null };
  anticipacionMinHoras: number;
  ventanaDias: number;
}

/** Horarios libres de un tipo, agrupados por día en la zona del cliente (GET /v1/agenda/horarios). */
export interface HorariosLibres {
  /** Zona horaria del cliente, p. ej. "America/Guayaquil". */
  zona: string;
  /** «Hora de Ecuador (GMT-5)». */
  etiquetaZona: string;
  tipo: TipoDeCita;
  desde: string;
  hasta: string;
  dias: { fecha: string; horarios: { inicio: string; fin: string; hora: string }[] }[];
}

export interface DatosDeReserva {
  /** Dirección corta (slug) del tipo de cita. */
  tipo: string;
  /** Inicio del horario elegido, tal como lo devolvió `horariosLibres` (ISO 8601). */
  inicio: string;
  nombre: string;
  correo: string;
  telefono?: string | undefined;
  notas?: string | undefined;
}

/** Respuesta de reservar (201). `token` arma el enlace «Cambiar o cancelar» (<sitio>/cita/<token>). */
export interface CitaReservada {
  id: string;
  inicio: string;
  fin: string;
  zona: string;
  etiquetaZona: string;
  tipo: { slug: string; nombre: string };
  lugar: { tipo: TipoDeLugar; detalle: string | null };
  token: string;
}

/** Una cita vista con su token (GET/POST /v1/agenda/gestion/:token). */
export interface Cita {
  id: string;
  estado: 'confirmada' | 'cancelada' | 'realizada' | 'no_asistio';
  tipo: { slug: string | null; nombre: string | null };
  inicio: string;
  fin: string;
  zona: string;
  etiquetaZona: string;
  lugar: { tipo: TipoDeLugar; detalle: string | null };
  atiende: { nombre: string; correo: string | null } | null;
  contacto: { nombre: string | null };
  notas: string | null;
  motivoCancelacion: string | null;
  canceladaPor: 'team' | 'visitor' | null;
  /** false si ya pasó, está cancelada, o falta menos que la anticipación mínima del tipo. */
  puedeCambiar: boolean;
  motivoNoPuede: 'cancelled' | 'past' | 'status' | 'notice' | null;
  anticipacionMinHoras: number | null;
}

export interface PaginaDeElementos<T> {
  coleccion: string;
  paginaActual: number;
  porPagina: number;
  totalElementos: number;
  totalPaginas: number;
  elementos: T[];
}

export interface Cliente {
  /** Contador de versión de contenido — consulta barata para saber si algo cambió. */
  version(): Promise<number>;
  bloques(paginas?: string[]): Promise<Record<string, Bloque>>;
  coleccion<K extends ClaveColeccion>(
    modulo: K,
    opciones?: OpcionesColeccion,
  ): Promise<PaginaDeElementos<Colecciones[K]>>;
  /** Una colección personalizada del cliente (sus campos se tipan como registro genérico). */
  coleccion<T extends ElementoPersonalizado = ElementoPersonalizado>(
    modulo: string,
    opciones?: OpcionesColeccion,
  ): Promise<PaginaDeElementos<T>>;
  /** null si no existe, no es público, o la colección no tiene dirección (slug). */
  elemento<K extends ClaveColeccion>(
    modulo: K,
    slug: string,
    opciones?: OpcionesElemento,
  ): Promise<Colecciones[K] | null>;
  elemento<T extends ElementoPersonalizado = ElementoPersonalizado>(
    modulo: string,
    slug: string,
    opciones?: OpcionesElemento,
  ): Promise<T | null>;
  /**
   * Envía un formulario (POST /v1/formularios/:tipo). Requiere una llave con el alcance
   * "formularios:enviar". Llámalo desde el SERVIDOR del sitio, nunca desde el navegador.
   * Lanza ErrorApiPlataforma: 404 (tipo inexistente o inactivo), 403 (la llave no tiene el
   * alcance), 422 (datos inválidos; ver `error.errores`), 429 (límite; ver
   * `error.reintentarEnSegundos`).
   */
  enviarFormulario(
    tipo: string,
    datos: Record<string, string>,
    opciones?: OpcionesEnvio,
  ): Promise<{ id: string }>;
  /**
   * Registra una visita (POST /v1/visitas, responde 202). Requiere una llave con el alcance
   * "visitas:registrar". Llámalo desde el SERVIDOR del sitio —con `waitUntil`, para no demorar al
   * visitante—, nunca desde el navegador. Sin cookies: ver `scriptVisitas()`.
   */
  registrarVisita(datos: DatosVisita, opciones?: OpcionesVisita): Promise<void>;
  /**
   * Los tipos de cita reservables (GET /v1/agenda/tipos). Requiere una llave con el alcance
   * "agenda:reservar" y la agenda encendida (si no, 404). Llámalo desde el SERVIDOR del sitio.
   */
  tiposDeCita(): Promise<{ zona: string; tipos: TipoDeCita[] }>;
  /**
   * Horarios libres de un tipo (GET /v1/agenda/horarios), agrupados por día local, máximo 31 días por
   * consulta. Sin `desde`, empieza hoy (en la zona del cliente).
   */
  horariosLibres(tipo: string, opciones?: { desde?: string; hasta?: string }): Promise<HorariosLibres>;
  /**
   * Reserva una cita (POST /v1/agenda/citas). Reenvía lo que sepas del visitante (`ip`, `ua`) para el
   * límite por IP. 409 = «Ese horario ya no está disponible» (otra persona lo reservó primero): vuelve a
   * pedir `horariosLibres`. 422 trae `error.errores` por campo.
   */
  reservarCita(datos: DatosDeReserva, opciones?: OpcionesVisita): Promise<CitaReservada>;
  /** La cita de un token (GET /v1/agenda/gestion/:token); null si el token no existe. */
  verCita(token: string): Promise<Cita | null>;
  /** Cancela la cita del token (motivo opcional). 409 si ya no se puede (pasó, o dentro de la anticipación). */
  cancelarCita(token: string, motivo?: string): Promise<Cita>;
  /** Cambia la cita a otro horario libre del mismo tipo (`inicio` de `horariosLibres`). */
  reprogramarCita(token: string, inicio: string): Promise<Cita>;
  /**
   * Tienda (sprint 13a). Catálogo con el alcance "tienda:leer"; carrito con "tienda:carrito". Con el módulo
   * apagado todo responde 404. Llámalo desde el SERVIDOR del sitio. Montos en centavos.
   */
  categorias(): Promise<CategoriaTienda[]>;
  /** Productos publicados (los borradores y archivados nunca salen), con filtro por categoría y búsqueda. */
  productos(opciones?: OpcionesProductos): Promise<PaginaDeProductos>;
  /** Un producto publicado con sus variantes, stock disponible y precios; null si no existe o no está publicado. */
  producto(slug: string): Promise<ProductoTienda | null>;
  /** Crea un carrito (vacío o con líneas). Guarda `carrito.token` donde quieras: la plataforma no pone cookies. */
  crearCarrito(lineas?: { variante: string; cantidad: number }[]): Promise<Carrito>;
  /** El carrito de un token, con los totales y avisos al día; null si no existe o venció (30 días sin cambios). */
  verCarrito(token: string): Promise<Carrito | null>;
  /** Suma unidades de una variante (si ya estaba, se acumula). */
  agregarAlCarrito(token: string, variante: string, cantidad?: number): Promise<Carrito>;
  /** Fija la cantidad de una variante (0 la quita). */
  cambiarCantidad(token: string, variante: string, cantidad: number): Promise<Carrito>;
  quitarDelCarrito(token: string, variante: string): Promise<Carrito>;
  /** Aplica un código. Si no sirve, el carrito vuelve sin él y con el motivo en `avisos`. */
  aplicarCodigo(token: string, codigo: string): Promise<Carrito>;
  quitarCodigo(token: string): Promise<Carrito>;
}

/**
 * El script de visitas para el navegador: menos de 1 KB, sin cookies ni localStorage. Al cargar la página
 * manda con `sendBeacon` la ruta, el origen, los utm y el ancho de pantalla a `endpoint` (por defecto
 * `/api/visita`, del MISMO sitio), que reenvía a la plataforma con `registrarVisita`. No hace nada si el
 * visitante activó No Rastrear (DNT) o Global Privacy Control (GPC). Con el enrutador de vistas de Astro
 * (`ClientRouter`) cuenta también cada navegación (evento `astro:page-load`), con la página anterior como
 * referente, sin duplicar la carga inicial.
 */
export function scriptVisitas(opciones: { endpoint?: string } = {}): string {
  const endpoint = JSON.stringify(opciones.endpoint ?? '/api/visita');
  return (
    '(function(){var n=navigator,l=location,w=window,p;' +
    'if(w.__v||n.doNotTrack=="1"||w.doNotTrack=="1"||n.globalPrivacyControl===true||!n.sendBeacon)return;w.__v=1;' +
    'function s(){if(p==l.href)return;var r=p||document.referrer,q=new URLSearchParams(l.search),u={};p=l.href;' +
    '["source","medium","campaign"].forEach(function(k){var v=q.get("utm_"+k);if(v)u[k]=v});' +
    'try{r=new URL(r).origin}catch(e){r=""}' +
    `n.sendBeacon(${endpoint},new Blob([JSON.stringify({pagina:l.pathname,referente:r,utm:u,anchoPantalla:screen.width,sitio:l.hostname})],{type:"application/json"}))}` +
    'document.addEventListener("astro:page-load",s);' +
    'document.readyState=="complete"?s():w.addEventListener("load",s)})()'
  );
}

function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) usp.set(key, value);
  const query = usp.toString();
  return query ? `?${query}` : '';
}

async function errorFrom(res: Response): Promise<ErrorApiPlataforma> {
  let detalle: unknown;
  try {
    detalle = await res.json();
  } catch {
    detalle = undefined;
  }
  const mensaje =
    detalle && typeof detalle === 'object' && 'error' in detalle && typeof detalle.error === 'string'
      ? detalle.error
      : `Error ${res.status}`;
  const reintento = Number(res.headers.get('Retry-After'));
  return new ErrorApiPlataforma(
    res.status,
    mensaje,
    detalle,
    Number.isFinite(reintento) && reintento > 0 ? reintento : undefined,
  );
}

/** User-agent a ASCII sin cambiarlo en el caso común (casi todos lo son). */
function encodeURIComponentSafe(value: string): string {
  return /^[ -~]*$/.test(value) ? value : encodeURIComponent(value);
}

export function crearCliente(config: OpcionesCliente): Cliente {
  const base = config.url.replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;

  function get(path: string): Promise<Response> {
    return doFetch(`${base}${path}`, { headers: { Authorization: `Bearer ${config.llave}` } });
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await get(path);
    if (!res.ok) throw await errorFrom(res);
    return res.json() as Promise<T>;
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    return sendJson<T>('POST', path, body);
  }

  async function sendJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.llave}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw await errorFrom(res);
    return res.json() as Promise<T>;
  }

  const carrito = (token: string) => `/tienda/carritos/${encodeURIComponent(token)}`;

  return {
    async version() {
      return (await getJson<{ version: number }>('/version')).version;
    },

    async bloques(paginas) {
      const qs = buildQuery({ paginas: paginas?.join(',') });
      return (await getJson<{ bloques: Record<string, Bloque> }>(`/bloques${qs}`)).bloques;
    },

    async coleccion(modulo: string, opciones: OpcionesColeccion = {}): Promise<never> {
      const usp = new URLSearchParams();
      if (opciones.pagina !== undefined) usp.set('pagina', String(opciones.pagina));
      if (opciones.porPagina !== undefined) usp.set('porPagina', String(opciones.porPagina));
      if (opciones.ordenarPor !== undefined) usp.set('ordenarPor', opciones.ordenarPor);
      if (opciones.formato !== undefined) usp.set('formato', opciones.formato);
      for (const [campo, valor] of Object.entries(opciones.filtro ?? {})) usp.set(`filtro[${campo}]`, valor);
      const query = usp.toString();
      return getJson(`/colecciones/${modulo}${query ? `?${query}` : ''}`);
    },

    async enviarFormulario(tipo, datos, opciones = {}) {
      const res = await doFetch(`${base}/formularios/${encodeURIComponent(tipo)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.llave}`,
          'Content-Type': 'application/json',
          ...(opciones.ip ? { 'X-Visitor-Ip': opciones.ip } : {}),
        },
        body: JSON.stringify({ datos, ...(opciones.pagina ? { pagina: opciones.pagina } : {}) }),
      });
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as { id: string };
    },

    async registrarVisita(datos, opciones = {}) {
      const res = await doFetch(`${base}/visitas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.llave}`,
          'Content-Type': 'application/json',
          ...(opciones.ip ? { 'X-Visitor-Ip': opciones.ip } : {}),
          // Los encabezados HTTP son ASCII: el user-agent y la ciudad viajan tal cual o codificados.
          ...(opciones.ua ? { 'X-Visitor-UA': encodeURIComponentSafe(opciones.ua) } : {}),
          ...(opciones.country ? { 'X-Visitor-Country': opciones.country } : {}),
          ...(opciones.city ? { 'X-Visitor-City': encodeURIComponent(opciones.city) } : {}),
        },
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw await errorFrom(res);
    },

    async tiposDeCita() {
      return getJson<{ zona: string; tipos: TipoDeCita[] }>('/agenda/tipos');
    },

    async horariosLibres(tipo, opciones = {}) {
      const qs = buildQuery({ tipo, desde: opciones.desde, hasta: opciones.hasta });
      return getJson<HorariosLibres>(`/agenda/horarios${qs}`);
    },

    async reservarCita(datos, opciones = {}) {
      const res = await doFetch(`${base}/agenda/citas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.llave}`,
          'Content-Type': 'application/json',
          ...(opciones.ip ? { 'X-Visitor-Ip': opciones.ip } : {}),
          ...(opciones.ua ? { 'X-Visitor-UA': encodeURIComponentSafe(opciones.ua) } : {}),
          ...(opciones.country ? { 'X-Visitor-Country': opciones.country } : {}),
          ...(opciones.city ? { 'X-Visitor-City': encodeURIComponent(opciones.city) } : {}),
        },
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as CitaReservada;
    },

    async verCita(token) {
      const res = await get(`/agenda/gestion/${encodeURIComponent(token)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as Cita;
    },

    async cancelarCita(token, motivo) {
      return postJson<Cita>(`/agenda/gestion/${encodeURIComponent(token)}`, {
        accion: 'cancelar',
        ...(motivo ? { motivo } : {}),
      });
    },

    async reprogramarCita(token, inicio) {
      return postJson<Cita>(`/agenda/gestion/${encodeURIComponent(token)}`, {
        accion: 'reprogramar',
        inicio,
      });
    },

    async categorias() {
      return (await getJson<{ categorias: CategoriaTienda[] }>('/tienda/categorias')).categorias;
    },

    async productos(opciones = {}) {
      const qs = buildQuery({
        categoria: opciones.categoria,
        buscar: opciones.buscar,
        pagina: opciones.pagina === undefined ? undefined : String(opciones.pagina),
        porPagina: opciones.porPagina === undefined ? undefined : String(opciones.porPagina),
      });
      return getJson<PaginaDeProductos>(`/tienda/productos${qs}`);
    },

    async producto(slug) {
      const res = await get(`/tienda/productos/${encodeURIComponent(slug)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as ProductoTienda;
    },

    async crearCarrito(lineas) {
      return postJson<Carrito>('/tienda/carritos', lineas?.length ? { lineas } : {});
    },

    async verCarrito(token) {
      const res = await get(carrito(token));
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as Carrito;
    },

    async agregarAlCarrito(token, variante, cantidad = 1) {
      return postJson<Carrito>(`${carrito(token)}/lineas`, { variante, cantidad });
    },

    async cambiarCantidad(token, variante, cantidad) {
      return sendJson<Carrito>('PUT', `${carrito(token)}/lineas/${encodeURIComponent(variante)}`, {
        cantidad,
      });
    },

    async quitarDelCarrito(token, variante) {
      return sendJson<Carrito>('DELETE', `${carrito(token)}/lineas/${encodeURIComponent(variante)}`);
    },

    async aplicarCodigo(token, codigo) {
      return postJson<Carrito>(`${carrito(token)}/codigo`, { codigo });
    },

    async quitarCodigo(token) {
      return sendJson<Carrito>('DELETE', `${carrito(token)}/codigo`);
    },

    async elemento(modulo: string, slug: string, opciones: OpcionesElemento = {}): Promise<never | null> {
      const qs = buildQuery({ formato: opciones.formato });
      const res = await get(`/colecciones/${modulo}/${encodeURIComponent(slug)}${qs}`);
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFrom(res);
      return res.json();
    },
  };
}
