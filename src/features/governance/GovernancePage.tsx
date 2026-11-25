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

/** Governance: who can see what, where data lives, which models run, and what happened. */
export function GovernancePage() {
  const { workspaces } = useStudio();
  const g = useTool<Summary>('governance_summary');
  const audit = useTool<Audit>('audit_log');
  const s = g.data;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Governance</h1>
          <p className="page__sub">Who can see what, where data lives, and every run on record.</p>
        </div>
      </div>

      <div className="gov">
        <section className="as-card as-card--governed gov__iso">
          <div className="zone-head">
            <span className="as-label">Data isolation</span>
            <span className="as-status as-status--governed as-status--live">Enforced</span>
          </div>
          <p>{s?.isolation ?? '…'}</p>
          <div className="ws-map">
            {workspaces.map((w) => (
              <div key={w.name} className={`ws-box${w.name === s?.workspace ? ' is-current' : ''}${w.this_app_can_use === false ? ' is-off' : ''}`}>
                <Icon name="lock" size={12} />
                <div>
                  <div className="ws-box__name">{w.name}</div>
                  <div className="muted small">
                    {w.role}
                    {w.this_app_can_use === false && ' · not connected to this app'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {s?.residency && (
            <div className="muted small">
              Data residency: <span className="as-mono">{s.residency}</span>
            </div>
          )}
        </section>

        <section className="as-card">
          <div className="as-label sub-head">Shared with others</div>
          {s?.shared_projects?.map((p) => (
            <div key={p.project} className="mini-row">
              <Icon name="doc" size={14} />
              <span className="mini-row__main">
                <b>{p.project}</b> → {p.with}
              </span>
              <span className="pill">{p.access}</span>
            </div>
          ))}
          <div className="as-label sub-head">Policies</div>
          {s?.policies?.map((p) => (
            <div key={p} className="mini-row">
              <Icon name="check" size={14} />
              <span className="mini-row__main">{p}</span>
            </div>
          ))}
        </section>

        <section className="as-card">
          <div className="as-label sub-head">Models allowed</div>
          {s?.models?.map((m) => (
            <div key={m.name} className="mini-row">
              <span className={`dot dot--${m.allowed ? 'active' : 'paused'}`} />
              <span className="mini-row__main as-mono">{m.name}</span>
              <span className="muted small">
                {m.provider} · {m.retention}
              </span>
            </div>
          ))}
          <div className="as-label sub-head">Members</div>
          {s?.members?.map((m) => (
            <div key={m.name} className="mini-row">
              <span className="mini-row__main">{m.name}</span>
              <span className="pill">{m.role}</span>
            </div>
          ))}
        </section>

        <section className="as-console gov__audit">
          <div className="as-console__bar">
            <span>Audit log</span>
            <span>{s?.workspace}</span>
          </div>
          <div className="as-console__body">
            {audit.data?.events?.map((e, i) => (
              <div key={i} className="audit-row">
                <span className="audit-row__when">{new Date(e.when).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="audit-row__what">
                  <b>{e.who}</b> {e.what}
                </span>
                <span className="audit-row__scope">{e.scope}</span>
                <span className={e.model_calls ? 'is-model' : 'is-governed'}>{e.model_calls} model</span>
                <span>${e.cost_usd.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
