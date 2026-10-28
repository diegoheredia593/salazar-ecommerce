// Mejoras con JavaScript. Todo funciona sin él (formularios con POST y 303, menú con <details>, pestañas como enlaces).
// El navegador solo habla con endpoints del propio sitio: nunca con la plataforma.

// Element | Document (no ParentNode: los tipos de Workers definen otro ParentNode que choca con el del DOM).
type Raiz = Element | Document;
const $ = <T extends Element>(sel: string, raiz: Raiz = document) => raiz.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, raiz: Raiz = document) => [...raiz.querySelectorAll<T>(sel)];

// ─── Aviso flotante ──────────────────────────────────────────────────────
let temporizador: number | undefined;
function avisar(html: string) {
  const aviso = $<HTMLElement>('[data-aviso-flotante]');
  if (!aviso) return;
  aviso.innerHTML = html;
  aviso.classList.add('visible');
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(() => aviso.classList.remove('visible'), 4500);
}

function actualizarContador(articulos: number) {
  for (const c of $$<HTMLElement>('[data-contador-carrito]')) {
    c.textContent = String(articulos);
    c.hidden = articulos === 0;
  }
  for (const t of $$<HTMLElement>('[data-contador-texto]')) t.textContent = articulos === 1 ? '1 artículo' : `${articulos} artículos`;
}

// ─── Menú móvil ──────────────────────────────────────────────────────────
function iniciarMenu() {
  const menu = $<HTMLDetailsElement>('[data-menu-movil]');
  if (!menu) return;
  const cerrar = () => {
    menu.open = false;
    $<HTMLElement>('summary', menu)?.focus();
  };
  $('[data-cerrar-menu]', menu)?.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && menu.open && cerrar());
  document.addEventListener('click', (e) => {
    if (menu.open && !(e.target as Element).closest('.panel, summary')) menu.open = false;
  });
  menu.addEventListener('toggle', () => document.body.style.setProperty('overflow', menu.open ? 'hidden' : ''));
}

// ─── Carrito: /api/carrito es el único lugar donde se toca ──────────────
interface RespuestaCarrito { ok: boolean; articulos?: number; mensaje?: string; redirigir?: string }

async function enviarCarrito(form: HTMLFormElement, boton: HTMLButtonElement | null) {
  const datos = new FormData(form);
  if (boton?.name) datos.set(boton.name, boton.value);
  form.setAttribute('aria-busy', 'true');
  try {
    const r = await fetch(form.action, { method: 'POST', body: datos, headers: { Accept: 'application/json' } });
    const json = (await r.json()) as RespuestaCarrito;
    if (json.redirigir) {
      window.location.href = json.redirigir;
      return;
    }
    if (typeof json.articulos === 'number') actualizarContador(json.articulos);
    const pagina = form.closest('[data-carrito-pagina]');
    if (pagina) {
      // En /carrito: se vuelve a pintar el carrito (totales y avisos los calcula la plataforma).
      const html = await (await fetch('/carrito', { headers: { Accept: 'text/html' } })).text();
      const nuevo = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-carrito-pagina]');
      if (nuevo) {
        pagina.replaceWith(nuevo);
        iniciarCantidades(nuevo);
        $<HTMLElement>('[data-carrito-estado]', nuevo)?.focus();
      }
    } else if (json.ok) {
      avisar(`<span>${json.mensaje ?? 'Agregado al carrito'}</span><a href="/carrito">Ver carrito</a>`);
    } else {
      avisar(`<span>${json.mensaje ?? 'No se pudo actualizar el carrito.'}</span>`);
    }
  } catch {
    form.submit(); // sin red o algo raro: el camino sin JavaScript
  } finally {
    form.removeAttribute('aria-busy');
  }
}

function iniciarCarrito() {
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-carrito]')) return;
    e.preventDefault();
    void enviarCarrito(form, (e as SubmitEvent).submitter as HTMLButtonElement | null);
  });
}

// ─── Selector de cantidad ─────────────────────────────────────────────────
function iniciarCantidades(raiz: Raiz = document) {
  for (const caja of $$<HTMLElement>('[data-cantidad]', raiz)) {
    const input = $<HTMLInputElement>('input', caja)!;
    for (const b of $$<HTMLButtonElement>('button[data-paso]', caja)) {
      b.hidden = false;
      b.addEventListener('click', () => {
        const min = Number(input.min || 1);
        const max = Number(input.max || 99);
        input.value = String(Math.min(max, Math.max(min, Number(input.value || 1) + Number(b.dataset.paso))));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
}

// ─── Variantes de la ficha ──────────────────────────────────────────────
function iniciarVariantes() {
  document.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name !== 'variante' || !input.dataset.precio) return;
    const ficha = input.closest('[data-ficha]');
    if (!ficha) return;
    const precio = $<HTMLElement>('[data-precio]', ficha);
    const anterior = $<HTMLElement>('[data-anterior]', ficha);
    const stock = $<HTMLElement>('[data-stock]', ficha);
    if (precio) precio.textContent = input.dataset.precio;
    if (anterior) {
      anterior.textContent = input.dataset.anterior ?? '';
      anterior.hidden = !input.dataset.anterior;
    }
    if (stock) stock.textContent = input.dataset.stock ?? '';
    const cantidad = $<HTMLInputElement>('input[name="cantidad"]', ficha);
    if (cantidad && input.dataset.disponible) cantidad.max = input.dataset.disponible;
  });
}

// ─── Formularios → /api/formularios/<tipo> ──────────────────────────────
interface RespuestaFormulario { ok: boolean; mensaje?: string; errores?: { campo: string; mensaje: string }[] }

function iniciarFormularios() {
  document.addEventListener('submit', async (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-formulario]')) return;
    e.preventDefault();
    const mensaje = $<HTMLElement>('[data-mensaje]', form);
    const boton = $<HTMLButtonElement>('button[type="submit"]', form);
    for (const err of $$<HTMLElement>('[data-error]', form)) err.textContent = '';
    for (const campo of $$<HTMLElement>('[aria-invalid]', form)) campo.removeAttribute('aria-invalid');
    if (mensaje) { mensaje.textContent = ''; mensaje.className = 'mensaje'; }
    if (boton) { boton.disabled = true; boton.dataset.texto = boton.textContent ?? ''; boton.textContent = 'Enviando…'; }
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const json = (await r.json()) as RespuestaFormulario;
      if (json.ok) {
        form.reset();
        if (mensaje) { mensaje.className = 'mensaje mensaje-ok'; mensaje.textContent = form.dataset.exito ?? json.mensaje ?? 'Listo.'; }
        (window as { turnstile?: { reset: () => void } }).turnstile?.reset();
        return;
      }
      let primero: HTMLElement | null = null;
      for (const err of json.errores ?? []) {
        const campo = form.elements.namedItem(err.campo);
        const destino = $<HTMLElement>(`[data-error="${CSS.escape(err.campo)}"]`, form);
        if (destino) destino.textContent = err.mensaje;
        if (campo instanceof HTMLElement) {
          campo.setAttribute('aria-invalid', 'true');
          primero ??= campo;
        }
      }
      if (mensaje) { mensaje.className = 'mensaje mensaje-error'; mensaje.textContent = json.mensaje ?? 'Revisa los campos del formulario.'; }
      primero?.focus();
    } catch {
      if (mensaje) { mensaje.className = 'mensaje mensaje-error'; mensaje.textContent = 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.'; }
    } finally {
      if (boton) { boton.disabled = false; boton.textContent = boton.dataset.texto ?? ''; }
    }
  });
}

// ─── Carrusel de la portada (sin avance automático: el visitante decide) ─
function iniciarCarruseles() {
  for (const c of $$<HTMLElement>('[data-carrusel]')) {
    const pista = $<HTMLElement>('[data-pista]', c)!;
    const diapositivas = $$<HTMLElement>('[data-diapositiva]', c);
    const puntos = $$<HTMLButtonElement>('[data-punto]', c);
    if (diapositivas.length < 2) continue;
    c.classList.add('activo');
    const ir = (i: number) => {
      const destino = (i + diapositivas.length) % diapositivas.length;
      pista.scrollTo({ left: diapositivas[destino]!.offsetLeft - pista.offsetLeft, behavior: 'smooth' });
    };
    const actual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    $('[data-anterior-diapositiva]', c)?.addEventListener('click', () => ir(actual() - 1));
    $('[data-siguiente-diapositiva]', c)?.addEventListener('click', () => ir(actual() + 1));
    puntos.forEach((p, i) => p.addEventListener('click', () => ir(i)));
    pista.addEventListener('scroll', () => {
      const i = actual();
      puntos.forEach((p, j) => p.setAttribute('aria-current', String(i === j)));
      diapositivas.forEach((d, j) => d.setAttribute('aria-hidden', String(i !== j)));
    }, { passive: true });
  }
}

// ─── Pestañas de productos destacados ──────────────────────────────────
function iniciarPestanas() {
  for (const grupo of $$<HTMLElement>('[data-pestanas]')) {
    const enlaces = $$<HTMLAnchorElement>('[data-filtro]', grupo);
    const tarjetas = $$<HTMLElement>('[data-categoria]', grupo.parentElement ?? document);
    for (const enlace of enlaces) {
      enlace.setAttribute('role', 'button');
      enlace.addEventListener('click', (e) => {
        e.preventDefault();
        const filtro = enlace.dataset.filtro;
        for (const otro of enlaces) otro.setAttribute('aria-pressed', String(otro === enlace));
        for (const t of tarjetas) (t.closest('li') ?? t).hidden = Boolean(filtro) && t.dataset.categoria !== filtro;
      });
    }
  }
}

iniciarMenu();
iniciarCarrito();
iniciarCantidades();
iniciarVariantes();
iniciarFormularios();
iniciarCarruseles();
iniciarPestanas();
