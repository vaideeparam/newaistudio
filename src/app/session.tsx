import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSession, signIn, signOut, type SessionInfo } from '../lib/auth';

interface SessionState {
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (returnTo?: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await getSession());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doSignOut = useCallback(async () => {
    await signOut();
    await refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh, signIn, signOut: doSignOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
