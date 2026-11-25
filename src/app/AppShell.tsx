import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from './session';
import { navItems } from './nav';

export function AppShell() {
  const { session, signOut } = useSession();
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__logo">
          ai<span className="shell__logo-slash">/</span>Studio
        </div>
        <nav className="shell__nav" aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `shell__nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="shell__main">
        <header className="shell__topbar">
          {/* Workspace / project pickers land here once that thread's work is in. */}
          <div className="shell__context" />
          <div className="shell__user">
            {session?.mode === 'mock' && <span className="badge badge--warning">Mock data</span>}
            {session?.user && <span className="shell__user-name">{session.user.name}</span>}
            {session?.mode === 'oauth' && (
              <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>
                Sign out
              </button>
            )}
          </div>
        </header>
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
