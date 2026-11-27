import { describe, expect, it } from 'vitest';
import { outputsText, readableAnswer } from './store';

describe('readableAnswer', () => {
  it('turns a pipeline step JSON answer into a short document', () => {
    const out = readableAnswer(JSON.stringify({ headline: 'Revenue rose.', insights: ['A led.', 'B grew.'], risk: 'One product.', recommendation: 'Diversify.' }));
    expect(out).toBe('**Revenue rose.**\n\n### Insights\n\n- A led.\n- B grew.\n\n### Risk\n\nOne product.\n\n### Recommendation\n\nDiversify.');
  });
  it('leaves markdown and broken JSON alone', () => {
    expect(readableAnswer('## Hello')).toBe('## Hello');
    expect(readableAnswer('{not json')).toBe('{not json');
  });
});

describe('outputsText', () => {
  it('points a page output at its page and lists short values', () => {
    const t = outputsText({ total: 12, report: 'Report… (in full: the artefact "Report")' });
    expect(t).toContain('- **Total**: 12');
    expect(t).toContain('opens as the page “Report” below');
  });
});
