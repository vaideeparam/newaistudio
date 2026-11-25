import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './session';

/** Gate for pages that need a signed-in user. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading, error } = useSession();
  const location = useLocation();
  if (loading && !session) return <div className="page-status">Loading…</div>;
  if (error) return <div className="page-status page-status--error">{error}</div>;
  if (!session?.signedIn) {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <>{children}</>;
}
