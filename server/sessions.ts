import { randomBytes } from 'node:crypto';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { config } from './config.js';

/**
 * Everything we hold for one browser session. Lives only on the server;
 * the browser only ever sees the opaque session id in an httpOnly cookie.
 *
 * GUESS: in-memory store is fine for a single-instance first version. Move to
 * Redis (or similar) before running more than one server instance.
 */
export interface Session {
  id: string;
  createdAt: number;
  lastSeen: number;
  tokens?: OAuthTokens;
  clientInfo?: OAuthClientInformationMixed;
  codeVerifier?: string;
  oauthState?: string;
  /** Where to send the browser after sign-in completes. */
  returnTo?: string;
  user?: { name: string; email?: string };
  client?: Client;
}

const sessions = new Map<string, Session>();

export const SESSION_COOKIE = 'studio_sid';

export function createSession(): Session {
  const id = randomBytes(32).toString('base64url');
  const now = Date.now();
  const s: Session = { id, createdAt: now, lastSeen: now };
  sessions.set(id, s);
  return s;
}

export function getSession(id: string | undefined): Session | undefined {
  if (!id) return undefined;
  const s = sessions.get(id);
  if (!s) return undefined;
  if (Date.now() - s.lastSeen > config.sessionTtlMs) {
    destroySession(id);
    return undefined;
  }
  s.lastSeen = Date.now();
  return s;
}

export function destroySession(id: string): void {
  const s = sessions.get(id);
  sessions.delete(id);
  void s?.client?.close().catch(() => {});
}

/** Drop expired sessions every 10 minutes. */
setInterval(() => {
  const cutoff = Date.now() - config.sessionTtlMs;
  for (const [id, s] of sessions) if (s.lastSeen < cutoff) destroySession(id);
}, 10 * 60_000).unref();
