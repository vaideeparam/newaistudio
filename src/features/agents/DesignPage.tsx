import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';

/** GUESS: get_design's shape is inferred from its tool description, not observed yet. */
interface DesignView {
  design_id: string;
  status: 'running' | 'waiting' | 'ready' | string;
  progress?: string;
  waiting_on?: 'plan' | 'questions' | string;
  summary?: string;
  plan?: string[];
  questions?: { question: string; options: string[]; multiple?: boolean }[];
  name?: string;
  inputs?: { name: string; type: string; required?: boolean; description?: string }[];
  steps?: { id: string; type: string; name: string }[];
  changes?: string[];
}

type Msg = { who: 'you' | 'designer'; text: string; view?: DesignView };

const MAX_POLLS = 20;

/**
 * Build an agent by talking to Studio's designer. The conversation is on the
 * left (design time as a chat), the design it produces is on the right, and
 * Save makes it something people can run from the Agents page.
 */
export function DesignPage() {
  const { projects, defaultProject, reload } = useStudio();
  const [params] = useSearchParams();
  const changing = params.get('agent') ?? undefined;
  const [project, setProject] = useState<string>('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [view, setView] = useState<DesignView | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!project && projects.length) setProject(defaultProject ?? projects[0]?.name ?? '');
  }, [projects, defaultProject, project]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy]);
  useEffect(() => {
    if (view?.name && !name) setName(view.name);
  }, [view, name]);

  const step = async (args: Record<string, unknown>, said?: string) => {
    if (said) setMsgs((m) => [...m, { who: 'you', text: said }]);
    setBusy(true);
    try {
      let r = await callTool<DesignView>('design_agent', {
        ...args,
        ...(view?.design_id ? { design_id: view.design_id } : { project, ...(changing ? { agent: changing } : {}) }),
      });
      let polls = 0;
      while (r?.status === 'running' && r.design_id && polls++ < MAX_POLLS) {
        r = await callTool<DesignView>('get_design', { design_id: r.design_id });
      }
      setView(r);
      setPicked({});
      setMsgs((m) => [...m, { who: 'designer', text: describe(r), view: r }]);
    } catch (e) {
      setMsgs((m) => [...m, { who: 'designer', text: `The designer stopped: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!view?.design_id) return;
    const r = await callTool<{ name?: string }>('save_agent', { design_id: view.design_id, name: name || undefined });
    setSaved(r?.name ?? name);
    await reload();
  };

  const waitingQuestions = view?.waiting_on === 'questions' && view.questions;
  const allAnswered = waitingQuestions && view.questions!.every((q) => picked[q.question]);

  return (
    <div className="page page--wide design-page">
      <Link to="/agents" className="crumb">
        <Icon name="chevron" size={12} className="flip" /> Agents
      </Link>
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">{changing ? `Change ${changing}` : 'Design a new agent'}</h1>
          <p className="page__sub">Describe what it should do. Studio's designer proposes a plan, asks what it needs, and builds the steps.</p>
        </div>
        <label className="field design-project">
          <span className="field__label">Project</span>
          <select className="field__input" value={project} onChange={(e) => setProject(e.target.value)} disabled={!!view}>
            {projects.map((p) => (
              <option key={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="split">
        <section className="as-zone as-zone--run split__run design-chat">
          <div className="zone-head">
            <span className="as-label">Talk to the designer</span>
          </div>
          <div className="design-msgs">
            {msgs.length === 0 && (
              <div className="design-hints">
                {[
                  'Every morning, brief me on new documents in this project: decisions, risks and dates, with sources',
                  'Read a customer contract and list obligations with due dates',
                  'Answer HR policy questions and say when a human should be asked',
                ].map((h) => (
                  <button key={h} type="button" className="idea" onClick={() => void step({ request: h }, h)}>
                    {h}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.who === 'you' ? 'as-turn--user' : 'design-reply'}>
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="turn-running__line muted">
                <span className="pulse" /> The designer is working…
              </div>
            )}

            {!busy && view?.waiting_on === 'plan' && (
              <div className="design-act">
                <button type="button" className="as-btn as-btn--primary" onClick={() => void step({ approve_plan: true }, 'Looks good, go ahead.')}>
                  <Icon name="check" size={14} /> Approve plan
                </button>
                <span className="muted small">or reply below to change it</span>
              </div>
            )}

            {!busy && waitingQuestions && (
              <div className="design-qs">
                {view!.questions!.map((q) => (
                  <div key={q.question} className="design-q">
                    <div className="design-q__text">{q.question}</div>
                    <div className="design-q__opts">
                      {q.options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          className={`opt${picked[q.question] === o ? ' is-on' : ''}`}
                          onClick={() => setPicked((p) => ({ ...p, [q.question]: o }))}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="as-btn as-btn--primary"
                  disabled={!allAnswered}
                  onClick={() => void step({ answers: picked }, Object.values(picked).join(' · '))}
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
            placeholder={view ? 'Ask for a change…' : 'Describe the agent you want…'}
            onSubmit={(t) => void step({ request: t }, t)}
          />
        </section>

        <section className="as-zone as-zone--design split__design">
          <div className="zone-head">
            <span className="as-label">Design</span>
            {view?.status === 'ready' && <span className="as-status as-status--governed">Ready to save</span>}
          </div>

          {!view && <p className="muted">The plan and the steps appear here as the designer works.</p>}

          {view?.plan && view.waiting_on === 'plan' && (
            <ol className="plan">
              {view.plan.map((p) => (
                <li key={p} className={/\(model/.test(p) ? 'is-model' : 'is-code'}>
                  {p}
                </li>
              ))}
            </ol>
          )}

          {view?.steps && (
            <>
              {view.inputs && view.inputs.length > 0 && (
                <>
                  <div className="as-label sub-head">Inputs</div>
                  {view.inputs.map((i) => (
                    <div key={i.name} className="mini-row">
                      <span className="as-mono small">{i.name}</span>
                      <span className="mini-row__main muted small">{i.description ?? i.type}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="as-label sub-head">Steps</div>
              <div className="pipeline">
                {view.steps.map((s, i) => {
                  const model = s.type === 'llm_prompt';
                  return (
                    <div key={s.id} className={`pipe-step ${model ? 'pipe-step--model' : 'pipe-step--code'}`}>
                      <div className="pipe-step__n">{i + 1}</div>
                      <div className="pipe-step__body">
                        <div className="pipe-step__name">{s.name}</div>
                        <div className="pipe-step__type">
                          <Icon name={model ? 'spark' : 'code'} size={12} /> {model ? 'Model call' : 'Code, governed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {saved ? (
                <div className="preview">
                  <div className="preview__when">Saved “{saved}” as a draft.</div>
                  <div className="design-act">
                    <button type="button" className="as-btn as-btn--secondary" onClick={() => nav('/agents')}>
                      Go to Agents
                    </button>
                    <Link to={`/routines?new=1&agent=${encodeURIComponent(saved)}`} className="as-btn as-btn--secondary">
                      <Icon name="routine" size={14} /> Schedule it
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="save-row">
                  <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" />
                  <button type="button" className="as-btn as-btn--primary" onClick={() => void save()} disabled={view.status !== 'ready'}>
                    Save agent
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function describe(v: DesignView): string {
  if (v.waiting_on === 'plan') return `${v.summary ?? 'Here is my plan.'} Approve it, or tell me what to change.`;
  if (v.waiting_on === 'questions') return 'A couple of questions before I build the steps.';
  if (v.status === 'ready') return `Done. ${v.name ? `“${v.name}” has` : 'It has'} ${v.steps?.length ?? 0} steps. Look it over on the right, then save it.`;
  return v.progress ?? 'Still working.';
}
