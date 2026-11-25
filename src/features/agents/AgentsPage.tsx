import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';

export function AgentsPage() {
  const { agents, loading } = useStudio();
  const [q, setQ] = useState('');
  const list = useMemo(
    () => agents.filter((a) => (a.name + ' ' + (a.description ?? '')).toLowerCase().includes(q.toLowerCase())),
    [agents, q],
  );

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Agents</h1>
          <p className="page__sub">Run them, change them and schedule them, all from here.</p>
        </div>
        <button type="button" className="as-btn as-btn--primary">
          <Icon name="spark" size={14} /> Design a new agent
        </button>
      </div>
      <label className="search">
        <Icon name="search" />
        <input placeholder={`Search ${agents.length} agents`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {loading && <p className="muted">Loading agents…</p>}
      <div className="grid">
        {list.map((a) => (
          <Link key={a.id} to={`/agents/${encodeURIComponent(a.id)}`} className="as-card agent-card">
            <div className="agent-card__icon">
              <Icon name="agent" />
            </div>
            <div className="as-card__title">{a.name}</div>
            <div className="as-card__meta clamp3">{a.description || 'No description yet.'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
