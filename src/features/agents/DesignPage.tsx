import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { AnswerView } from '../ask/AnswerView';
import { DesignSteps } from './DesignSteps';

/**
 * get_design / design_agent response, as observed live on 2026-11-26:
 * { design_id, status: 'running' | 'ready' | …, project, agent, name, phase,
 *   design: { inputs, steps:[{id,type,name}] }, changed_steps, activity[],
 *   designer_says (markdown), changes: { steps_added, steps_changed }, next_steps }
 * Plan approval and questions only happen for new agents and were not observed
 * yet: they are read defensively (plan / questions / waiting_on, several spellings).
 */
export interface DesignView {
  design_id: string;
  status: string;
  project?: string;
  agent?: string;
  name?: string;
  phase?: string;
  design?: {
    inputs?: { name: string; type: string; required?: boolean; description?: string }[];
    steps?: { id: string; type: string; name: string }[];
  };
  changed_steps?: string[];
  activity?: string[];
  designer_says?: string;
  changes?: { steps_added?: string[]; steps_changed?: string[]; steps_removed?: string[] };
  waiting_on?: string;
  plan?: unknown;
  questions?: unknown;
  error?: string;
  next_steps?: string[];
}

type Question = { question: string; options: string[]; multiple?: boolean };
type Msg = { who: 'you' | 'designer'; text: string };

/** The designer waits on each get_design call, so polls are slow by design. */
const MAX_POLLS = 60;

/** Turn designer tool names into words: "Called modify_operator" → "Changing a step". */
const ACTIVITY: Record<string, string> = {
  add_operator: 'Adding a step',
  modify_operator: 'Changing a step',
  remove_operator: 'Removing a step',
  connect_steps: 'Connecting steps',
  update_interface: 'Updating inputs and outputs',
  validate_schema: 'Checking the structure',
  finalize_mind: 'Finalising',
  test_tool_chain: 'Test-running the steps',
  analyze_step: 'Reading a step',
  read_content: 'Reading sources',
  get_sandbox_rules: 'Checking code rules',
  web_search: 'Researching',
};
function activityLabel(a: string) {
  const tool = a.replace(/^Called\s+/, '').trim();
  return ACTIVITY[tool] ?? tool.replace(/_/g, ' ');
}

function planOf(v: DesignView | null): string[] | null {
  const p = v?.plan as unknown;
  if (!p) return null;
  if (Array.isArray(p)) return p.map((x) => (typeof x === 'string' ? x : ((x as { name?: string; text?: string }).name ?? (x as { text?: string }).text ?? JSON.stringify(x))));
  if (typeof p === 'string') return p.split('\n').filter((l) => l.trim());
  const steps = (p as { steps?: unknown[] }).steps;
  return Array.isArray(steps) ? steps.map((s) => (typeof s === 'string' ? s : ((s as { name?: string }).name ?? JSON.stringify(s)))) : [JSON.stringify(p)];
}

function questionsOf(v: DesignView | null): Question[] | null {
  const q = v?.questions as unknown;
  if (!Array.isArray(q) || q.length === 0) return null;
  return q.map((x) => {
    const o = x as Record<string, unknown>;
    const opts = (o.options ?? o.choices ?? []) as unknown[];
    return {
      question: String(o.question ?? o.text ?? o.label ?? ''),
      options: opts.map((y) => (typeof y === 'string' ? y : String((y as { label?: string }).label ?? JSON.stringify(y)))),
      multiple: Boolean(o.multiple ?? o.multi_select ?? o.allow_multiple),
    };
  });
}

/** The designer's markdown, with headings shown as bold lines (the answer renderer has no headings). */
const said = (md: string) => md.replace(/^#{1,6}\s+(.*)$/gm, '**$1**');

/**
 * Build or change a mind by talking to Studio's designer, on the real gateway.
 * Left: the conversation and live activity. Right: the design as it stands,
 * with changed steps marked. Save makes it the agent's new latest version.
 */
export function DesignPage() {
  const { projects, defaultProject, reload } = useStudio();
  const [params] = useSearchParams();
  const changing = params.get('agent') ?? undefined;
  const [project, setProject] = useState<string>(params.get('project') ?? '');
  const [mode, setMode] = useState<'prompt' | 'context'>('prompt');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [view, setView] = useState<DesignView | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<'idle' | 'confirm' | 'saving'>('idle');
  const [saved, setSaved] = useState<{ name: string; tag?: string } | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!project && projects.length) setProject(defaultProject ?? projects[0]?.name ?? '');
  }, [projects, defaultProject, project]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy, view?.activity?.length]);
  useEffect(() => {
    if (view?.name && !name) setName(view.name);
  }, [view, name]);

  const step = async (args: Record<string, unknown>, text?: string) => {
    if (text) setMsgs((m) => [...m, { who: 'you', text }]);
    setBusy(true);
    setErr(null);
    setSaved(null);
    setSaving('idle');
    cancelled.current = false;
    try {
      let r = await callTool<DesignView>('design_agent', {
        ...args,
        ...(view?.design_id
          ? { design_id: view.design_id }
          : { project, mode, ...(changing ? { agent: changing } : {}) }),
      });
      setView(r);
      let polls = 0;
      while (r?.status === 'running' && r.design_id && polls++ < MAX_POLLS && !cancelled.current) {
        r = await callTool<DesignView>('get_design', { design_id: r.design_id });
        if (!cancelled.current) setView(r);
      }
      if (cancelled.current) return;
      setPicked({});
      setMsgs((m) => [...m, { who: 'designer', text: describe(r) }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!view?.design_id) return;
    cancelled.current = true;
    try {
      await callTool('cancel_run', { run_id: view.design_id });
      setMsgs((m) => [...m, { who: 'designer', text: 'Stopped. Nothing was saved.' }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (!view?.design_id) return;
    setSaving('saving');
    setErr(null);
    try {
      await callTool('save_agent', {
        design_id: view.design_id,
        ...(name && name !== view.name ? { name } : {}),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
      });
      setSaved({ name: name || view.name || 'Agent', tag: tag.trim() || undefined });
      setSaving('idle');
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving('confirm');
    }
  };

  const plan = planOf(view);
  const questions = questionsOf(view);
  const waitingPlan = !busy && plan && (view?.waiting_on ?? 'plan') === 'plan' && !questions;
  const allAnswered = questions?.every((q) => (picked[q.question]?.length ?? 0) > 0);
  const ready = view?.status === 'ready';

  return (
    <div className="page page--wide design-page">
      <Link to={changing ? `/agents` : '/agents'} className="crumb">
        <Icon name="chevron" size={12} className="flip" /> Agents
      </Link>
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">{changing ? `Change ${view?.name ?? changing}` : 'Design a new mind'}</h1>
          <p className="page__sub">
            Describe what it should do. Studio's designer plans it, asks what it needs, builds and test-runs the steps. Nothing changes until you save.
          </p>
        </div>
        <div className="design-opts">
          <label className="field design-project">
            <span className="field__label">Project</span>
            <select className="field__input" value={project} onChange={(e) => setProject(e.target.value)} disabled={!!view}>
              {projects.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {!changing && (
            <div className="field">
              <span className="field__label">Designer</span>
              <div className="seg" role="radiogroup" aria-label="Designer">
                <button type="button" role="radio" aria-checked={mode === 'prompt'} className={mode === 'prompt' ? 'is-on' : ''} disabled={!!view} onClick={() => setMode('prompt')} title="Plans steps and prompts">
                  Prompt
                </button>
                <button type="button" role="radio" aria-checked={mode === 'context'} className={mode === 'context' ? 'is-on' : ''} disabled={!!view} onClick={() => setMode('context')} title="Works in files, writes and tests code">
                  Context
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="split">
        <section className="as-zone as-zone--run split__run design-chat">
          <div className="zone-head">
            <span className="as-label">Talk to the designer</span>
            {view?.design_id && <span className="as-mono small muted">design {view.design_id}</span>}
          </div>
          <div className="design-msgs">
            {msgs.length === 0 && !changing && (
              <div className="design-hints">
                {[
                  'Every morning, brief me on new documents in this project: decisions, risks and dates, with sources',
                  'An API that takes a customer contract and returns obligations with due dates as JSON',
                  'A chat assistant that answers HR policy questions from our documents and hands off to a person when unsure',
                ].map((h) => (
                  <button key={h} type="button" className="idea" onClick={() => void step({ request: h }, h)}>
                    {h}
                  </button>
                ))}
              </div>
            )}
            {msgs.length === 0 && changing && <p className="muted">Say what to change. The designer works on a copy; the running agent stays as it is until you save.</p>}
            {msgs.map((m, i) =>
              m.who === 'you' ? (
                <div key={i} className="as-turn--user">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="design-reply">
                  <AnswerView answer={{ text: said(m.text), citations: [] }} />
                </div>
              ),
            )}
            {busy && (
              <div className="design-live">
                <div className="turn-running__line muted">
                  <span className="pulse" /> {view?.activity?.length ? activityLabel(view.activity[view.activity.length - 1]!) : 'The designer is starting…'}
                  <button type="button" className="as-btn as-btn--ghost design-stop" onClick={() => void stop()} disabled={!view?.design_id}>
                    Stop
                  </button>
                </div>
                {(view?.activity?.length ?? 0) > 1 && (
                  <ul className="design-activity">
                    {view!.activity!.slice(0, -1).map((a, i) => (
                      <li key={i}>
                        <Icon name="check" size={11} /> {activityLabel(a)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {err && (
              <div className="as-callout as-callout--error" role="alert">
                {err}
              </div>
            )}

            {waitingPlan && (
              <div className="design-act">
                <button type="button" className="as-btn as-btn--primary" onClick={() => void step({ approve_plan: true }, 'Looks good, go ahead.')}>
                  <Icon name="check" size={14} /> Approve plan
                </button>
                <span className="muted small">or reply below to change it</span>
              </div>
            )}

            {!busy && questions && (
              <div className="design-qs">
                {questions.map((q) => (
                  <div key={q.question} className="design-q">
                    <div className="design-q__text">{q.question}</div>
                    <div className="design-q__opts">
                      {q.options.map((o) => {
                        const on = picked[q.question]?.includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            className={`opt${on ? ' is-on' : ''}`}
                            aria-pressed={on}
                            onClick={() =>
                              setPicked((p) => {
                                const cur = p[q.question] ?? [];
                                const next = q.multiple ? (on ? cur.filter((x) => x !== o) : [...cur, o]) : [o];
                                return { ...p, [q.question]: next };
                              })
                            }
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="as-btn as-btn--primary"
                  disabled={!allAnswered}
                  onClick={() => {
                    const answers = Object.fromEntries(questions.map((q) => [q.question, q.multiple ? (picked[q.question] ?? []) : (picked[q.question]?.[0] ?? '')]));
                    void step({ answers }, Object.values(picked).flat().join(' · '));
                  }}
                >
                  Send answers
                </button>
              </div>
            )}
            <div ref={end} />
          </div>
          <Composer
            target={{ kind: 'project', name: project || 'project' }}
            lockTarget
            disabled={busy}
            placeholder={view ? 'Ask for a change…' : changing ? 'What should change?' : 'Describe the mind you want…'}
            onSubmit={(t) => void step({ request: t }, t)}
          />
        </section>

        <section className="as-zone as-zone--design split__design">
          <div className="zone-head">
            <span className="as-label">Design</span>
            {ready && <span className="as-status as-status--governed">Ready to save</span>}
            {busy && <span className="as-status as-status--model">Designer working</span>}
          </div>

          {!view && <p className="muted">The plan and the steps appear here as the designer works.</p>}

          {plan && waitingPlan && (
            <>
              <div className="as-label sub-head">Proposed plan</div>
              <ol className="plan">
                {plan.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </>
          )}

          {view?.changes && (
            <div className="design-changes">
              {view.changes.steps_added?.map((s) => (
                <span key={`a${s}`} className="pill pill--added">
                  + {s}
                </span>
              ))}
              {view.changes.steps_changed?.map((s) => (
                <span key={`c${s}`} className="pill pill--changed">
                  ~ {s}
                </span>
              ))}
              {view.changes.steps_removed?.map((s) => (
                <span key={`r${s}`} className="pill pill--removed">
                  − {s}
                </span>
              ))}
            </div>
          )}

          {view?.design && (
            <>
              {(view.design.inputs?.length ?? 0) > 0 && (
                <>
                  <div className="as-label sub-head">Inputs</div>
                  {view.design.inputs!.map((i) => (
                    <div key={i.name} className="mini-row">
                      <span className="as-mono small">
                        {i.name}
                        {i.required && <span className="req">required</span>}
                      </span>
                      <span className="mini-row__main muted small">{i.description ?? i.type}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="as-label sub-head">Steps</div>
              <DesignSteps steps={view.design.steps ?? []} changed={view.changed_steps} />
            </>
          )}

          {view && ready && !busy && (
            <div className="save-box">
              {saved ? (
                <div className="preview">
                  <div className="preview__when">
                    Saved “{saved.name}”{saved.tag ? ` as ${saved.tag}` : ''}. It is what people run from now on.
                  </div>
                  <div className="design-act">
                    <button type="button" className="as-btn as-btn--secondary" onClick={() => nav('/agents')}>
                      Go to Agents
                    </button>
                    <Link to={`/routines?new=1&agent=${encodeURIComponent(saved.name)}`} className="as-btn as-btn--secondary">
                      <Icon name="routine" size={14} /> Schedule it
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="save-row">
                    <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" />
                    <input className="field__input save-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag, e.g. v1.1" aria-label="Release tag (optional)" />
                    {saving === 'idle' && (
                      <button type="button" className="as-btn as-btn--primary" onClick={() => setSaving('confirm')}>
                        Save…
                      </button>
                    )}
                  </div>
                  {saving !== 'idle' && (
                    <div className="confirm">
                      <p>
                        Save this as the new latest version of <b>{name || view.name}</b>
                        {tag.trim() ? ` tagged ${tag.trim()}` : ''}? Anyone who runs it gets this version from now on.
                      </p>
                      <div className="design-act">
                        <button type="button" className="as-btn as-btn--primary" onClick={() => void save()} disabled={saving === 'saving'}>
                          {saving === 'saving' ? 'Saving…' : 'Yes, save'}
                        </button>
                        <button type="button" className="as-btn as-btn--ghost" onClick={() => setSaving('idle')} disabled={saving === 'saving'}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function describe(v: DesignView): string {
  if (v.designer_says) return v.designer_says;
  if (v.error) return `The designer stopped: ${v.error}`;
  if (planOf(v)) return 'Here is my plan. Approve it, or tell me what to change.';
  if (questionsOf(v)) return 'A few questions before I build the steps.';
  if (v.status === 'ready') return `Done. ${v.name ? `“${v.name}” has` : 'It has'} ${v.design?.steps?.length ?? 0} steps. Look it over, then save it.`;
  if (v.status === 'running') return 'Still working. Ask me again in a moment to pick up where it is.';
  return `The designer says: ${v.status}.`;
}
