import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Lexer, type Token, type Tokens } from 'marked';
import { Icon } from './Icon';
import { RichBlock, isRichFence } from './RichBlocks';

/**
 * GitHub-flavoured Markdown rendered straight to React (never to HTML
 * strings, so model output can't inject markup): headings, rules, tables,
 * lists and task lists, quotes, code with copy, links, citations [n], and
 * rich fences (```kpi, ```chart, ```table) for KPI tiles and charts.
 */
export function Markdown({ text, cite }: { text: string; cite?: (n: number, key: string) => ReactNode }) {
  const tokens = useMemo(() => Lexer.lex(text ?? '', { gfm: true, breaks: false }), [text]);
  return <div className="md">{blocks(tokens, cite)}</div>;
}

type Cite = ((n: number, key: string) => ReactNode) | undefined;

function blocks(tokens: Token[], cite: Cite): ReactNode[] {
  return tokens.map((t, i) => block(t, `b${i}`, cite));
}

function block(t: Token, key: string, cite: Cite): ReactNode {
  switch (t.type) {
    case 'space':
      return null;
    case 'heading': {
      const h = t as Tokens.Heading;
      const Tag = (`h${Math.min(h.depth + 1, 6)}` as 'h2');
      return (
        <Tag key={key} className={`md-h md-h${h.depth}`}>
          {inline(h.tokens, cite, key)}
        </Tag>
      );
    }
    case 'paragraph':
      return <p key={key}>{inline((t as Tokens.Paragraph).tokens, cite, key)}</p>;
    case 'text': {
      const tt = t as Tokens.Text;
      return <p key={key}>{tt.tokens ? inline(tt.tokens, cite, key) : citeText(tt.text, cite, key)}</p>;
    }
    case 'hr':
      return <hr key={key} className="md-hr" />;
    case 'blockquote':
      return (
        <blockquote key={key} className="md-quote">
          {blocks((t as Tokens.Blockquote).tokens, cite)}
        </blockquote>
      );
    case 'list': {
      const l = t as Tokens.List;
      const items = l.items.map((it, j) => (
        <li key={j} className={it.task ? 'md-task' : undefined}>
          {it.task && <input type="checkbox" checked={!!it.checked} readOnly aria-label={it.checked ? 'done' : 'not done'} />}
          {it.tokens.map((x, k) => (x.type === 'text' ? <Fragment key={k}>{inline((x as Tokens.Text).tokens ?? [x], cite, `${key}-${j}-${k}`)}</Fragment> : block(x, `${key}-${j}-${k}`, cite)))}
        </li>
      ));
      return l.ordered ? (
        <ol key={key} start={typeof l.start === 'number' ? l.start : undefined}>
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case 'table':
      return <MdTable key={key} t={t as Tokens.Table} cite={cite} k={key} />;
    case 'code': {
      const c = t as Tokens.Code;
      if (isRichFence(c.lang)) return <RichBlock key={key} lang={c.lang!} body={c.text} />;
      return <CodeBlock key={key} lang={c.lang} code={c.text} />;
    }
    case 'html':
      // Raw HTML is shown as text, never rendered.
      return (
        <pre key={key} className="md-code__pre">
          {(t as Tokens.HTML).text}
        </pre>
      );
    default:
      return 'text' in t && typeof t.text === 'string' ? <p key={key}>{t.text}</p> : null;
  }
}

function inline(tokens: Token[] | undefined, cite: Cite, key: string): ReactNode[] {
  return (tokens ?? []).map((t, i) => {
    const k = `${key}.${i}`;
    switch (t.type) {
      case 'text': {
        const tt = t as Tokens.Text;
        return tt.tokens ? <Fragment key={k}>{inline(tt.tokens, cite, k)}</Fragment> : <Fragment key={k}>{citeText(tt.text, cite, k)}</Fragment>;
      }
      case 'escape':
        return <Fragment key={k}>{(t as Tokens.Escape).text}</Fragment>;
      case 'strong':
        return <strong key={k}>{inline((t as Tokens.Strong).tokens, cite, k)}</strong>;
      case 'em':
        return <em key={k}>{inline((t as Tokens.Em).tokens, cite, k)}</em>;
      case 'del':
        return <del key={k}>{inline((t as Tokens.Del).tokens, cite, k)}</del>;
      case 'codespan':
        return <code key={k}>{unescape((t as Tokens.Codespan).text)}</code>;
      case 'br':
        return <br key={k} />;
      case 'link': {
        const l = t as Tokens.Link;
        const safe = /^https?:\/\//i.test(l.href);
        return safe ? (
          <a key={k} href={l.href} target="_blank" rel="noopener noreferrer">
            {inline(l.tokens, cite, k)}
          </a>
        ) : (
          <Fragment key={k}>{inline(l.tokens, cite, k)}</Fragment>
        );
      }
      case 'image': {
        const im = t as Tokens.Image;
        return /^https:\/\//i.test(im.href) ? <img key={k} src={im.href} alt={im.text} className="md-img" loading="lazy" /> : <Fragment key={k}>{im.text}</Fragment>;
      }
      case 'html':
        return <Fragment key={k}>{(t as Tokens.HTML).text}</Fragment>;
      default:
        return <Fragment key={k}>{'text' in t ? String(t.text) : ''}</Fragment>;
    }
  });
}

/** marked escapes entities inside codespans; show them as typed. */
const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const CITE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
function citeText(text: string, cite: Cite, key: string): ReactNode[] {
  const s = unescape(text);
  if (!cite) return [s];
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(CITE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(s.slice(last, idx));
    m[1]!.split(',').forEach((n, j) => out.push(<Fragment key={`${key}c${idx}-${j}`}>{cite(Number(n.trim()), `${key}c${idx}-${j}`)}</Fragment>));
    last = idx + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const NUM = /^\s*[-+]?[$€£₹]?\s*[\d,]*\.?\d+\s*(%|x|k|m|bn|ms|s)?\s*$/i;
const toNum = (s: string) => Number(s.replace(/[^\d.+-]/g, ''));

/** A table you can read on a phone (scrolls sideways), and turn into a bar chart when it holds numbers. */
function MdTable({ t, cite, k }: { t: Tokens.Table; cite: Cite; k: string }) {
  const [asChart, setAsChart] = useState(false);
  const numericCols = t.header
    .map((_, ci) => ci)
    .filter((ci) => ci > 0 && t.rows.length > 1 && t.rows.every((r) => NUM.test(r[ci]?.text ?? '')));
  const chartable = numericCols.length > 0 && t.rows.length <= 40;
  return (
    <div className="md-table">
      {chartable && (
        <div className="md-table__bar">
          <div className="seg seg--sm" role="tablist">
            <button type="button" className={!asChart ? 'is-on' : ''} onClick={() => setAsChart(false)}>
              Table
            </button>
            <button type="button" className={asChart ? 'is-on' : ''} onClick={() => setAsChart(true)}>
              Chart
            </button>
          </div>
        </div>
      )}
      {asChart && chartable ? (
        <RichBlock
          lang="chart"
          body={JSON.stringify({
            type: 'bar',
            labels: t.rows.map((r) => r[0]?.text ?? ''),
            series: numericCols.map((ci) => ({ name: t.header[ci]?.text ?? '', data: t.rows.map((r) => toNum(r[ci]?.text ?? '0')) })),
          })}
        />
      ) : (
        <div className="md-table__scroll">
          <table>
            <thead>
              <tr>
                {t.header.map((h, i) => (
                  <th key={i} style={{ textAlign: t.align[i] ?? (numericCols.includes(i) ? 'right' : undefined) }}>
                    {inline(h.tokens, cite, `${k}h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ textAlign: t.align[ci] ?? (numericCols.includes(ci) ? 'right' : undefined) }}>
                      {inline(c.tokens, cite, `${k}r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CodeBlock({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  const math = lang === 'math' || lang === 'latex' || lang === 'tex';
  return (
    <div className={`md-code${math ? ' md-code--math' : ''}`}>
      <div className="md-code__bar">
        <span>{lang || 'text'}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code">
          <Icon name={copied ? 'check' : 'copy'} size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="md-code__pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
