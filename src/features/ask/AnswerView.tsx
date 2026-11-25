import { Fragment, useId, useMemo, useState } from 'react';
import { parseAnswer, type Inline } from './citations';
import type { Answer, Citation } from './types';

interface Props {
  answer: Answer;
}

export function AnswerView({ answer }: Props) {
  const baseId = useId();
  const [active, setActive] = useState<number | null>(null);
  const blocks = useMemo(() => parseAnswer(answer.text), [answer.text]);
  const byN = useMemo(() => new Map(answer.citations.map((c) => [c.n, c])), [answer.citations]);
  const sourceId = (n: number) => `${baseId}-src-${n}`;

  const focusSource = (n: number) => {
    setActive(n);
    document.getElementById(sourceId(n))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const renderInline = (nodes: Inline[]): React.ReactNode =>
    nodes.map((node, i) => {
      switch (node.kind) {
        case 'text':
          return <Fragment key={i}>{node.text}</Fragment>;
        case 'bold':
          return <strong key={i}>{renderInline(node.children)}</strong>;
        case 'code':
          return <code key={i}>{node.text}</code>;
        case 'cite': {
          const c = byN.get(node.n);
          if (!c) return <Fragment key={i}>[{node.n}]</Fragment>;
          return (
            <button
              key={i}
              type="button"
              className={`ask-cite${active === node.n ? ' is-active' : ''}`}
              aria-label={`Source ${node.n}: ${c.title}${c.page != null ? `, page ${c.page}` : ''}`}
              title={c.quote ? `${c.title}: “${c.quote}”` : c.title}
              onClick={() => focusSource(node.n)}
              onMouseEnter={() => setActive(node.n)}
              onMouseLeave={() => setActive(null)}
            >
              {node.n}
            </button>
          );
        }
      }
    });

  return (
    <div className="ask-answer">
      <div className="ask-answer-text">
        {blocks.map((b, i) => {
          if (b.kind === 'p') return <p key={i}>{renderInline(b.children)}</p>;
          const items = b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>);
          return b.kind === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>;
        })}
      </div>

      {answer.citations.length > 0 && (
        <section className="ask-sources" aria-label="Sources">
          <h3>Sources</h3>
          <ol>
            {answer.citations.map((c) => (
              <SourceItem
                key={c.n}
                id={sourceId(c.n)}
                citation={c}
                active={active === c.n}
                onHover={setActive}
              />
            ))}
          </ol>
        </section>
      )}

      {answer.tookS != null && <p className="ask-meta">Answered in {answer.tookS.toFixed(1)}s</p>}
    </div>
  );
}

function SourceItem({
  id,
  citation: c,
  active,
  onHover,
}: {
  id: string;
  citation: Citation;
  active: boolean;
  onHover: (n: number | null) => void;
}) {
  return (
    <li
      id={id}
      className={`ask-source${active ? ' is-active' : ''}`}
      onMouseEnter={() => onHover(c.n)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="ask-source-n">{c.n}</span>
      <div>
        <div className="ask-source-title">
          {c.title}
          {c.page != null && <span className="ask-source-page"> · page {c.page}</span>}
        </div>
        {c.quote && <blockquote>{c.quote}</blockquote>}
      </div>
    </li>
  );
}
