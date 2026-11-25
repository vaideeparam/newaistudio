import { describe, expect, it } from 'vitest';
import { normalizeToolResult } from './normalize.js';

describe('normalizeToolResult', () => {
  it('prefers structuredContent', () => {
    expect(
      normalizeToolResult({ structuredContent: { a: 1 }, content: [{ type: 'text', text: 'x' }] }),
    ).toEqual({ isError: false, data: { a: 1 } });
  });
  it('parses a single JSON text block', () => {
    expect(normalizeToolResult({ content: [{ type: 'text', text: '{"b":2}' }] }).data).toEqual({ b: 2 });
  });
  it('returns plain text when not JSON', () => {
    expect(normalizeToolResult({ content: [{ type: 'text', text: 'hello' }] }).data).toBe('hello');
  });
  it('joins several text blocks', () => {
    const r = normalizeToolResult({
      content: [
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
      ],
    });
    expect(r.data).toBe('a\nb');
  });
  it('passes mixed content through and keeps isError', () => {
    const content = [{ type: 'image', data: 'x', mimeType: 'image/png' }];
    expect(normalizeToolResult({ content, isError: true })).toEqual({ isError: true, data: content });
  });
});
