/**
 * Conversión entre el texto enriquecido guardado (RichText, ver ./schema.ts) y el
 * documento del editor Tiptap 3 (formato ProseMirror). Nunca se guarda HTML: el
 * editor trabaja con su propio JSON y al guardar se convierte a nuestro modelo
 * estructurado. Portado de fluvida-web/packages/cms-core/src/rico.ts.
 *
 * Solo se conservan párrafos, listas, negrita, cursiva y enlaces permitidos. Todo lo
 * demás (encabezados, listas anidadas, saltos de línea) se aplana — así un pegado con
 * formato ajeno nunca introduce HTML ni estructura fuera de lo permitido.
 *
 * Este archivo importa `LINK_PATTERN` desde ./linkPattern.ts (sin zod) y el resto solo
 * como tipos (`import type`, se borran al compilar) — a propósito, para quedar con CERO
 * dependencias en tiempo de ejecución, igual que ./youtube.ts. El SDK (packages/sdk,
 * sprint 4a) importa `richTextToHtml` desde esta misma ruta
 * (`@plataforma/core/content/richText`) para no arrastrar zod: es la MISMA función que
 * usa el servidor para `?formato=html`, nunca una copia.
 */
import { LINK_PATTERN } from './linkPattern';
import type { Inline, RichText, RichTextNode } from './schema';

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface EditorNode {
  type: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
}

// ─── Modelo → editor ───────────────────────────────────────────────────────

function inlinesToEditor(inlines: Inline[]): EditorNode[] {
  return inlines
    .filter((i) => i.text.length > 0)
    .map((i) => {
      const marks: Mark[] = [];
      if (i.bold) marks.push({ type: 'bold' });
      if (i.italic) marks.push({ type: 'italic' });
      if (i.link) marks.push({ type: 'link', attrs: { href: i.link } });
      return { type: 'text', text: i.text, ...(marks.length ? { marks } : {}) };
    });
}

function paragraph(inlines: Inline[]): EditorNode {
  const content = inlinesToEditor(inlines);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
}

export function toEditorDoc(value: RichText | null): EditorNode {
  const content = (value ?? []).map((n): EditorNode => {
    if (n.type === 'paragraph') return paragraph(n.content);
    return {
      type: n.ordered ? 'orderedList' : 'bulletList',
      content: n.items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
    };
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ─── Editor → modelo ───────────────────────────────────────────────────────

function textToInlines(nodes: EditorNode[] = []): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      out.push({ text: ' ' });
      continue;
    }
    if (node.type !== 'text' || !node.text) {
      out.push(...textToInlines(node.content));
      continue;
    }
    const inline: Inline = { text: node.text };
    for (const m of node.marks ?? []) {
      if (m.type === 'bold') inline.bold = true;
      if (m.type === 'italic') inline.italic = true;
      const href = typeof m.attrs?.href === 'string' ? m.attrs.href.trim() : '';
      if (m.type === 'link' && LINK_PATTERN.test(href)) inline.link = href;
    }
    out.push(inline);
  }
  return mergeEqual(out);
}

/** Une fragmentos consecutivos con el mismo formato. */
function mergeEqual(inlines: Inline[]): Inline[] {
  const r: Inline[] = [];
  for (const i of inlines) {
    const prev = r[r.length - 1];
    if (prev && prev.bold === i.bold && prev.italic === i.italic && prev.link === i.link) {
      prev.text += i.text;
    } else r.push({ ...i });
  }
  return r;
}

function isEmpty(inlines: Inline[]) {
  return inlines.every((i) => i.text.trim() === '');
}

// ─── Modelo → HTML seguro (sprint 4a, GET /v1/... ?formato=html) ───────────────────────

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);

function inlineToHtml(inline: Inline): string {
  let html = escapeHtml(inline.text);
  if (inline.link && LINK_PATTERN.test(inline.link)) {
    html = `<a href="${escapeHtml(inline.link)}">${html}</a>`;
  }
  if (inline.italic) html = `<em>${html}</em>`;
  if (inline.bold) html = `<strong>${html}</strong>`;
  return html;
}

/**
 * HTML seguro a partir del JSON guardado — nunca se guarda, se genera en cada petición
 * (`?formato=html`). Solo emite las etiquetas de esta lista: nunca un tag ni un atributo
 * que no venga de aquí, y un enlace solo se emite si su esquema matchea LINK_PATTERN
 * (nunca javascript:/data:/cualquier otro).
 */
export function richTextToHtml(value: RichText | null): string {
  return (value ?? [])
    .map((node) => {
      if (node.type === 'paragraph') return `<p>${node.content.map(inlineToHtml).join('')}</p>`;
      const items = node.items.map((item) => `<li>${item.map(inlineToHtml).join('')}</li>`).join('');
      return node.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    })
    .join('');
}

export function fromEditorDoc(doc: EditorNode): RichText {
  const out: RichTextNode[] = [];
  for (const node of doc.content ?? []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      // Cada ítem se aplana a una línea: las listas anidadas no están permitidas.
      const items = (node.content ?? []).map((li) => textToInlines(li.content)).filter((i) => !isEmpty(i));
      if (items.length) out.push({ type: 'list', ordered: node.type === 'orderedList', items });
      continue;
    }
    const inlines = textToInlines(node.content);
    if (!isEmpty(inlines)) out.push({ type: 'paragraph', content: inlines });
  }
  return out;
}
