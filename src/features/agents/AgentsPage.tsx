import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';

export function AgentsPage() {
  const { agents, loading } = useStudio();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'published' | 'draft'>('all');
  const list = useMemo(
    () =>
      agents.filter(
        (a) =>
          (show === 'all' || (a.status ?? 'published') === show) &&
          (a.name + ' ' + (a.description ?? '') + ' ' + (a.project ?? '')).toLowerCase().includes(q.toLowerCase()),
      ),
    [agents, q, show],
  );
  const drafts = agents.filter((a) => a.status === 'draft').length;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Agents</h1>
          <p className="page__sub">Run them, change them and schedule them, all from here.</p>
        </div>
        <Link to="/agents/new" className="as-btn as-btn--primary">
          <Icon name="spark" size={14} /> Design a new agent
        </Link>
      </div>
      <label className="search">
        <Icon name="search" />
        <input placeholder={`Search ${agents.length} agents`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="seg agents-filter" role="tablist">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={show === f} className={show === f ? 'is-on' : ''} onClick={() => setShow(f)}>
            {f === 'all' ? `All ${agents.length}` : f === 'published' ? 'Published' : `Drafts ${drafts}`}
          </button>
        ))}
      </div>
      {loading && <p className="muted">Loading agents…</p>}
      <div className="grid">
        {list.map((a) => (
          <Link key={a.id} to={`/agents/${encodeURIComponent(a.id)}`} className="as-card agent-card">
            <div className="agent-card__icon">
              <Icon name="agent" />
            </div>
            <div className="as-card__title">{a.name}</div>
            <div className="as-card__meta clamp3">{a.description || 'No description yet.'}</div>
            <div className="agent-card__foot">
              {a.status === 'draft' && <span className="pill pill--draft">Draft</span>}
              {a.project && <span className="muted small">{a.project}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
