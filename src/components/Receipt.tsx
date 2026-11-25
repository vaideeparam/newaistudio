import { useStudio } from '../app/studio';
import type { Conversation, Turn } from '../features/chat/store';

/** The run receipt: which steps were code (governed) and which were the model. */
export function Receipt({ conv, turn }: { conv: Conversation; turn: Turn }) {
  const { connectors } = useStudio();
  const used = connectors.filter((c) => conv.connectors?.includes(c.id));
  const modelCalls = turn.steps.filter((s) => s.kind === 'model').length;
  const codeSteps = turn.steps.filter((s) => s.kind === 'code').length;
  return (
    <div className="receipt">
      <div className="as-console">
        <div className="as-console__bar">
          <span>Run receipt</span>
          <span>{turn.runId ?? 'run'}</span>
        </div>
        <div className="as-console__body">
          <div className="as-receipt-row receipt-head">
            <span>Step</span>
            <span>Kind</span>
            <span>Time</span>
            <span>Tokens</span>
          </div>
          {turn.steps.map((s, i) => (
            <div className="as-receipt-row" key={i}>
              <span>{s.tool}</span>
              <span className={s.kind === 'model' ? 'is-model' : 'is-governed'}>{s.kind === 'model' ? (s.model ?? 'model') : 'code'}</span>
              <span>{s.ms != null ? `${s.ms} ms` : '—'}</span>
              <span>{s.tokens ?? '—'}</span>
            </div>
          ))}
          <div className="receipt-total">
            <span>
              {codeSteps} governed step{codeSteps === 1 ? '' : 's'} · {modelCalls} model call{modelCalls === 1 ? '' : 's'}
            </span>
            <span>
              {turn.tookS != null && `${turn.tookS.toFixed(1)} s`}
              {turn.costUsd != null && ` · $${turn.costUsd.toFixed(4)}`}
            </span>
          </div>
        </div>
      </div>

      <dl className="facts">
        <dt>Workspace</dt>
        <dd>{conv.workspace ?? '—'}</dd>
        <dt>{conv.target.kind === 'agent' ? 'Agent' : 'Project'}</dt>
        <dd>{conv.target.name}</dd>
        <dt>Data used</dt>
        <dd>
          {turn.citations.length} cited source{turn.citations.length === 1 ? '' : 's'}, all inside {conv.workspace ?? 'this workspace'}
        </dd>
        <dt>Connectors</dt>
        <dd>{used.length ? used.map((c) => `${c.name} (${c.access === 'read_write' ? 'read & write' : 'read only'})`).join(', ') : 'None'}</dd>
        <dt>Citations</dt>
        <dd>
          <span className="as-status as-status--governed">Checked against the sources given</span>
        </dd>
        <dt>Conversation</dt>
        <dd className="as-mono">{conv.conversationId ?? '—'}</dd>
      </dl>
    </div>
  );
}
