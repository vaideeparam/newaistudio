import { useState } from 'react';
import { usePanel } from '../../app/panel';
import { Icon } from '../../components/Icon';
import { Receipt } from '../../components/Receipt';
import { AnswerView } from '../ask/AnswerView';
import type { Conversation, Turn } from './store';

export function TurnView({ conv, turn }: { conv: Conversation; turn: Turn }) {
  const [showSteps, setShowSteps] = useState(false);
  const { open } = usePanel();
  const modelCalls = turn.steps.filter((s) => s.kind === 'model').length;

  return (
    <>
      <div className="as-turn--user">{turn.question}</div>
      <div className="as-turn--assistant turn">
        {turn.state === 'running' && (
          <div className="turn-running">
            <div className="turn-running__line">
              <span className="pulse" />
              {turn.progress ?? (conv.target.kind === 'agent' ? `Running ${conv.target.name}` : `Reading ${conv.target.name}`)}…
            </div>
            {turn.steps.length > 0 && <StepList turn={turn} />}
          </div>
        )}

        {turn.state === 'error' && <div className="turn-error">Couldn't finish this run: {turn.error}</div>}

        {turn.state === 'done' && (
          <>
            {turn.steps.length > 0 && (
              <button type="button" className="steps-toggle" onClick={() => setShowSteps((v) => !v)} aria-expanded={showSteps}>
                <Icon name="chevron" size={12} className={showSteps ? 'rot90' : ''} />
                Ran {turn.steps.length} steps
                {modelCalls > 0 && (
                  <>
                    {' '}
                    · {modelCalls} model call{modelCalls === 1 ? '' : 's'}
                  </>
                )}
                {turn.tookS != null && <> · {turn.tookS.toFixed(1)}s</>}
              </button>
            )}
            {showSteps && <StepList turn={turn} />}
            <AnswerView answer={{ text: turn.answer || 'Studio returned no answer.', citations: turn.citations }} />
            <div className="turn-foot">
              <span className="as-status as-status--governed" title="Every step ran inside this workspace">
                Governed · {conv.workspace ?? 'workspace'}
              </span>
              <span className="turn-foot__spacer" />
              <button
                type="button"
                className="as-btn as-btn--ghost turn-foot__btn"
                onClick={() => open({ title: 'Run receipt', body: <Receipt conv={conv} turn={turn} /> })}
              >
                <Icon name="receipt" size={14} /> Receipt
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StepList({ turn }: { turn: Turn }) {
  return (
    <div className="as-steps">
      {turn.steps.map((s, i) => (
        <div className="as-step" key={i}>
          <span className={`as-node ${s.kind === 'model' ? 'as-node--model' : 'as-node--governed'} ${s.status === 'done' ? 'as-node--done' : ''}`} />
          <span>{s.tool.replace(/_/g, ' ')}</span>
          <span className="as-step__meta">
            {s.kind === 'model' ? (s.model ?? 'model') : s.kind === 'code' ? 'code' : s.status}
            {s.ms != null && ` · ${s.ms} ms`}
          </span>
        </div>
      ))}
    </div>
  );
}
