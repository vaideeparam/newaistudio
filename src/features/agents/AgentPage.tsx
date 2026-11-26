import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icon';
import { useTool } from '../../lib/useTool';
import { useChats } from '../chat/store';
import { Contract, Flow, type Definition } from './Definition';
import { DesignSteps } from './DesignSteps';
import { callTool } from '../../lib/mcp';

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
  how_it_runs?: string;
  /** Live: [{tag, version}]. */
  tags?: ({ tag: string; version: string } | string)[];
  /** Large definitions come back as { truncated: true, preview } instead. */
  definition?: Definition | { truncated: true; preview?: string };
}
interface Versions {
  /** Live shape (2026-11-26): { version, saved, by, message }. */
  versions?: { version: string; saved?: string; by?: string; when?: string; who?: string; message: string }[];
  tags?: { tag: string; version: string }[];
}

const fullDef = (d?: Details['definition']): Definition | undefined =>
  d && !('truncated' in d && d.truncated) && (d as Definition).chain_of_thought ? (d as Definition) : undefined;
const tagName = (t: { tag: string } | string) => (typeof t === 'string' ? t : t.tag);
/** Version messages read like "[mind:a1e82d9f] Update "X" v5 by me": keep the useful part. */
const cleanMsg = (m: string) => m.replace(/^\[mind:[^\]]+\]\s*/, '');
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
  const def = fullDef(d?.definition);
  const [version, setVersion] = useState('');
  const [publish, setPublish] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [actErr, setActErr] = useState<string | null>(null);
  const [tagging, setTagging] = useState<{ version: string; tag: string } | null>(null);

  const doPublish = async () => {
    setPublish('busy');
    setActErr(null);
    try {
      await callTool('publish_agent', { agent: d?.id ?? key, confirm: true });
      setPublish('done');
      details.reload?.();
    } catch (e) {
      setActErr(e instanceof Error ? e.message : String(e));
      setPublish('confirm');
    }
  };
  const doTag = async () => {
    if (!tagging?.tag.trim()) return;
    setActErr(null);
    try {
      await callTool('tag_agent_version', { agent: d?.id ?? key, tag: tagging.tag.trim(), version: tagging.version });
      setTagging(null);
      versions.reload?.();
    } catch (e) {
      setActErr(e instanceof Error ? e.message : String(e));
    }
  };
  const versionOptions = [
    ...(versions.data?.tags ?? []).map((t) => ({ value: t.tag, label: `${t.tag} (${t.version})` })),
    ...(versions.data?.versions ?? []).slice(0, 10).map((v) => ({ value: v.version, label: `${v.version} · ${cleanMsg(v.message).slice(0, 40)}` })),
  ];

  const [inputs, setInputs] = useState<Record<string, string>>({});
  // A form agent's main input is typed in the composer; any other fields sit above it.
  const mainInput = d?.inputs?.find((i) => i.required) ?? d?.inputs?.[0];
  const extraInputs = d?.inputs?.filter((i) => i !== mainInput) ?? [];

  const run = (text: string) => {
    const filled = mainInput ? { ...inputs, [mainInput.name]: text } : undefined;
    nav(`/c/${start({ kind: 'agent', name: d?.name ?? key, id: d?.id ?? id, project: d?.project, version: version || undefined }, text, workspace, [], filled)}`);
  };

  const [params, setParams] = useSearchParams();
  const editing = params.get('edit') === '1';

  if (!editing) {
    const firstSentence = d?.description?.split(/(?<=\.)\s/)[0];
    const steps = def?.chain_of_thought?.steps ?? d?.steps?.map((x) => ({ ...x, operator: x.type })) ?? [];
    const modelSteps = steps.filter((x) => x.operator === 'llm_prompt' || x.operator === 'orchestrator').length;
    const orchestrated = steps.some((x) => x.operator === 'orchestrator');
    return (
      <div className="page agent-simple">
        <Link to="/agents" className="crumb">
          <Icon name="chevron" size={12} className="flip" /> Agents
        </Link>
        <div className="agent-hero">
          <div className="agent-hero__icon">
            <Icon name="agent" size={22} />
          </div>
          <div className="agent-hero__text">
            <h1 className="as-display page__title">{d?.name ?? summary?.name ?? 'Agent'}</h1>
            {firstSentence && <p className="agent-hero__desc">{firstSentence}</p>}
          </div>
          <div className="page__actions">
            <Link to={`/routines?new=1&agent=${encodeURIComponent(d?.name ?? key)}`} className="as-btn as-btn--ghost">
              <Icon name="routine" size={14} /> Schedule
            </Link>
            <button type="button" className="as-btn as-btn--ghost" onClick={() => setParams({ edit: '1' })}>
              <Icon name="pencil" size={14} /> Edit
            </button>
          </div>
        </div>

        {extraInputs.length > 0 && (
          <div className="inputs">
            {extraInputs.map((i) => (
              <label key={i.name} className="field">
                <span className="field__label">{i.name}</span>
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
          autoFocus
          onSubmit={run}
          placeholder={mainInput ? (mainInput.description ?? `Enter ${mainInput.name}`) : `Message ${d?.name ?? 'this agent'}`}
        />

        <div className="agent-trust">
          <span className="as-status as-status--governed">Runs inside {workspace ?? 'your workspace'}</span>
          {steps.length > 0 && (
            <span className="muted small">
              {orchestrated
                ? `An AI orchestrator with ${steps.length - 1} tool${steps.length === 2 ? '' : 's'} it may call`
                : `${steps.length} steps · ${modelSteps === 1 ? 'one AI step' : `${modelSteps} AI steps`}, the rest checked by code`}
            </span>
          )}
        </div>

        {(sched.data?.schedules?.length ?? 0) > 0 && (
          <section className="agent-sec">
            <div className="as-label sub-head">Runs on its own</div>
            {sched.data!.schedules!.map((x) => (
              <div key={x.schedule} className="mini-row">
                <span className={`dot dot--${x.state}`} />
                <span className="mini-row__main">{x.name ?? x.when}</span>
                <span className="muted small">{x.state === 'active' ? `next ${x.next_run}` : 'paused'}</span>
              </div>
            ))}
          </section>
        )}

        {(runs.data?.runs?.length ?? 0) > 0 && (
          <section className="agent-sec">
            <div className="as-label sub-head">Recent</div>
            {runs.data!.runs!.slice(0, 5).map((r) => (
              <div key={r.run_id} className="mini-row">
                <span className={`dot dot--${r.status}`} />
                <span className="mini-row__main">{r.summary ?? r.kind}</span>
                <span className="muted small">{fmt(r.when)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <button type="button" className="crumb crumb--btn" onClick={() => setParams({})}>
        <Icon name="chevron" size={12} className="flip" /> Done editing
      </button>
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">{d?.name ?? summary?.name ?? 'Agent'}</h1>
          <div className="agent-meta">
            {d?.status && <span className={`pill pill--${d.status}`}>{d.status}</span>}
            {d?.tags?.map((t) => (
              <span className="pill" key={tagName(t)}>
                {tagName(t)}
              </span>
            ))}
            {d?.how_it_runs && <span className="pill">{d.how_it_runs === 'chat' ? 'Chat' : 'Form / API'}</span>}
            {d?.project && (
              <span className="muted">
                <Icon name="doc" size={12} /> {d.project}
              </span>
            )}
            {d?.updated && <span className="muted">Updated {fmt(d.updated)}</span>}
          </div>
        </div>
        <div className="page__actions">
          {d?.status === 'draft' && publish !== 'done' && (
            <button type="button" className="as-btn as-btn--secondary" onClick={() => setPublish('confirm')} disabled={publish === 'busy'}>
              Publish…
            </button>
          )}
          <Link
            to={`/agents/new?agent=${encodeURIComponent(d?.id ?? key)}${d?.project ? `&project=${encodeURIComponent(d.project)}` : ''}`}
            className="as-btn as-btn--primary"
          >
            <Icon name="pencil" size={14} /> Change with the designer
          </Link>
        </div>
      </div>
      {d?.description && <p className="agent-desc">{d.description}</p>}
      {(publish === 'confirm' || publish === 'busy') && (
        <div className="confirm">
          <p>
            Publish <b>{d?.name}</b>? Everyone who can use {d?.project ?? 'its project'} will be able to run it.
          </p>
          <div className="design-act">
            <button type="button" className="as-btn as-btn--primary" onClick={() => void doPublish()} disabled={publish === 'busy'}>
              {publish === 'busy' ? 'Publishing…' : 'Yes, publish'}
            </button>
            <button type="button" className="as-btn as-btn--ghost" onClick={() => setPublish('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {publish === 'done' && <p className="as-status as-status--governed">Published.</p>}
      {actErr && (
        <div className="as-callout as-callout--error" role="alert">
          {actErr}
        </div>
      )}

      <div className="split">
        <section className="as-zone as-zone--run split__run">
          <div className="zone-head">
            <span className="as-label">Test run</span>
            <label className="ver-pick">
              <span className="muted">Version</span>
              <select className="field__input" value={version} onChange={(e) => setVersion(e.target.value)}>
                <option value="">Latest</option>
                {versionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
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
            (def ? (
              <>
                <Flow def={def} />
                <p className="legend">
                  <span className="as-status as-status--governed">code</span> deterministic and checkable ·{' '}
                  <span className="as-status as-status--model">model</span> where judgment enters · click a step to inspect it
                </p>
              </>
            ) : (
              <div>
                {details.loading && <p className="muted">Loading design…</p>}
                {d?.steps && <DesignSteps steps={d.steps} />}
                {d?.definition && 'truncated' in d.definition && (
                  <p className="muted small">This mind's full definition is too large for the gateway to return, so step details aren't shown here.</p>
                )}
              </div>
            ))}

          {tab === 'contract' && (def ? <Contract def={def} /> : <p className="muted">The gateway didn't return the full definition for this mind (it is too large), so its contract can't be shown yet.</p>)}

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
                  <span className="mini-row__main">{cleanMsg(v.message)}</span>
                  <span className="muted small">
                    {(v.by ?? v.who ?? '').split('@')[0]} · {fmt(v.saved ?? v.when ?? '')}
                  </span>
                  {versions.data?.tags
                    ?.filter((t) => t.version === v.version)
                    .map((t) => (
                      <span key={t.tag} className="pill">
                        {t.tag}
                      </span>
                    ))}
                  {tagging?.version === v.version ? (
                    <span className="ver-pick">
                      <input className="field__input save-tag" autoFocus value={tagging.tag} placeholder="v1.2" onChange={(e) => setTagging({ version: v.version, tag: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && void doTag()} />
                      <button type="button" className="as-btn as-btn--ghost" onClick={() => void doTag()}>
                        Tag
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="as-btn as-btn--ghost small" onClick={() => setTagging({ version: v.version, tag: '' })}>
                      Tag…
                    </button>
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
