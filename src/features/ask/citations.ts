import type { Citation, RawCitation } from './types';

const LEADING_NUMBER = /^\s*\[(\d+)\]\s*/;

/**
 * Turn Gateway citations into numbered sources. The number comes from the
 * "[n]" prefix in `source`; when it is missing we fall back to list order.
 */
export function normalizeCitations(raw: RawCitation[] | undefined): Citation[] {
  if (!raw?.length) return [];
  const out: Citation[] = raw.map((c, i) => {
    const m = LEADING_NUMBER.exec(c.source ?? '');
    return {
      n: m ? Number(m[1]) : i + 1,
      title: (c.source ?? '').replace(LEADING_NUMBER, '').trim() || 'Untitled source',
      page: c.page,
      quote: c.quote?.trim() || undefined,
    };
  });
  out.sort((a, b) => a.n - b.n);
  return out;
}

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'cite'; n: number };

export type Block =
  | { kind: 'p'; children: Inline[] }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'ol'; items: Inline[][] };

// [1] or [1][2] or [1, 2] style markers; **bold**; `code`.
const INLINE = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[\d+(?:\s*,\s*\d+)*\])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: 'text', text: text.slice(last, idx) });
    if (m[1]) out.push({ kind: 'bold', children: parseInline(m[1].slice(2, -2)) });
    else if (m[2]) out.push({ kind: 'code', text: m[2].slice(1, -1) });
    else if (m[3]) {
      for (const n of m[3].slice(1, -1).split(',')) out.push({ kind: 'cite', n: Number(n.trim()) });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** A small, safe subset of Markdown: paragraphs, bullet and numbered lists, bold, code, citations. */
export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', children: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: list.kind, items: list.items.map(parseInline) });
    list = null;
  };

  for (const line of lines) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list && list.kind !== kind) flushList();
      if (!list) list = { kind, items: [] };
      list.items.push((bullet ?? numbered)?.[1] ?? '');
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}
