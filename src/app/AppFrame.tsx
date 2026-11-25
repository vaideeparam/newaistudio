import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { Lockup } from '../components/Lockup';
import { useChats } from '../features/chat/store';
import { usePanel } from './panel';
import { useSession } from './session';
import { useStudio } from './studio';

const nav: { to: string; label: string; icon: IconName }[] = [
  { to: '/chats', label: 'Chats', icon: 'chat' },
  { to: '/agents', label: 'Agents', icon: 'agent' },
  { to: '/routines', label: 'Routines', icon: 'routine' },
  { to: '/knowledge', label: 'Knowledge', icon: 'graph' },
  { to: '/governance', label: 'Governance', icon: 'shield' },
];

/**
 * One window: sidebar | main | optional side panel.
 * Design time (agents, routines) and run time (chats) share the same frame,
 * and the workspace is shown, not switched, at the foot of the sidebar.
 */
export function AppFrame() {
  const { session, signOut } = useSession();
  const { workspace, workspaces } = useStudio();
  const { conversations } = useChats();
  const { panel, close } = usePanel();
  const go = useNavigate();
  const role = workspaces.find((w) => w.name === workspace)?.role;

  return (
    <div className={`as-app as-root${panel ? ' as-app--with-panel' : ''}`}>
      <aside className="as-sidebar">
        <div className="sidebar-head">
          <Lockup size={17} />
        </div>
        <button type="button" className="newchat-btn" onClick={() => go('/')}>
          <span className="newchat-btn__icon">
            <Icon name="plus" size={14} />
          </span>
          New chat
        </button>
        <nav aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `as-sidebar__item${isActive ? ' is-active' : ''}`}>
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="as-sidebar__section as-label">Recents</div>
        {conversations.length === 0 && <div className="sidebar-empty">Your chats and agent runs show up here.</div>}
        {conversations.slice(0, 20).map((c) => (
          <NavLink key={c.id} to={`/c/${c.id}`} className={({ isActive }) => `as-sidebar__item recent${isActive ? ' is-active' : ''}`} title={c.title}>
            <span className="recent__title">{c.title}</span>
          </NavLink>
        ))}

        <div className="as-sidebar__footer">
          <div className="me">
            <div className="me__avatar">{(session?.user?.name ?? '?').slice(0, 1)}</div>
            <div className="me__text">
              <div className="me__name">{session?.user?.name ?? 'Signed in'}</div>
              <div className="me__ws">
                <Icon name="lock" size={11} /> {workspace ?? 'Workspace'}
                {role && ` · ${role}`}
              </div>
            </div>
            {session?.mode === 'mock' && <span className="mock-badge">Mock</span>}
            {session?.mode === 'oauth' && (
              <button type="button" className="as-btn as-btn--ghost as-icon-btn" title="Sign out" onClick={() => void signOut()}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="as-main">
        <Outlet />
      </main>

      {panel && (
        <aside className="as-panel">
          <div className="as-panel__head">
            <span className="panel-title">{panel.title}</span>
            <button type="button" className="as-btn as-btn--ghost as-icon-btn" aria-label="Close panel" onClick={close}>
              <Icon name="close" />
            </button>
          </div>
          <div className="panel-body">{panel.body}</div>
        </aside>
      )}
    </div>
  );
}
