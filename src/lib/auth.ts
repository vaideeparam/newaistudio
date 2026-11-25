export type AuthMode = 'oauth' | 'token' | 'mock';

export interface SessionInfo {
  signedIn: boolean;
  mode: AuthMode;
  user?: { name: string; email?: string };
}

export async function getSession(): Promise<SessionInfo> {
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
