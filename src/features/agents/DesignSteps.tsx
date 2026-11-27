import { Icon, type IconName } from '../../components/Icon';

export interface StepSummary {
  id: string;
  type: string;
  name: string;
}

const KIND: Record<string, { label: string; icon: IconName; model?: boolean }> = {
  llm_prompt: { label: 'Model call', icon: 'spark', model: true },
  orchestrator: { label: 'Orchestrator (model picks the tools)', icon: 'spark', model: true },
  custom_python: { label: 'Python, governed', icon: 'code' },
  uke_context_resolver: { label: 'Knowledge graph walk', icon: 'graph' },
  data_connector: { label: 'Connector', icon: 'plug' },
  mcp_tool: { label: 'Tool call', icon: 'plug' },
};
export const kindOf = (t: string) => KIND[t] ?? { label: t.replace(/_/g, ' '), icon: 'code' as IconName, model: t.startsWith('llm') };

/** True when the mind is orchestrator-based: one model step that chooses among tool steps. */
export const isOrchestrated = (steps: { type?: string; operator?: string }[]) => steps.some((s) => (s.type ?? s.operator) === 'orchestrator');

/**
 * Steps of a design. A DAG mind reads as a numbered chain; an orchestrator
 * mind reads as one orchestrator with the tools it may call underneath.
 */
export function DesignSteps({ steps, changed = [] }: { steps: StepSummary[]; changed?: string[] }) {
  if (steps.length === 0) return <p className="muted small">No steps yet.</p>;
  const changedSet = new Set(changed);

  if (isOrchestrated(steps)) {
    const orch = steps.filter((s) => s.type === 'orchestrator');
    const tools = steps.filter((s) => s.type !== 'orchestrator');
    return (
      <div className="orch">
        {orch.map((s) => (
          <StepCard key={s.id} s={s} changed={changedSet.has(s.id)} />
        ))}
        {tools.length > 0 && (
          <>
            <div className="orch__label as-label">Tools it can call</div>
            <div className="orch__tools">
              {tools.map((s) => (
                <StepCard key={s.id} s={s} changed={changedSet.has(s.id)} compact />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pipeline">
      {steps.map((s, i) => (
        <StepCard key={s.id} s={s} n={i + 1} changed={changedSet.has(s.id)} />
      ))}
    </div>
  );
}

function StepCard({ s, n, changed, compact }: { s: StepSummary; n?: number; changed?: boolean; compact?: boolean }) {
  const k = kindOf(s.type);
  return (
    <div className={`pipe-step ${k.model ? 'pipe-step--model' : 'pipe-step--code'}${changed ? ' is-changed' : ''}${compact ? ' pipe-step--compact' : ''}`}>
      {n != null && <div className="pipe-step__n">{n}</div>}
      <div className="pipe-step__body">
        <div className="pipe-step__name">
          {s.name}
          {changed && <span className="pill pill--changed">changed</span>}
        </div>
        <div className="pipe-step__type">
          <Icon name={k.icon} size={12} /> {k.label} <span className="as-mono muted">· {s.id}</span>
        </div>
      </div>
    </div>
  );
}
