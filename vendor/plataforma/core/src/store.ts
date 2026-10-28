/**
 * Tienda (sprint 13a): vocabulario y reglas PURAS que comparten el Worker, el pago, el SDK y el portal. Nada aquí lee
 * la base ni envía nada. Toda la cuenta de precios y descuentos vive aquí (`priceCart`): el servidor la corre con
 * los precios que lee de la base en ese instante; lo que diga el navegador nunca entra en un total.
 *
 * Dinero siempre en centavos (enteros). Precios con IVA incluido; la tarifa de IVA de cada producto se guarda para la
 * facturación electrónica (13d).
 */

import { formatMoneyExact } from './events';

export const STORE_MODULE = 'tienda';

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

/** Publicado = se ve en el sitio · Borrador = solo en el portal · Archivado = fuera del sitio, sigue en pedidos. */
export const PRODUCT_STATUSES = ['published', 'draft', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  published: 'Publicado',
  draft: 'Borrador',
  archived: 'Archivado',
};

/** Tarifas de IVA de Ecuador para un producto, en puntos básicos (1500 = 15 %). */
export const TAX_RATES_BP = [1500, 0] as const;
export type TaxRateBp = (typeof TAX_RATES_BP)[number];

export const STORE_LIMITS = {
  optionsMax: 3,
  optionValuesMax: 20,
  variantsMax: 100,
  photosMax: 10,
  nameMax: 120,
  descriptionMax: 2000,
  shortDescriptionMax: 160,
  priceMaxCents: 100_000_00,
  stockMax: 1_000_000,
  skuMax: 40,
  weightMaxGrams: 1_000_000,
  categoriesMax: 60,
  /** Horas para pagar antes de que el pedido venza y el stock vuelva (Cobros → Reserva de stock). */
  holdHoursDefault: 24,
  holdHoursOptions: [2, 6, 12, 24, 48, 72] as readonly number[],
  /** El carrito vive en el servidor este tiempo desde su último cambio. */
  cartDays: 30,
  cartLinesMax: 50,
  quantityMax: 99,
  codeMin: 3,
  codeMax: 24,
  discountNameMax: 80,
  shippingRatesMax: 40,
  courierMax: 60,
  trackingMax: 60,
  cancelReasonMax: 300,
  addressMax: 200,
  referenceMax: 160,
  /** Tasa de comisión de la tienda, en puntos básicos (como la de eventos). */
  commissionBpMax: 5000,
} as const;

export interface ProductOption {
  /** «Presentación», «Peso», «Color». */
  name: string;
  values: string[];
}

/** Todas las combinaciones de las opciones, en orden («Grano · 250 g», «Grano · 500 g», «Molido · 250 g»…). */
export function variantCombos(options: ProductOption[]): string[][] {
  let out: string[][] = [[]];
  for (const option of options) {
    const next: string[][] = [];
    for (const combo of out) for (const value of option.values) next.push([...combo, value]);
    out = next;
  }
  return options.length ? out : [[]];
}

/** «Grano · 500 g» (o vacío para un producto sin opciones). */
export const variantLabel = (values: string[]): string => values.filter(Boolean).join(' · ');

/** Clave estable de una combinación (para comparar sin importar mayúsculas ni espacios). */
export const comboKey = (values: string[]): string => values.map((v) => normalizeText(v)).join('|');

/** «Café de altura Vilcabamba» → «cafe-de-altura-vilcabamba». */
export function productSlug(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Texto para comparar: minúsculas, sin tildes y con un solo espacio. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/**
 * awaiting_payment = Por pagar (reservó stock, falta el pago o el comprobante) · pending = Por verificar ·
 * paid = Por preparar (pago confirmado) · shipped = Enviado · ready = Listo para retirar · delivered = Entregado ·
 * expired = Vencido (se acabó el tiempo sin pago) · cancelled = Cancelado · refund_pending = Por devolver (sprint
 * 12d: un pedido de evento pagado que se va a devolver; sus entradas ya no entran) · refunded = Devuelto.
 */
export const STORE_ORDER_STATUSES = [
  'awaiting_payment',
  'pending',
  'paid',
  'shipped',
  'ready',
  'delivered',
  'expired',
  'cancelled',
  'refund_pending',
  'refunded',
] as const;
export type StoreOrderStatus = (typeof STORE_ORDER_STATUSES)[number];

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  awaiting_payment: 'Por pagar',
  pending: 'Por verificar',
  paid: 'Por preparar',
  shipped: 'Enviado',
  ready: 'Listo para retirar',
  delivered: 'Entregado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
  refund_pending: 'Por devolver',
  refunded: 'Devuelto',
};

/** «Por atender»: por verificar + por preparar + por devolver (13d) (el contador del menú «Tienda»). */
export const STORE_ATTENTION_STATUSES: readonly StoreOrderStatus[] = ['pending', 'paid', 'refund_pending'];

/** Pedidos que cuentan para el uso de un código y para el número de transacción (los «vivos»). */
export const STORE_LIVE_STATUSES: readonly StoreOrderStatus[] = [
  'awaiting_payment',
  'pending',
  'paid',
  'shipped',
  'ready',
  'delivered',
];

/** Con el pago ya confirmado (las ventas: comisión, reportes, «vendidos»). */
export const STORE_PAID_STATUSES: readonly StoreOrderStatus[] = ['paid', 'shipped', 'ready', 'delivered'];

/** `cash` = efectivo al recibir (sprint 13c): solo se ofrece con reparto propio. */
export const PAYMENT_METHODS = ['transfer', 'external_link', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: 'Transferencia',
  external_link: 'Enlace de pago',
  cash: 'Efectivo al recibir',
};

/** shipping = envío por courier · pickup = retiro en el local · local = reparto propio con motorizados (13c). */
export const DELIVERY_METHODS = ['shipping', 'pickup', 'local'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

/** Prefijo de los pedidos de la tienda («Cumbre Café» → CUMB). Cuatro letras, como en la referencia. */
export function defaultStorePrefix(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const word = words.find((w) => w.length >= 3 && !['THE', 'LOS', 'LAS', 'DEL', 'LA', 'EL'].includes(w));
  const pick = (word ?? words[0] ?? 'TIENDA').slice(0, 4);
  return pick.length >= 2 ? pick : 'TIEN';
}

/**
 * SKU automático (13d) de una variante que se guarda sin SKU: el prefijo de los pedidos y un número del cliente
 * («CUMB-0007»). Lo calcula la sentencia que guarda (ver `worker/data/store.ts`); esta es la forma, para los tests y la
 * pantalla.
 */
export const skuFor = (prefix: string, n: number): string => `${prefix}-${String(n).padStart(4, '0')}`;

/** Días después de entregado o cancelado en que se borran los datos de los compradores de la tienda (13d). */
export const STORE_BUYER_DATA_DAYS = { min: 7, max: 3650, default: 365 } as const;

export const isStoreBuyerDataDays = (n: number): boolean =>
  Number.isInteger(n) && n >= STORE_BUYER_DATA_DAYS.min && n <= STORE_BUYER_DATA_DAYS.max;

/** Lo que queda en el nombre del comprador después de la purga (eventos y tienda, 13d). */
export const PURGED_BUYER_NAME = 'Datos borrados';

/** «1 artículo», «3 artículos». */
export const articlesText = (n: number): string => (n === 1 ? '1 artículo' : `${n} artículos`);

// ---------------------------------------------------------------------------
// Descuentos
// ---------------------------------------------------------------------------

export const DISCOUNT_SCOPES = ['all', 'categories', 'products'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

/**
 * Automáticos: porcentaje (puntos básicos), un monto fijo por unidad (centavos) o un PRECIO fijo por unidad
 * (centavos) — este último es `fixed_price` (sprint 12e, Preventa de eventos): a diferencia de `amount`, sostiene
 * un precio aunque el de lista cambie después («precio de preventa $30», no «$10 de descuento»).
 */
export const AUTO_DISCOUNT_KINDS = ['percent', 'amount', 'fixed_price'] as const;
export type AutoDiscountKind = (typeof AUTO_DISCOUNT_KINDS)[number];

/** Códigos: porcentaje, monto fijo sobre la compra o envío gratis. */
export const CODE_KINDS = ['percent', 'amount', 'free_shipping'] as const;
export type CodeKind = (typeof CODE_KINDS)[number];

/** Estado de una vigencia: se CALCULA con la fecha, nunca se guarda. */
export type DiscountState = 'scheduled' | 'active' | 'ended';

export const DISCOUNT_STATE_LABELS: Record<DiscountState, string> = {
  scheduled: 'Programado',
  active: 'Activo',
  ended: 'Terminado',
};

export function discountState(startsAt: Date | null, endsAt: Date | null, now: Date): DiscountState {
  if (startsAt && now.getTime() < startsAt.getTime()) return 'scheduled';
  if (endsAt && now.getTime() >= endsAt.getTime()) return 'ended';
  return 'active';
}

/** Estado de un código: pausado y agotado mandan sobre la vigencia. */
export type CodeState = DiscountState | 'paused' | 'exhausted';

export const CODE_STATE_LABELS: Record<CodeState, string> = {
  ...DISCOUNT_STATE_LABELS,
  paused: 'Pausado',
  exhausted: 'Agotado',
};

export function codeState(
  code: { paused: boolean; usageLimit: number | null; startsAt: Date | null; endsAt: Date | null },
  used: number,
  now: Date,
): CodeState {
  if (code.paused) return 'paused';
  if (code.usageLimit !== null && used >= code.usageLimit) return 'exhausted';
  return discountState(code.startsAt, code.endsAt, now);
}

/** Lo que escribe la persona: sin espacios y en mayúsculas («semana 10» → SEMANA10). */
export function normalizeCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export const CODE_PATTERN = /^[A-Z0-9_-]{3,24}$/;

export interface AutoDiscount {
  id: string;
  name: string;
  scope: DiscountScope;
  /** Categorías o productos (según `scope`); vacío con «toda la tienda». */
  targetIds: string[];
  kind: AutoDiscountKind;
  /** Puntos básicos (percent) o centavos por unidad (amount). */
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface DiscountCode {
  id: string;
  code: string;
  kind: CodeKind;
  /** Puntos básicos (percent), centavos (amount) o 0 (free_shipping). */
  value: number;
  minSubtotalCents: number;
  scope: DiscountScope;
  targetIds: string[];
  /** Se suma a los descuentos automáticos (si no, se aplica el mayor). */
  stacks: boolean;
}

export interface PricedItem {
  productId: string;
  categoryId: string | null;
  /** La categoría padre de `categoryId` (sprint 13b, dos niveles): un descuento de «Licores» alcanza a «Ron». */
  parentCategoryId?: string | null | undefined;
}

export function inScope(scope: DiscountScope, targetIds: string[], item: PricedItem): boolean {
  if (scope === 'all') return true;
  if (scope === 'categories')
    return (
      (!!item.categoryId && targetIds.includes(item.categoryId)) ||
      (!!item.parentCategoryId && targetIds.includes(item.parentCategoryId))
    );
  return targetIds.includes(item.productId);
}

/** Porcentaje de un monto con redondeo al centavo (la mitad hacia arriba), la misma regla que la comisión. */
export const percentOf = (cents: number, bp: number): number => Math.floor((cents * bp + 5000) / 10000);

/** Descuento por unidad de un automático sobre un precio (nunca más que el precio, nunca negativo). */
export function autoUnitDiscount(
  unitPriceCents: number,
  discount: Pick<AutoDiscount, 'kind' | 'value'>,
): number {
  const off =
    discount.kind === 'percent'
      ? percentOf(unitPriceCents, discount.value)
      : discount.kind === 'fixed_price'
        ? unitPriceCents - discount.value
        : discount.value;
  return Math.max(0, Math.min(unitPriceCents, off));
}

/** El automático vigente que más descuenta a un producto (o null). Empate: el primero de la lista. */
export function bestAutoDiscount(
  item: PricedItem & { unitPriceCents: number },
  discounts: AutoDiscount[],
  now: Date,
): { discount: AutoDiscount; unitOffCents: number } | null {
  let best: { discount: AutoDiscount; unitOffCents: number } | null = null;
  for (const d of discounts) {
    if (discountState(d.startsAt, d.endsAt, now) !== 'active') continue;
    if (!inScope(d.scope, d.targetIds, item)) continue;
    const off = autoUnitDiscount(item.unitPriceCents, d);
    if (off > 0 && (!best || off > best.unitOffCents)) best = { discount: d, unitOffCents: off };
  }
  return best;
}

/** «−15 %», «−$3,00» o «$30,00» (precio de preventa: es un precio, no un descuento — sin el signo menos). */
export function discountTag(discount: Pick<AutoDiscount, 'kind' | 'value'>): string {
  if (discount.kind === 'percent') return `−${formatBp(discount.value)}`;
  if (discount.kind === 'fixed_price') return formatMoneyExact(discount.value);
  return `−${formatMoneyExact(discount.value)}`;
}

/** «15 %», «5,5 %». */
export const formatBp = (bp: number): string =>
  `${(bp / 100).toLocaleString('es-EC', { maximumFractionDigits: 2 })} %`;

/** «$9,50 – $17,00» o «$8,50» (rango de precios de un producto con variantes). */
export function priceRange(prices: number[]): string {
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoneyExact(min) : `${formatMoneyExact(min)} – ${formatMoneyExact(max)}`;
}

/** «10 % en toda la tienda», «$5,00», «Envío gratis» (lo que hace un código, en corto). */
export function codeValueText(code: Pick<DiscountCode, 'kind' | 'value'>): string {
  if (code.kind === 'free_shipping') return 'Envío gratis';
  return code.kind === 'percent' ? formatBp(code.value) : formatMoneyExact(code.value);
}

// ---------------------------------------------------------------------------
// Cuenta del carrito y del pedido
// ---------------------------------------------------------------------------

export interface CartLineInput extends PricedItem {
  /** Identifica la línea en la respuesta (el id de la variante). */
  key: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PricedLine {
  key: string;
  quantity: number;
  unitPriceCents: number;
  /** Precio × cantidad, sin descuentos. */
  listCents: number;
  /** Descuento automático de la línea (0 si no aplica o si ganó el código). */
  autoDiscountCents: number;
  autoDiscountId: string | null;
  /** Parte del código que cae en esta línea (porcentaje: por línea; monto fijo: repartido). */
  codeDiscountCents: number;
  /** listCents − autoDiscountCents − codeDiscountCents */
  totalCents: number;
}

/** Por qué el código escrito no rebaja nada (para el aviso del carrito). */
export type CodeOutcome = 'applied' | 'min_subtotal' | 'not_applicable' | 'smaller' | 'none';

export interface CartPricing {
  lines: PricedLine[];
  /** Suma de listCents. */
  subtotalCents: number;
  autoDiscountCents: number;
  codeDiscountCents: number;
  /** Productos después de descuentos. */
  productsCents: number;
  /** Envío ya con «envío gratis» aplicado (null = todavía no se eligió destino o retiro). */
  shippingCents: number | null;
  /** Lo que el envío costaba antes de un código de envío gratis o del «envío gratis desde». */
  shippingListCents: number | null;
  freeShipping: 'code' | 'threshold' | null;
  totalCents: number;
  code: { outcome: CodeOutcome; minSubtotalCents?: number };
}

export interface PriceCartInput {
  lines: CartLineInput[];
  autoDiscounts: AutoDiscount[];
  /** El código vigente del carrito (ya validado: existe, no está pausado, está en fecha y tiene usos). */
  code: DiscountCode | null;
  /** Precio del envío elegido (null = aún sin elegir; 0 = retiro en el local). */
  shippingCents: number | null;
  /** «Envío gratis desde» de la tienda (centavos de productos después de descuentos), o null. */
  freeShippingFromCents: number | null;
  now: Date;
}

/**
 * La cuenta. Reglas (decisiones del sprint 13a):
 *  - Cada producto lleva el automático vigente que MÁS le descuenta (por unidad).
 *  - Un código de porcentaje o monto: si no se suma, se aplica el MAYOR entre el código (sobre precios de lista) y
 *    la suma de los automáticos; si se suma, se calcula sobre lo que queda después de los automáticos.
 *  - La compra mínima de un código se mide con el subtotal de lista de todo el carrito.
 *  - Envío gratis (código) no compite con los automáticos: rebaja el envío, no los productos.
 *  - «Envío gratis desde» se mide con los productos después de descuentos.
 */
export function priceCart(input: PriceCartInput): CartPricing {
  const lines: PricedLine[] = input.lines.map((l) => {
    const best = bestAutoDiscount(l, input.autoDiscounts, input.now);
    const listCents = l.unitPriceCents * l.quantity;
    const autoDiscountCents = best ? best.unitOffCents * l.quantity : 0;
    return {
      key: l.key,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      listCents,
      autoDiscountCents,
      autoDiscountId: best ? best.discount.id : null,
      codeDiscountCents: 0,
      totalCents: listCents - autoDiscountCents,
    };
  });
  const subtotalCents = lines.reduce((n, l) => n + l.listCents, 0);
  const autoTotal = lines.reduce((n, l) => n + l.autoDiscountCents, 0);
  let outcome: CodeOutcome = 'none';
  let minSubtotalCents: number | undefined;
  let freeByCode = false;

  const code = input.code;
  if (code) {
    const eligible = lines.filter((_, i) => inScope(code.scope, code.targetIds, input.lines[i]!));
    if (subtotalCents < code.minSubtotalCents) {
      outcome = 'min_subtotal';
      minSubtotalCents = code.minSubtotalCents;
    } else if (!eligible.length) {
      outcome = 'not_applicable';
    } else if (code.kind === 'free_shipping') {
      outcome = 'applied';
      freeByCode = true;
    } else {
      // El código sobre precios de lista (si compite) o sobre lo que dejan los automáticos (si se suma).
      const base = (l: PricedLine) => (code.stacks ? l.listCents - l.autoDiscountCents : l.listCents);
      const shares = codeShares(eligible.map(base), code);
      const codeTotal = shares.reduce((n, s) => n + s, 0);
      if (codeTotal <= 0) outcome = 'not_applicable';
      else if (!code.stacks && codeTotal <= autoTotal) outcome = 'smaller';
      else {
        outcome = 'applied';
        if (!code.stacks)
          for (const l of lines) {
            l.autoDiscountCents = 0;
            l.autoDiscountId = null;
          }
        eligible.forEach((l, i) => {
          l.codeDiscountCents = shares[i]!;
        });
      }
    }
  }
  for (const l of lines) l.totalCents = l.listCents - l.autoDiscountCents - l.codeDiscountCents;

  const autoDiscountCents = lines.reduce((n, l) => n + l.autoDiscountCents, 0);
  const codeDiscountCents = lines.reduce((n, l) => n + l.codeDiscountCents, 0);
  const productsCents = subtotalCents - autoDiscountCents - codeDiscountCents;

  let shippingCents = input.shippingCents;
  let freeShipping: CartPricing['freeShipping'] = null;
  if (shippingCents !== null && shippingCents > 0) {
    if (freeByCode) freeShipping = 'code';
    else if (input.freeShippingFromCents !== null && productsCents >= input.freeShippingFromCents)
      freeShipping = 'threshold';
    if (freeShipping) shippingCents = 0;
  }
  return {
    lines,
    subtotalCents,
    autoDiscountCents,
    codeDiscountCents,
    productsCents,
    shippingCents,
    shippingListCents: input.shippingCents,
    freeShipping,
    totalCents: productsCents + (shippingCents ?? 0),
    code: minSubtotalCents === undefined ? { outcome } : { outcome, minSubtotalCents },
  };
}

/**
 * Cuánto del código cae en cada línea elegible. Porcentaje: el porcentaje de cada línea. Monto fijo: el monto (sin
 * pasar del total elegible) repartido en proporción, con el centavo que sobra en la última línea.
 */
function codeShares(bases: number[], code: Pick<DiscountCode, 'kind' | 'value'>): number[] {
  if (code.kind === 'percent') return bases.map((b) => Math.min(b, percentOf(b, code.value)));
  const total = bases.reduce((n, b) => n + b, 0);
  const off = Math.max(0, Math.min(code.value, total));
  if (!total) return bases.map(() => 0);
  const shares = bases.map((b) => Math.floor((off * b) / total));
  const rest = off - shares.reduce((n, s) => n + s, 0);
  if (shares.length) shares[shares.length - 1]! += rest;
  return shares;
}

/** El aviso del carrito sobre el código, o null si se aplicó (o no hay). */
export function codeNotice(code: string, pricing: CartPricing): string | null {
  switch (pricing.code.outcome) {
    case 'min_subtotal':
      return `El código ${code} es para compras desde ${formatMoneyExact(pricing.code.minSubtotalCents ?? 0)}.`;
    case 'not_applicable':
      return `El código ${code} no aplica a los productos de tu carrito.`;
    case 'smaller':
      return `El código ${code} no se suma a los descuentos de la tienda, y el descuento que ya tienes es mayor.`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Envío por destino
// ---------------------------------------------------------------------------

/** Las 24 provincias de Ecuador, en el orden del selector. */
export const EC_PROVINCES = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
] as const;

export const isProvince = (value: string): boolean =>
  EC_PROVINCES.some((p) => normalizeText(p) === normalizeText(value));

export interface ShippingRate {
  id: string;
  /** «Quito, Guayaquil y Cuenca», «Resto del Ecuador continental». */
  name: string;
  /** Vacío = cualquier provincia. */
  provinces: string[];
  /** Vacío = cualquier ciudad (de esas provincias). */
  cities: string[];
  /** null = «No se envía» a este destino. */
  priceCents: number | null;
  /** «2 días», «1 a 2 días». */
  eta: string | null;
  position: number;
}

/**
 * La tarifa de un destino: la más específica que coincida (ciudad > provincia > todo el país); en empate, la que va
 * primero en la lista. null = no hay tarifa para ese destino. Una tarifa con precio null dice «No se envía».
 */
export function matchShippingRate(
  rates: ShippingRate[],
  province: string,
  city: string,
): ShippingRate | null {
  const p = normalizeText(province);
  const c = normalizeText(city);
  if (!p) return null;
  let best: { rate: ShippingRate; score: number } | null = null;
  for (const rate of rates) {
    const provinces = rate.provinces.map(normalizeText);
    const cities = rate.cities.map(normalizeText);
    if (provinces.length && !provinces.includes(p)) continue;
    if (cities.length && (!c || !cities.includes(c))) continue;
    const score = cities.length ? 3 : provinces.length ? 2 : 1;
    if (!best || score > best.score || (score === best.score && rate.position < best.rate.position))
      best = { rate, score };
  }
  return best?.rate ?? null;
}

// ---------------------------------------------------------------------------
// Factura: cédula y RUC (dígito verificador)
// ---------------------------------------------------------------------------

const digitsOnly = (value: string) => value.replace(/[\s.-]/g, '');

/** Provincia válida del documento: 01 a 24, o 30 (ecuatorianos en el exterior). */
const provinceOk = (digits: string) => {
  const p = Number(digits.slice(0, 2));
  return (p >= 1 && p <= 24) || p === 30;
};

/** Cédula: 10 dígitos, provincia, tercer dígito menor que 6 y el verificador del módulo 10. */
export function isValidEcCedula(value: string): boolean {
  const d = digitsOnly(value.trim());
  if (!/^\d{10}$/.test(d) || !provinceOk(d) || Number(d[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(d[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

/** Verificador del módulo 11 con los coeficientes dados (sociedades y entidades públicas). */
function mod11(d: string, coefficients: number[]): number | null {
  const sum = coefficients.reduce((n, c, i) => n + c * Number(d[i]), 0);
  const check = 11 - (sum % 11);
  if (check === 11) return 0;
  if (check === 10) return null;
  return check;
}

/**
 * RUC: 13 dígitos. Persona natural (tercer dígito 0–5): una cédula válida y un establecimiento distinto de 000.
 * Sociedad privada (9): módulo 11 en el décimo dígito. Entidad pública (6): módulo 11 en el noveno y establecimiento
 * de cuatro dígitos distinto de 0000.
 */
export function isValidRuc(value: string): boolean {
  const d = digitsOnly(value.trim());
  if (!/^\d{13}$/.test(d) || !provinceOk(d)) return false;
  const third = Number(d[2]);
  if (third < 6) return isValidEcCedula(d.slice(0, 10)) && d.slice(10) !== '000';
  if (third === 9) {
    const check = mod11(d, [4, 3, 2, 7, 6, 5, 4, 3, 2]);
    return check !== null && check === Number(d[9]) && d.slice(10) !== '000';
  }
  if (third === 6) {
    const check = mod11(d, [3, 2, 7, 6, 5, 4, 3, 2]);
    return check !== null && check === Number(d[8]) && d.slice(9) !== '0000';
  }
  return false;
}

export type InvoiceDocType = 'cedula' | 'ruc';

/** El documento de la factura ya limpio, o null si no es una cédula ni un RUC válidos. */
export function normalizeInvoiceDoc(value: string): { type: InvoiceDocType; doc: string } | null {
  const d = digitsOnly(value.trim());
  if (d.length === 10 && isValidEcCedula(d)) return { type: 'cedula', doc: d };
  if (d.length === 13 && isValidRuc(d)) return { type: 'ruc', doc: d };
  return null;
}

// ---------------------------------------------------------------------------
// Seguimiento (página del pedido, referencia 55 y móvil 28)
// ---------------------------------------------------------------------------

export type TrackState = 'done' | 'cur' | 'todo';

export interface TrackStep {
  key: 'received' | 'confirmed' | 'prepared' | 'shipped' | 'ready' | 'delivered';
  label: string;
  state: TrackState;
  at: Date | null;
}

export interface TrackInput {
  status: StoreOrderStatus;
  delivery: DeliveryMethod;
  createdAt: Date;
  verifiedAt: Date | null;
  shippedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
}

/**
 * Los pasos del pedido. Con envío: Recibido · Confirmado · Preparado · En camino · Entregado. Con retiro: Recibido ·
 * Confirmado · Listo para retirar · Entregado. El paso «actual» es el siguiente por cumplirse (el que está pasando).
 */
export function trackSteps(o: TrackInput): TrackStep[] {
  const confirmed = STORE_PAID_STATUSES.includes(o.status);
  const delivered = o.status === 'delivered';
  if (o.delivery === 'pickup') {
    const ready = o.status === 'ready' || delivered;
    const steps: TrackStep[] = [
      { key: 'received', label: 'Recibido', state: 'done', at: o.createdAt },
      { key: 'confirmed', label: 'Confirmado', state: confirmed ? 'done' : 'cur', at: o.verifiedAt },
      {
        key: 'ready',
        label: 'Listo para retirar',
        state: ready ? 'done' : confirmed ? 'cur' : 'todo',
        at: o.readyAt,
      },
      {
        key: 'delivered',
        label: 'Entregado',
        state: delivered ? 'done' : ready ? 'cur' : 'todo',
        at: o.deliveredAt,
      },
    ];
    return steps;
  }
  const shipped = o.status === 'shipped' || delivered;
  return [
    { key: 'received', label: 'Recibido', state: 'done', at: o.createdAt },
    { key: 'confirmed', label: 'Confirmado', state: confirmed ? 'done' : 'cur', at: o.verifiedAt },
    {
      key: 'prepared',
      label: 'Preparado',
      state: shipped ? 'done' : confirmed ? 'cur' : 'todo',
      at: o.shippedAt,
    },
    {
      key: 'shipped',
      label: 'En camino',
      state: delivered ? 'done' : shipped ? 'cur' : 'todo',
      at: o.shippedAt,
    },
    { key: 'delivered', label: 'Entregado', state: delivered ? 'done' : 'todo', at: o.deliveredAt },
  ];
}

// ---------------------------------------------------------------------------
// Tipografías de marca (pago y página del pedido)
// ---------------------------------------------------------------------------

/**
 * Fuentes de títulos que aloja la plataforma (nunca Google Fonts en tiempo de ejecución). `file` = el .woff2 en
 * `public/assets/tienda-app/` (null = fuente del sistema). `stack` = el valor de --font-display.
 */
export const BRAND_FONTS = {
  plataforma: {
    label: 'Bricolage Grotesque (la de la plataforma)',
    family: null,
    file: null,
    weight: 600,
    stack: null,
  },
  fraunces: {
    label: 'Fraunces · serif',
    family: 'Fraunces',
    file: 'fraunces.3a1de7711d.woff2',
    weight: 600,
    stack: "'Fraunces', Georgia, serif",
  },
  playfair: {
    label: 'Playfair Display · serif',
    family: 'Playfair Display',
    file: 'playfair.5d2286941a.woff2',
    weight: 600,
    stack: "'Playfair Display', Georgia, serif",
  },
  lora: {
    label: 'Lora · serif',
    family: 'Lora',
    file: 'lora.7bbfe9f3c9.woff2',
    weight: 600,
    stack: "'Lora', Georgia, serif",
  },
  'dm-serif': {
    label: 'DM Serif Display · serif',
    family: 'DM Serif Display',
    file: 'dm-serif.fdf61e20fd.woff2',
    weight: 400,
    stack: "'DM Serif Display', Georgia, serif",
  },
  montserrat: {
    label: 'Montserrat · sans',
    family: 'Montserrat',
    file: 'montserrat.d857325c36.woff2',
    weight: 600,
    stack: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
  },
  'space-grotesk': {
    label: 'Space Grotesk · sans',
    family: 'Space Grotesk',
    file: 'space-grotesk.685bbbf69f.woff2',
    weight: 600,
    stack: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  },
  georgia: {
    label: 'Georgia · serif del sistema',
    family: null,
    file: null,
    weight: 700,
    stack: "Georgia, 'Times New Roman', serif",
  },
} as const;
export type BrandFont = keyof typeof BRAND_FONTS;
export const BRAND_FONT_KEYS = Object.keys(BRAND_FONTS) as BrandFont[];
export const isBrandFont = (value: unknown): value is BrandFont =>
  typeof value === 'string' && value in BRAND_FONTS;
