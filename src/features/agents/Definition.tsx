import { useState } from 'react';
import { Icon } from '../../components/Icon';

/** Agent definition as agent_details(include_definition) returns it (observed live 2026-11-25). */
export interface Binding {
  param: string;
  source: { type: 'mind_input' | 'step_output' | 'constant' | string; ref?: string; step_id?: string; path?: string; value?: unknown };
  nullable?: boolean;
}
export interface DefStep {
  id: string;
  operator: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  input_bindings?: Binding[];
  on_error?: string;
  position?: { x: number; y: number };
}
export interface Definition {
  name: string;
  version?: string;
  interface?: {
    inputs?: { name: string; type: string; required?: boolean; description?: string }[];
    outputs?: { name: string; type: string; description?: string }[];
  };
  governance?: {
    audit_level?: string;
    pii_handling?: string;
    allowed_models?: string[] | null;
    blocked_models?: string[] | null;
    human_approval?: string;
    guardrail_names?: string[];
    approval_threshold_usd?: number | null;
  };
  guarantees?: {
    max_cost_usd?: number;
    max_latency_ms?: number;
    max_retries?: number;
    idempotent?: boolean;
    deterministic_output_schema?: boolean;
  };
  runtime_hints?: { preferred_models?: string[] };
  chain_of_thought?: { steps?: DefStep[]; connections?: { from_step: string; to_step: string }[] };
  cluster_id?: string;
}

const isModel = (s: DefStep) => s.operator === 'llm_prompt' || s.operator.startsWith('llm');
const OPERATOR_LABEL: Record<string, string> = {
  llm_prompt: 'Model call',
  custom_python: 'Python, governed',
  uke_context_resolver: 'Knowledge graph walk',
  mcp_tool: 'Tool call',
};

function bindingLabel(b: Binding) {
  const s = b.source;
  if (s.type === 'mind_input') return `input · ${s.ref}`;
  if (s.type === 'step_output') return `${s.step_id}${s.path ? '.' + s.path : ''}`;
  if (s.type === 'constant') return typeof s.value === 'string' && s.value.length > 40 ? 'constant (code)' : `constant · ${JSON.stringify(s.value)}`;
  return s.type;
}

/** The flow: each step says what it reads and whether code or the model does the work. Click to inspect. */
export function Flow({ def }: { def: Definition }) {
  const steps = def.chain_of_thought?.steps ?? [];
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flow">
      {(def.interface?.inputs?.length ?? 0) > 0 && (
        <div className="flow-io">
          <span className="as-label">In</span>
          {def.interface!.inputs!.map((i) => (
            <span key={i.name} className="flow-io__chip" title={i.description}>
              {i.name}
              <span className="muted"> · {i.type}</span>
            </span>
          ))}
        </div>
      )}
      {steps.map((s, i) => {
        const model = isModel(s);
        const expanded = open === s.id;
        const code = typeof s.config?.code === 'string' ? (s.config.code as string) : bindingsCode(s);
        const prompt = typeof s.config?.system_prompt === 'string' ? (s.config.system_prompt as string) : undefined;
        const knobs = Object.entries(s.config ?? {}).filter(([k, v]) => v != null && k !== 'code' && k !== 'system_prompt' && k !== 'user_prompt');
        return (
          <div key={s.id} className={`pipe-step flow-step ${model ? 'pipe-step--model' : 'pipe-step--code'}${expanded ? ' is-open' : ''}`}>
            <button type="button" className="flow-step__head" onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded}>
              <div className="pipe-step__n">{i + 1}</div>
              <div className="pipe-step__body">
                <div className="pipe-step__name">{s.name}</div>
                <div className="pipe-step__type">
                  <Icon name={model ? 'spark' : s.operator === 'uke_context_resolver' ? 'graph' : 'code'} size={12} />
                  {OPERATOR_LABEL[s.operator] ?? s.operator}
                  {model && typeof s.config?.model === 'string' && <span className="as-mono"> · {s.config.model as string}</span>}
                </div>
                {s.input_bindings && s.input_bindings.length > 0 && (
                  <div className="flow-reads">
                    reads{' '}
                    {s.input_bindings
                      .filter((b) => !(b.source.type === 'constant' && b.param === 'code'))
                      .map((b) => (
                        <span key={b.param} className="flow-read">
                          {bindingLabel(b)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <Icon name="chevron" size={12} className={expanded ? 'rot90' : ''} />
            </button>
            {expanded && (
              <div className="flow-step__detail">
                {s.description && <p className="flow-desc">{s.description}</p>}
                {knobs.length > 0 && (
                  <div className="knobs">
                    {knobs.map(([k, v]) => (
                      <span key={k} className="knob">
                        <span className="muted">{k.replace(/_/g, ' ')}</span> {String(v)}
                      </span>
                    ))}
                    {s.on_error && (
                      <span className="knob">
                        <span className="muted">on error</span> {s.on_error}
                      </span>
                    )}
                  </div>
                )}
                {prompt && (
                  <div className="as-console code-block">
                    <div className="as-console__bar">
                      <span>System prompt</span>
                    </div>
                    <pre className="as-console__body">{prompt}</pre>
                  </div>
                )}
                {code && (
                  <div className="as-console code-block">
                    <div className="as-console__bar">
                      <span>Python</span>
                      <span>no model</span>
                    </div>
                    <pre className="as-console__body">{code}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {(def.interface?.outputs?.length ?? 0) > 0 && (
        <div className="flow-io">
          <span className="as-label">Out</span>
          {def.interface!.outputs!.map((o) => (
            <span key={o.name} className="flow-io__chip" title={o.description}>
              {o.name}
              <span className="muted"> · {o.type}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function bindingsCode(s: DefStep): string | undefined {
  const b = s.input_bindings?.find((x) => x.param === 'code' && x.source.type === 'constant');
  return typeof b?.source.value === 'string' ? b.source.value : undefined;
}

/** The contract: what the agent promises (cost, latency, schema) and how it is governed. */
export function Contract({ def }: { def: Definition }) {
  const g = def.governance ?? {};
  const q = def.guarantees ?? {};
  const steps = def.chain_of_thought?.steps ?? [];
  const modelSteps = steps.filter(isModel).length;
  return (
    <div className="contract">
      <div className="contract-grid">
        <Fact label="Max cost per run" value={q.max_cost_usd != null ? `$${q.max_cost_usd.toFixed(2)}` : '—'} />
        <Fact label="Max latency" value={q.max_latency_ms != null ? `${Math.round(q.max_latency_ms / 1000)} s` : '—'} />
        <Fact label="Retries" value={q.max_retries ?? '—'} />
        <Fact label="Output schema" value={q.deterministic_output_schema ? 'Fixed' : 'Free'} good={q.deterministic_output_schema} />
        <Fact label="Model steps" value={`${modelSteps} of ${steps.length}`} />
        <Fact label="Runs on" value={def.cluster_id ?? '—'} mono />
      </div>
      <div className="as-label sub-head">Governance</div>
      <dl className="facts">
        <dt>Audit</dt>
        <dd>{g.audit_level ?? '—'}</dd>
        <dt>Personal data</dt>
        <dd>{g.pii_handling === 'none' ? 'Not handled' : (g.pii_handling ?? '—')}</dd>
        <dt>Human approval</dt>
        <dd>{g.human_approval === 'none' || !g.human_approval ? 'Not required' : g.human_approval.replace(/_/g, ' ')}</dd>
        <dt>Guardrails</dt>
        <dd>{g.guardrail_names?.length ? g.guardrail_names.join(', ') : 'None'}</dd>
        <dt>Models</dt>
        <dd>
          {g.allowed_models?.length ? `Only ${g.allowed_models.join(', ')}` : 'Workspace defaults'}
          {def.runtime_hints?.preferred_models?.length ? ` · prefers ${def.runtime_hints.preferred_models.join(', ')}` : ''}
        </dd>
        {g.approval_threshold_usd != null && (
          <>
            <dt>Approval above</dt>
            <dd>${g.approval_threshold_usd}</dd>
          </>
        )}
        <dt>Version</dt>
        <dd className="as-mono">{def.version ?? '—'}</dd>
      </dl>
    </div>
  );
}

function Fact({ label, value, good, mono }: { label: string; value: React.ReactNode; good?: boolean; mono?: boolean }) {
  return (
    <div className={`fact${good ? ' fact--good' : ''}`}>
      <div className="fact__label">{label}</div>
      <div className={`fact__value${mono ? ' as-mono' : ''}`}>{value}</div>
    </div>
  );
}
