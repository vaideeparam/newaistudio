import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { config } from './config.js';
import { NotSignedInError, callTool, isSignedIn, listTools } from './gateway.js';
import { mockCallTool, mockListTools, mockUser } from './mock.js';
import { SessionOAuthProvider } from './oauth.js';
import { SESSION_COOKIE, createSession, destroySession, getSession, type Session } from './sessions.js';

const app = new Hono();

function currentSession(c: Context): Session | undefined {
  return getSession(getCookie(c, SESSION_COOKIE));
}

function ensureSession(c: Context): Session {
  const existing = currentSession(c);
  if (existing) return existing;
  const s = createSession();
  setCookie(c, SESSION_COOKIE, s.id, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
  return s;
}

/** Only allow same-site relative paths as post-login destinations. */
function safeReturnTo(v: string | undefined): string {
  return v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/';
}

/**
 * State-changing routes need this header. Browsers can't add it cross-site
 * without a CORS preflight, which we never approve, so it blocks CSRF.
 */
app.use('/api/*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('x-studio-request') !== '1') {
    return c.json({ error: { message: 'Missing X-Studio-Request header' } }, 403);
  }
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true, mode: config.mode }));

// ---------- auth ----------

app.get('/api/auth/status', async (c) => {
  if (config.mode === 'mock') return c.json({ signedIn: true, mode: config.mode, user: mockUser });
  const session = config.mode === 'token' ? ensureSession(c) : currentSession(c);
  const signedIn = isSignedIn(session);
  if (signedIn && session && !session.user) await loadUser(session);
  return c.json({ signedIn, mode: config.mode, user: signedIn ? session?.user : undefined });
});

app.get('/api/auth/login', async (c) => {
  const returnTo = safeReturnTo(c.req.query('returnTo'));
  if (config.mode !== 'oauth') return c.redirect(returnTo);
  const session = ensureSession(c);
  session.returnTo = returnTo;
  const provider = new SessionOAuthProvider(session);
  const result = await auth(provider, { serverUrl: config.gatewayUrl!, scope: config.oauthScope });
  if (result === 'REDIRECT' && provider.pendingRedirect) return c.redirect(provider.pendingRedirect.toString());
  return c.redirect(returnTo);
});

app.get('/api/auth/callback', async (c) => {
  const session = currentSession(c);
  const { code, state, error, error_description } = c.req.query();
  if (!session) return c.redirect('/signin?error=session_expired');
  if (error) return c.redirect(`/signin?error=${encodeURIComponent(error_description ?? error)}`);
  if (!code || !state || state !== session.oauthState) return c.redirect('/signin?error=invalid_state');
  session.oauthState = undefined;
  const provider = new SessionOAuthProvider(session);
  const result = await auth(provider, {
    serverUrl: config.gatewayUrl!,
    authorizationCode: code,
    scope: config.oauthScope,
  });
  if (result !== 'AUTHORIZED') return c.redirect('/signin?error=not_authorized');
  await loadUser(session);
  return c.redirect(safeReturnTo(session.returnTo));
});

app.post('/api/auth/logout', (c) => {
  const id = getCookie(c, SESSION_COOKIE);
  if (id) destroySession(id);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

async function loadUser(session: Session) {
  try {
    const { data } = await callTool(session, 'whoami', {});
    const you = (data as { you?: { name?: string; email?: string } })?.you;
    if (you?.name) session.user = { name: you.name, email: you.email };
  } catch (err) {
    console.warn('whoami failed after sign-in', err);
  }
}

// ---------- MCP proxy ----------

app.get('/api/mcp/tools', async (c) => {
  if (config.mode === 'mock') return c.json({ data: mockListTools() });
  const session = config.mode === 'token' ? ensureSession(c) : currentSession(c);
  if (!session) return c.json({ error: { message: 'Not signed in' } }, 401);
  return c.json({ data: await listTools(session) });
});

app.post('/api/mcp/tools/:name', async (c) => {
  const name = c.req.param('name');
  let args: Record<string, unknown> = {};
  try {
    const body = await c.req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) args = body as Record<string, unknown>;
  } catch {
    /* empty body is fine */
  }
  const outcome =
    config.mode === 'mock'
      ? await mockCallTool(name, args)
      : await (async () => {
          const session = config.mode === 'token' ? ensureSession(c) : currentSession(c);
          if (!session) throw new NotSignedInError();
          return callTool(session, name, args, c.req.raw.signal);
        })();
  if (outcome.isError) {
    const message = typeof outcome.data === 'string' ? outcome.data : `Tool ${name} failed`;
    return c.json({ error: { message, tool: name, details: outcome.data } }, 422);
  }
  return c.json({ data: outcome.data });
});

app.onError((err, c) => {
  if (err instanceof NotSignedInError) return c.json({ error: { message: err.message } }, 401);
  console.error(err);
  // Browser navigations (sign-in redirects) should land on a page, not raw JSON.
  if (c.req.method === 'GET' && /^\/api\/auth\/(login|callback)/.test(c.req.path)) {
    return c.redirect('/signin?error=gateway_unreachable');
  }
  return c.json({ error: { message: config.isProd ? 'Gateway error' : String(err) } }, 502);
});

// ---------- built UI (production) ----------

if (config.isProd) {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`ai/Studio API on http://localhost:${info.port} (mode: ${config.mode})`);
});
