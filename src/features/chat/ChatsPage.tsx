import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useChats } from './store';

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

export function ChatsPage() {
  const { conversations, remove } = useChats();
  const [q, setQ] = useState('');
  const list = useMemo(
    () => conversations.filter((c) => (c.title + c.target.name).toLowerCase().includes(q.toLowerCase())),
    [conversations, q],
  );

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="as-display page__title">Chats</h1>
        <Link to="/" className="as-btn as-btn--primary">
          <Icon name="plus" size={14} /> New chat
        </Link>
      </div>
      <label className="search">
        <Icon name="search" />
        <input placeholder="Search your chats" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="rows">
        {list.length === 0 && <p className="muted">No chats yet. Ask a project or run an agent to start one.</p>}
        {list.map((c) => (
          <div className="row" key={c.id}>
            <Link to={`/c/${c.id}`} className="row__main">
              <div className="row__title">{c.title}</div>
              <div className="row__meta">
                <Icon name={c.target.kind === 'agent' ? 'agent' : 'doc'} size={12} /> {c.target.name} · {c.turns.length} message
                {c.turns.length === 1 ? '' : 's'} · {ago(c.updatedAt)}
              </div>
            </Link>
            <button type="button" className="as-btn as-btn--ghost as-icon-btn" aria-label="Delete chat" onClick={() => remove(c.id)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
