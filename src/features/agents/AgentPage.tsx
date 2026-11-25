import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icon';
import { useTool } from '../../lib/useTool';
import { useChats } from '../chat/store';
import { Contract, Flow, type Definition } from './Definition';

interface Details {
  name: string;
  id: string;
  status?: string;
  kind?: string;
  description?: string;
  project?: string;
  updated?: string;
  inputs?: { name: string; type: string; required?: boolean; description?: string }[];
  steps?: { id: string; type: string; name: string }[];
  tags?: string[];
  definition?: Definition;
}
interface Versions {
  versions?: { version: string; when: string; who: string; message: string }[];
  tags?: { tag: string; version: string }[];
}
interface Runs {
  runs?: { run_id: string; status: string; summary?: string; kind?: string; cost_usd?: number; when: string }[];
}
interface Schedules {
  schedules?: { schedule: string; name?: string; when: string; state: string; next_run?: string | null }[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * One agent, one page: Run on the left (what an enterprise user sees),
 * Design on the right (steps, inputs, versions: what a developer sees).
 */
export function AgentPage() {
  const { id = '' } = useParams();
  const { agents, workspace } = useStudio();
  const summary = agents.find((a) => a.id === id);
  const key = summary?.name ?? id;
  const details = useTool<Details>('agent_details', { agent: key, include_definition: true });
  const versions = useTool<Versions>('agent_versions', { agent: key, limit: 5 });
  const runs = useTool<Runs>('recent_runs', { agent: key, limit: 6 });
  const sched = useTool<Schedules>('list_schedules', { agent: key });
  const { start } = useChats();
  const nav = useNavigate();
  const [tab, setTab] = useState<'flow' | 'contract' | 'runs'>('flow');
  const d = details.data;

  const [inputs, setInputs] = useState<Record<string, string>>({});
  // A form agent's main input is typed in the composer; any other fields sit above it.
  const mainInput = d?.inputs?.find((i) => i.required) ?? d?.inputs?.[0];
  const extraInputs = d?.inputs?.filter((i) => i !== mainInput) ?? [];

  const run = (text: string) => {
    const filled = mainInput ? { ...inputs, [mainInput.name]: text } : undefined;
    nav(`/c/${start({ kind: 'agent', name: d?.name ?? key, id: d?.id ?? id, project: d?.project }, text, workspace, [], filled)}`);
  };

  return (
    <div className="page page--wide">
      <Link to="/agents" className="crumb">
        <Icon name="chevron" size={12} className="flip" /> Agents
      </Link>
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">{d?.name ?? summary?.name ?? 'Agent'}</h1>
          <div className="agent-meta">
            {d?.status && <span className={`pill pill--${d.status}`}>{d.status}</span>}
            {d?.tags?.map((t) => (
              <span className="pill" key={t}>
                {t}
              </span>
            ))}
            {d?.project && (
              <span className="muted">
                <Icon name="doc" size={12} /> {d.project}
              </span>
            )}
            {d?.updated && <span className="muted">Updated {fmt(d.updated)}</span>}
          </div>
        </div>
        <div className="page__actions">
          <Link to={`/routines?new=1&agent=${encodeURIComponent(d?.name ?? key)}`} className="as-btn as-btn--secondary">
            <Icon name="routine" size={14} /> Schedule
          </Link>
          <Link to={`/agents/new?agent=${encodeURIComponent(d?.name ?? key)}`} className="as-btn as-btn--secondary">
            <Icon name="pencil" size={14} /> Change with the designer
          </Link>
        </div>
      </div>
      {d?.description && <p className="agent-desc">{d.description}</p>}

      <div className="split">
        <section className="as-zone as-zone--run split__run">
          <div className="zone-head">
            <span className="as-label">Run</span>
            <span className="as-status as-status--governed">Runs inside {workspace ?? 'this workspace'}</span>
          </div>
          {extraInputs.length > 0 && (
            <div className="inputs">
              {extraInputs.map((i) => (
                <label key={i.name} className="field">
                  <span className="field__label">
                    {i.name}
                    {i.required && <span className="req">required</span>}
                  </span>
                  <input
                    className="field__input"
                    placeholder={i.description ?? i.type}
                    value={inputs[i.name] ?? ''}
                    onChange={(e) => setInputs((v) => ({ ...v, [i.name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}
          <Composer
            target={{ kind: 'agent', name: d?.name ?? key, id: d?.id ?? id }}
            lockTarget
            onSubmit={run}
            placeholder={mainInput ? (mainInput.description ?? `Enter ${mainInput.name}`) : `Message ${d?.name ?? 'this agent'}`}
          />
          <div className="zone-head">
            <span className="as-label">Routines</span>
          </div>
          {(sched.data?.schedules ?? []).length === 0 && <p className="muted small">Not scheduled.</p>}
          {sched.data?.schedules?.map((s) => (
            <div key={s.schedule} className="mini-row">
              <span className={`dot dot--${s.state}`} />
              <span className="mini-row__main">{s.name ?? s.when}</span>
              <span className="muted small">{s.state === 'active' ? `next ${s.next_run}` : s.state}</span>
            </div>
          ))}
        </section>

        <section className="as-zone as-zone--design split__design">
          <div className="tabs">
            <button type="button" className={tab === 'flow' ? 'is-on' : ''} onClick={() => setTab('flow')}>
              Flow
            </button>
            <button type="button" className={tab === 'contract' ? 'is-on' : ''} onClick={() => setTab('contract')}>
              Contract & governance
            </button>
            <button type="button" className={tab === 'runs' ? 'is-on' : ''} onClick={() => setTab('runs')}>
              Runs & versions
            </button>
          </div>

          {tab === 'flow' &&
            (d?.definition ? (
              <>
                <Flow def={d.definition} />
                <p className="legend">
                  <span className="as-status as-status--governed">code</span> deterministic and checkable ·{' '}
                  <span className="as-status as-status--model">model</span> where judgment enters · click a step to inspect it
                </p>
              </>
            ) : (
              <div className="pipeline">
                {details.loading && <p className="muted">Loading design…</p>}
                {d?.steps?.map((s, i) => (
                  <div key={s.id} className={`pipe-step ${s.type === 'llm_prompt' ? 'pipe-step--model' : 'pipe-step--code'}`}>
                    <div className="pipe-step__n">{i + 1}</div>
                    <div className="pipe-step__body">
                      <div className="pipe-step__name">{s.name}</div>
                      <div className="pipe-step__type">{s.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === 'contract' && (d?.definition ? <Contract def={d.definition} /> : <p className="muted">No definition returned.</p>)}

          {tab === 'runs' && (
            <div>
              <div className="as-label sub-head">Recent runs</div>
              {runs.data?.runs?.map((r) => (
                <div key={r.run_id} className="mini-row">
                  <span className={`dot dot--${r.status}`} />
                  <span className="mini-row__main">{r.summary ?? r.kind}</span>
                  <span className="muted small as-mono">
                    {fmt(r.when)}
                    {r.cost_usd != null && ` · $${r.cost_usd.toFixed(3)}`}
                  </span>
                </div>
              ))}
              <div className="as-label sub-head">Versions</div>
              {versions.data?.versions?.map((v) => (
                <div key={v.version} className="mini-row">
                  <span className="as-mono small">{v.version}</span>
                  <span className="mini-row__main">{v.message}</span>
                  <span className="muted small">
                    {v.who} · {fmt(v.when)}
                  </span>
                  {versions.data?.tags?.find((t) => t.version === v.version) && (
                    <span className="pill">{versions.data.tags.find((t) => t.version === v.version)?.tag}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
