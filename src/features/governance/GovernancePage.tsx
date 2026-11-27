import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../app/session';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';
import { useTool } from '../../lib/useTool';

interface Summary {
  workspace: string;
  isolation: string;
  residency?: string;
  models?: { name: string; provider: string; allowed: boolean; retention: string }[];
  members?: { name: string; role: string }[];
  shared_projects?: { project: string; with: string; access: string }[];
  policies?: string[];
}
interface Audit {
  events?: { when: string; who: string; what: string; scope: string; model_calls: number; cost_usd: number }[];
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'data', label: 'Data and isolation' },
  { id: 'sharing', label: 'Sharing' },
  { id: 'models', label: 'Models' },
  { id: 'people', label: 'People' },
  { id: 'policies', label: 'Policies' },
  { id: 'activity', label: 'Activity' },
];

/**
 * Governance, the way a settings page in Claude web reads: a quiet section
 * list, one column, each section opens with a plain answer, and every
 * setting sits on a row with its control on the right.
 */
export function GovernancePage() {
  const { session } = useSession();
  const { workspaces, connectors } = useStudio();
  const g = useTool<Summary>('governance_summary');
  const audit = useTool<Audit>('audit_log');
  const s = g.data;
  const [active, setActive] = useState('overview');
  const [models, setModels] = useState<Record<string, boolean>>({});
  const [policies, setPolicies] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'runs' | 'changes'>('all');

  useEffect(() => {
    if (!s) return;
    setModels(Object.fromEntries((s.models ?? []).map((m) => [m.name, m.allowed])));
    setPolicies(Object.fromEntries([...(s.policies ?? []), 'Ask a person before an agent writes to a connector'].map((p, i) => [p, i < (s.policies?.length ?? 0)])));
  }, [s]);

  // Highlight the section in view.
  useEffect(() => {
    const root = document.querySelector('.gov2');
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { root: root.closest('.page'), rootMargin: '-10% 0px -70% 0px' },
    );
    SECTIONS.forEach((x) => {
      const el = document.getElementById(x.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [s]);

  const allowed = Object.entries(models).filter(([, v]) => v).map(([k]) => k);
  const writers = connectors.filter((c) => c.access === 'read_write');
  const events = useMemo(
    () =>
      (audit.data?.events ?? []).filter((e) =>
        filter === 'all' ? true : filter === 'runs' ? /^Ran|^Asked/.test(e.what) : !/^Ran|^Asked/.test(e.what),
      ),
    [audit.data, filter],
  );

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="page gov2-page">
      <div className="gov2">
        <nav className="gov2__nav" aria-label="Governance sections">
          <h1 className="as-display gov2__title">
            Governance
            {session?.mode === 'connector' && <span className="sample-tag" title="No backend tool for this screen yet">Sample data</span>}
          </h1>
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" className={`gov2__link${active === x.id ? ' is-on' : ''}`} onClick={() => go(x.id)}>
              {x.label}
            </button>
          ))}
        </nav>

        <div className="gov2__body">
          <section id="overview" className="gsec">
            <h2 className="gsec__h">Overview</h2>
            <ul className="answers">
              <li>
                <Icon name="check" size={16} />
                <span>Your data stays in <b>{s?.workspace ?? 'this workspace'}</b>. Other workspaces can't see it.</span>
              </li>
              <li>
                <Icon name="check" size={16} />
                <span>{s?.shared_projects?.length ?? 0} project{s?.shared_projects?.length === 1 ? ' is' : 's are'} shared outside this workspace, read only.</span>
              </li>
              <li>
                <Icon name="check" size={16} />
                <span>Only {allowed.length === 1 ? <b>{allowed[0]}</b> : `${allowed.length} approved models`} can run, with zero data retention.</span>
              </li>
              <li>
                <Icon name="check" size={16} />
                <span>Every answer must cite its source, and every run is recorded below.</span>
              </li>
              {writers.length > 0 && (
                <li className="answers__warn">
                  <Icon name="bolt" size={16} />
                  <span>{writers.length} connector{writers.length === 1 ? ' can' : 's can'} write: {writers.map((w) => w.name).join(', ')}.</span>
                </li>
              )}
            </ul>
          </section>

          <section id="data" className="gsec">
            <h2 className="gsec__h">Data and isolation</h2>
            <p className="gsec__lead">{s?.isolation}</p>
            <div className="rowset">
              {workspaces.map((w) => (
                <Row
                  key={w.name}
                  title={w.name}
                  sub={w.name === s?.workspace ? 'This workspace · your data lives here' : w.this_app_can_use === false ? 'Not connected to this app' : 'Separate documents, graph and history'}
                  icon="lock"
                >
                  <span className="pill">{w.role}</span>
                </Row>
              ))}
              <Row title="Data region" sub="Where documents, graphs and run history are stored">
                <span className="as-mono small">{s?.residency ?? '—'}</span>
              </Row>
              <Row title="Use your data to train models" sub="Studio never sends your data for model training">
                <span className="muted small">Never</span>
              </Row>
              <Row title="Keep chat and run history" sub="After this, history is deleted. The audit record stays.">
                <select className="field__input gov2__select" defaultValue="365">
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                  <option value="0">Forever</option>
                </select>
              </Row>
            </div>
          </section>

          <section id="sharing" className="gsec">
            <h2 className="gsec__h">Sharing</h2>
            <p className="gsec__lead">Projects you've shared with people outside {s?.workspace ?? 'this workspace'}.</p>
            <div className="rowset">
              {s?.shared_projects?.map((p) => (
                <Row key={p.project} title={p.project} sub={`Shared with ${p.with}`} icon="doc">
                  <select className="field__input gov2__select" defaultValue="cited">
                    <option value="cited">Cited answers only</option>
                    <option value="read">Read documents</option>
                  </select>
                  <button type="button" className="as-btn as-btn--ghost gov2__danger">
                    Stop sharing
                  </button>
                </Row>
              ))}
            </div>
          </section>

          <section id="models" className="gsec">
            <h2 className="gsec__h">Models</h2>
            <p className="gsec__lead">Agents and chats can only use the models switched on here.</p>
            <div className="rowset">
              {s?.models?.map((m) => (
                <Row key={m.name} title={m.name} sub={`${m.provider}${m.retention && m.retention !== '—' ? ` · ${m.retention}` : ''}`} mono>
                  <Switch on={!!models[m.name]} onChange={(v) => setModels((x) => ({ ...x, [m.name]: v }))} label={`Allow ${m.name}`} />
                </Row>
              ))}
            </div>
          </section>

          <section id="people" className="gsec">
            <h2 className="gsec__h">People</h2>
            <p className="gsec__lead">Owners manage everything. Developers build and publish agents. Users run them.</p>
            <div className="rowset">
              {s?.members?.map((m) => (
                <Row key={m.name} title={m.name} avatar={m.name}>
                  <select className="field__input gov2__select" defaultValue={m.role}>
                    <option value="owner">Owner</option>
                    <option value="developer">Developer</option>
                    <option value="user">User</option>
                  </select>
                </Row>
              ))}
            </div>
          </section>

          <section id="policies" className="gsec">
            <h2 className="gsec__h">Policies</h2>
            <p className="gsec__lead">Rules every agent in this workspace follows, whoever built it.</p>
            <div className="rowset">
              {Object.keys(policies).map((p) => (
                <Row key={p} title={p}>
                  <Switch on={!!policies[p]} onChange={(v) => setPolicies((x) => ({ ...x, [p]: v }))} label={p} />
                </Row>
              ))}
            </div>
          </section>

          <section id="activity" className="gsec">
            <div className="gsec__row">
              <h2 className="gsec__h">Activity</h2>
              <button type="button" className="as-btn as-btn--secondary gov2__export">
                <Icon name="upload" size={14} /> Export
              </button>
            </div>
            <div className="seg gov2__filter">
              {(['all', 'runs', 'changes'] as const).map((f) => (
                <button key={f} type="button" className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Everything' : f === 'runs' ? 'Runs' : 'Changes'}
                </button>
              ))}
            </div>
            <table className="atable">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What happened</th>
                  <th>Project</th>
                  <th className="num">AI calls</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i}>
                    <td className="muted">{new Date(e.when).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <b>{e.who}</b> <span className="muted">{e.what.charAt(0).toLowerCase() + e.what.slice(1)}</span>
                    </td>
                    <td className="muted">{e.scope}</td>
                    <td className="num">{e.model_calls}</td>
                    <td className="num">${e.cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
  title,
  sub,
  icon,
  avatar,
  mono,
  children,
}: {
  title: string;
  sub?: string;
  icon?: 'lock' | 'doc';
  avatar?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="grow">
      {icon && <Icon name={icon} size={14} className="grow__icon" />}
      {avatar && <span className="grow__avatar">{avatar.slice(0, 1)}</span>}
      <div className="grow__text">
        <div className={`grow__title${mono ? ' as-mono' : ''}`}>{title}</div>
        {sub && <div className="grow__sub">{sub}</div>}
      </div>
      <div className="grow__ctl">{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}
