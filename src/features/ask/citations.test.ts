import { describe, expect, it } from 'vitest';
import { normalizeCitations, parseAnswer, parseInline } from './citations';

describe('normalizeCitations', () => {
  it('reads the number from the source prefix and sorts', () => {
    const out = normalizeCitations([
      { source: '[2] b.pdf', page: 13 },
      { source: '[1] a.pdf', page: 2, quote: '  hello ' },
    ]);
    expect(out).toEqual([
      { n: 1, title: 'a.pdf', page: 2, quote: 'hello' },
      { n: 2, title: 'b.pdf', page: 13, quote: undefined },
    ]);
  });
  it('falls back to list order without a prefix', () => {
    expect(normalizeCitations([{ source: 'x.md' }])[0]).toMatchObject({ n: 1, title: 'x.md' });
  });
  it('handles missing citations', () => {
    expect(normalizeCitations(undefined)).toEqual([]);
  });
});

describe('parseInline', () => {
  it('splits adjacent and comma citations', () => {
    expect(parseInline('five properties [2][3] and [4, 5].')).toEqual([
      { kind: 'text', text: 'five properties ' },
      { kind: 'cite', n: 2 },
      { kind: 'cite', n: 3 },
      { kind: 'text', text: ' and ' },
      { kind: 'cite', n: 4 },
      { kind: 'cite', n: 5 },
      { kind: 'text', text: '.' },
    ]);
  });
  it('handles bold and code without treating them as HTML', () => {
    expect(parseInline('**Fails closed.** see `<b>`')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'Fails closed.' }] },
      { kind: 'text', text: ' see ' },
      { kind: 'code', text: '<b>' },
    ]);
  });
});

describe('parseAnswer', () => {
  it('groups paragraphs and lists', () => {
    const blocks = parseAnswer('Intro [1].\n\n- one\n- two [2]\n\n1. a\n2. b\nOutro');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'ol', 'p']);
    expect(blocks[1]).toMatchObject({ kind: 'ul', items: [[{ text: 'one' }], [{ text: 'two ' }, { n: 2 }]] });
  });
});
