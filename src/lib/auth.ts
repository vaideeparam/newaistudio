/** `connector`: the published preview, reading the viewer's own ai/Studio through claude.ai. */
export type AuthMode = 'oauth' | 'token' | 'mock' | 'connector';

export interface SessionInfo {
  signedIn: boolean;
  mode: AuthMode;
  user?: { name: string; email?: string };
  /** Why the preview is showing sample data instead of live data. */
  note?: string;
  /** The preview could go live: show a "Connect live data" button. */
  retryLive?: boolean;
}

export async function getSession(): Promise<SessionInfo> {
  if (import.meta.env.VITE_STATIC_MOCK === '1') {
    const { mockUser } = await import('../../server/mock');
    const { inViewer, liveCall } = await import('./connector');
    const { setLive } = await import('./mcp');
    // Outside claude.ai (a saved file, local preview) the sample data is expected; say nothing.
    if (!inViewer()) return { signedIn: true, mode: 'mock', user: mockUser };
    try {
      const who = await liveCall<{ you?: { name: string; email?: string } }>('whoami', {});
      setLive(true);
      return { signedIn: true, mode: 'connector', user: who.you };
    } catch (e) {
      // Never fall back silently: the banner says why and offers a retry.
      return { signedIn: true, mode: 'mock', user: mockUser, note: (e as Error).message, retryLive: true };
    }
  }
  const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Could not reach the ai/Studio server (${res.status})`);
  return (await res.json()) as SessionInfo;
}

/** Full-page redirect: the server runs OAuth with the Gateway and sends us back. */
export function signIn(returnTo: string = window.location.pathname + window.location.search): void {
  window.location.assign(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-Studio-Request': '1' },
  });
}
