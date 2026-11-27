import { describe, expect, it } from 'vitest';
import { pageBlocks } from './Artefacts';

// Shaped like the text show_artefact returns for a live page (2026-11-27), with made-up content.
const TEXT = [
  'Churn drivers',
  'What moved customer churn this quarter, and which levers the team can pull next.',
  'CHURN = lost / start Churn formula',
  'NRR Net revenue retention',
  'Top three drivers',
  'What we found',
  'Most of the churn came from small accounts in their first ninety days, before onboarding finished.',
  'Key numbers at a glance',
  'This quarter',
  'Onboarding matters. Accounts that finished onboarding churned at a third of the rate of those that did not.',
  'Segment breakdown',
  'Small',
  'Mid-market',
  'Enterprise',
  'Key formula',
  'Churn = lost / start',
  'NRR = (start + expansion - churn) / start',
  'Generated in a sample run. AI can make mistakes.',
].join('\n');

describe('pageBlocks', () => {
  const blocks = pageBlocks(TEXT);
  const kinds = blocks.map((b) => b.k);

  it('opens with a title and a lede', () => {
    expect(blocks[0]).toEqual({ k: 'title', t: 'Churn drivers' });
    expect(blocks[1]?.k).toBe('lede');
  });

  it('turns a run of short facts into tiles and keeps the heading before a paragraph', () => {
    expect(blocks[2]).toEqual({ k: 'tiles', items: ['CHURN = lost / start Churn formula', 'NRR Net revenue retention', 'Top three drivers'] });
    expect(blocks[3]).toEqual({ k: 'h', t: 'What we found' });
    expect(blocks[4]?.k).toBe('p');
  });

  it('reads a pair of short lines as a heading and its label', () => {
    expect(blocks[5]).toEqual({ k: 'h', t: 'Key numbers at a glance' });
    expect(blocks[6]).toEqual({ k: 'sub', t: 'This quarter' });
  });

  it('names the formulas with the line before them', () => {
    const i = blocks.findIndex((b) => b.k === 'h' && b.t === 'Key formula');
    expect(i).toBeGreaterThan(0);
    expect(blocks[i + 1]).toEqual({ k: 'tiles', items: ['Churn = lost / start', 'NRR = (start + expansion - churn) / start'] });
  });

  it('ends with the footer', () => {
    expect(kinds[kinds.length - 1]).toBe('foot');
  });
});
