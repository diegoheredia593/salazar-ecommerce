/**
 * Eventos y boletería (sprint 12a): vocabulario y reglas puras compartidas por el Worker, la página de compra y
 * el portal. Nada aquí lee la base ni envía nada.
 */

export const EVENTS_MODULE = 'eventos';

/**
 * borrador = solo lo ve el organizador · abierta = se vende · pausada = la página dice que vuelve pronto · cerrada ·
 * terminado = se cerró después de la noche (sprint 12d) · cancelado = no se hace (sprint 12d, con devoluciones).
 */
export const EVENT_STATUSES = ['draft', 'open', 'paused', 'closed', 'finished', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Borrador',
  open: 'Venta abierta',
  paused: 'Venta pausada',
  closed: 'Venta cerrada',
  finished: 'Terminado',
  cancelled: 'Cancelado',
};

/**
 * reservado = apartó entradas y aún no sube el comprobante · por verificar = subió el comprobante ·
 * aprobado · rechazado · vencido = se acabó el tiempo sin comprobante (libera el cupo) · por devolver y devuelto
 * (sprint 12d: solo en `store_orders`, nunca en la tabla vieja `orders`).
 */
export const ORDER_STATUSES = [
  'reserved',
  'pending',
  'approved',
  'rejected',
  'expired',
  'refund_pending',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  reserved: 'Reservado',
  pending: 'Por verificar',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Vencido',
  refund_pending: 'Por devolver',
  refunded: 'Devuelto',
};

export const BANK_ACCOUNT_TYPES = ['corriente', 'ahorros'] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];
export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  corriente: 'Cuenta corriente',
  ahorros: 'Cuenta de ahorros',
};

export const BUYER_DOC_TYPES = ['cedula', 'pasaporte'] as const;
export type BuyerDocType = (typeof BUYER_DOC_TYPES)[number];

export const EVENT_LIMITS = {
  holdMinutesDefault: 60,
  holdMinutesMin: 10,
  holdMinutesMax: 24 * 60,
  maxPerOrderDefault: 10,
  maxPerOrderMax: 50,
  tiersMax: 12,
  capacityMax: 100_000,
  priceMaxCents: 100_000_00,
  bankAccountsMax: 6,
  /** Comprobante: imagen o PDF, hasta 8 MB. */
  receiptMaxBytes: 8 * 1024 * 1024,
  transactionMin: 4,
  transactionMax: 40,
  rejectReasonMax: 300,
  /** Comprobantes y cédulas se borran estos días después del evento (por defecto; sprint 12d: por cliente). */
  purgeAfterDays: 30,
  /** Tasa de comisión: en puntos básicos (600 = 6 %). */
  commissionBpMax: 5000,
} as const;

export const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ORDER_PREFIX_PATTERN = /^[A-Z]{2,6}$/;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Código del pedido
// ---------------------------------------------------------------------------

/** Sin 0/O ni 1/I: se dicta por teléfono y se copia de una captura sin confundirse. */
export const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ORDER_CODE_PATTERN = /^[A-Z]{2,6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** «LION-4F7K»: el prefijo del evento y 4 caracteres al azar. `random` = 4 bytes (crypto.getRandomValues). */
export function orderCode(prefix: string, random: Uint8Array): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ORDER_CODE_ALPHABET[(random[i] ?? 0) % ORDER_CODE_ALPHABET.length];
  return `${prefix}-${suffix}`;
}

/** Prefijo por defecto a partir del nombre: las primeras letras de la primera palabra larga («The Lion» → LION). */
export function defaultOrderPrefix(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const word = words.find((w) => w.length >= 3 && !['THE', 'LOS', 'LAS', 'DEL', 'FIESTA'].includes(w));
  const pick = (word ?? words[0] ?? 'EVT').slice(0, 6);
  return pick.length >= 2 ? pick : 'EVT';
}

// ---------------------------------------------------------------------------
// Documento del comprador
// ---------------------------------------------------------------------------

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01–24 (o 30, ecuatorianos en el exterior), tercer dígito menor
 * que 6 (persona natural) y el dígito verificador del módulo 10.
 */
export function isValidCedula(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10 || digits !== value.trim().replace(/[\s-]/g, '')) return false;
  const province = Number(digits.slice(0, 2));
  if (!((province >= 1 && province <= 24) || province === 30)) return false;
  if (Number(digits[2]) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(digits[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[9]);
}

/** Pasaporte: 6 a 20 letras o números (sin espacios). */
export const isValidPassport = (value: string): boolean => /^[A-Za-z0-9]{6,20}$/.test(value.trim());

/** El documento como se guarda: la cédula solo con dígitos; el pasaporte en mayúsculas. */
export function normalizeBuyerDoc(type: BuyerDocType, value: string): string | null {
  const trimmed = value.trim();
  if (type === 'cedula') return isValidCedula(trimmed) ? trimmed.replace(/\D/g, '') : null;
  return isValidPassport(trimmed) ? trimmed.toUpperCase() : null;
}

/** Número de transacción: lo que escribe la persona, sin espacios y en mayúsculas. */
export function normalizeTransaction(value: string): string | null {
  const clean = value.replace(/[\s.-]/g, '').toUpperCase();
  if (clean.length < EVENT_LIMITS.transactionMin || clean.length > EVENT_LIMITS.transactionMax) return null;
  return /^[A-Z0-9/#]+$/.test(clean) ? clean : null;
}

// ---------------------------------------------------------------------------
// Dinero y comisión
// ---------------------------------------------------------------------------

/** «$80,00»: siempre con centavos (montos a transferir). */
export function formatMoneyExact(cents: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** «$40» o «$12,50»: precios de una localidad. */
export function formatPrice(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/** Comisión en centavos con redondeo al centavo más cercano (la mitad hacia arriba). La misma cuenta que el SQL. */
export const commissionCents = (amountCents: number, rateBp: number): number =>
  Math.floor((amountCents * rateBp + 5000) / 10000);

/** «6 %» o «5,5 %» */
export const formatRate = (bp: number): string =>
  `${(bp / 100).toLocaleString('es-EC', { maximumFractionDigits: 2 })} %`;

// ---------------------------------------------------------------------------
// Selección de entradas
// ---------------------------------------------------------------------------

export interface TierPick {
  tierId: string;
  quantity: number;
}

/** `?c=<tierId>:<n>,<tierId>:<n>` → selección (sin ceros ni repetidos). */
export function parsePicks(raw: string | null | undefined): TierPick[] {
  if (!raw) return [];
  const out = new Map<string, number>();
  for (const part of raw.split(',').slice(0, EVENT_LIMITS.tiersMax)) {
    const [id, n] = part.split(':');
    const quantity = Number(n);
    if (!id || !/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(quantity) || quantity <= 0) continue;
    out.set(id, Math.min(quantity, EVENT_LIMITS.maxPerOrderMax));
  }
  return [...out].map(([tierId, quantity]) => ({ tierId, quantity }));
}

export const picksParam = (picks: TierPick[]): string =>
  picks
    .filter((p) => p.quantity > 0)
    .map((p) => `${p.tierId}:${p.quantity}`)
    .join(',');

/** «2 entradas», «1 entrada» */
export const ticketsText = (n: number): string => (n === 1 ? '1 entrada' : `${n} entradas`);

/** «2 VIP», «1 VIP y 2 General», «2 VIP, 1 Preferencia y 3 General» */
export function itemsText(items: { name: string; quantity: number }[]): string {
  const parts = items.filter((i) => i.quantity > 0).map((i) => `${i.quantity} ${i.name}`);
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/** Mensaje de WhatsApp de la pantalla «Listo» (44). */
export const whatsappOrderMessage = (code: string, tickets: number): string =>
  `Hola, envié el comprobante del pedido ${code} (${ticketsText(tickets)})`;

/** wa.me con el mensaje prellenado; null si el número no sirve. */
export function whatsappMessageUrl(phoneE164: string | null, text: string): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Dirección de la página de venta: en la raíz del dominio propio ACTIVO del portal (`/entradas/<evento>`) o,
 * sin dominio, `PUBLIC_ORIGIN/entradas/<slug-cliente>/<evento>`.
 */
export function ticketPageUrl(input: {
  domainOrigin: string | null;
  publicOrigin: string;
  tenantSlug: string;
  eventSlug: string;
}): string {
  return input.domainOrigin
    ? `${input.domainOrigin.replace(/\/+$/, '')}/entradas/${input.eventSlug}`
    : `${input.publicOrigin.replace(/\/+$/, '')}/entradas/${input.tenantSlug}/${input.eventSlug}`;
}

/** ¿Es un correo de remitente válido para un cliente (sin nombre, solo la dirección)? */
export const isSenderAddress = (value: string): boolean =>
  /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value.trim());

// ---------------------------------------------------------------------------
// Entradas con QR, cortesías y comisiones (sprint 12b)
// ---------------------------------------------------------------------------

/** venta = lo pagó un comprador · cortesía = la emitió el organizador (aprobada, sin cobro ni comisión). */
export const ORDER_KINDS = ['sale', 'courtesy'] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** El documento de un pedido: el del comprador, o ninguno en una cortesía. */
export type OrderDocType = BuyerDocType | 'none';

/** válida = entra · usada = ya entró (12c) · anulada = no entra (con motivo). */
export const TICKET_STATUSES = ['valid', 'used', 'void'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  valid: 'Válida',
  used: 'Usada',
  void: 'Anulada',
};

/**
 * Movimientos del libro de comisiones: venta aprobada, cortesía (comisión 0) o reversa de una devolución (sprint 12d:
 * montos negativos, una por pedido).
 */
export const LEDGER_KINDS = ['sale', 'courtesy', 'refund'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/** Liquidaciones: lo que el cliente pagó de su comisión, o un ajuste (+/−) que corrige un error. */
export const SETTLEMENT_KINDS = ['settlement', 'adjustment'] as const;
export type SettlementKind = (typeof SETTLEMENT_KINDS)[number];

export const SETTLEMENT_KIND_LABELS: Record<SettlementKind, string> = {
  settlement: 'Liquidación',
  adjustment: 'Ajuste',
};

export const TICKET_LIMITS = {
  /** Cortesías: hasta este número de entradas por emisión. */
  courtesyMax: 20,
  voidReasonMax: 200,
  settlementReferenceMax: 80,
  settlementNoteMax: 300,
  /** Un correo de Cloudflare Email Sending pesa como máximo 5 MiB, adjuntos incluidos. */
  emailMaxBytes: 5 * 1024 * 1024,
} as const;

/** «LION-4F7K · 1»: el código legible de una entrada (el del pedido y su número dentro de él). */
export const ticketLabel = (orderCode: string, seq: number): string => `${orderCode} · ${seq}`;

/**
 * Posición del primer apellido. En Ecuador se escribe «nombres apellidos»: con cuatro palabras o más es la
 * penúltima («María José Villacís Pérez» → Villacís); con tres, la segunda («Ana Pérez García» → Pérez); con dos,
 * la última. Es una regla aproximada: alcanza para ordenar y buscar en una lista impresa.
 */
function surnameIndex(words: string[]): number {
  if (words.length <= 2) return words.length - 1;
  return words.length >= 4 ? words.length - 2 : 1;
}

const wordsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** El primer apellido (para ordenar la lista de la puerta). */
export function surnameOf(name: string): string {
  const words = wordsOf(name);
  return words[Math.max(0, surnameIndex(words))] ?? '';
}

/** «María José V.»: los nombres y la inicial del primer apellido, para la entrada (no el nombre completo). */
export function shortBuyerName(name: string): string {
  const words = wordsOf(name);
  if (words.length <= 1) return words[0] ?? '';
  const at = surnameIndex(words);
  return `${words.slice(0, at).join(' ')} ${words[at]!.charAt(0).toUpperCase()}.`;
}

/** Saldo de comisiones: lo que se debe = comisión − liquidaciones (los ajustes llevan su signo). */
export const commissionBalance = (commissionCents: number, settledCents: number): number =>
  commissionCents - settledCents;

/** «$8,70» o «−$0,30» (un saldo o un ajuste negativo, con el signo menos delante del símbolo). */
export const formatSignedMoney = (cents: number): string =>
  cents < 0 ? `−${formatMoneyExact(-cents)}` : formatMoneyExact(cents);

/** «14 oct 2026» a partir de AAAA-MM-DD (la fecha de una liquidación). */
export function formatPaidOn(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  return y && m && d ? `${d} ${months[m - 1]} ${y}` : day;
}
