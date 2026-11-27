import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { config } from './config.js';
import { normalizeToolResult, type ToolOutcome } from './normalize.js';
import { SessionOAuthProvider } from './oauth.js';
import type { Session } from './sessions.js';

export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in to ai/Studio');
  }
}

/**
 * Some Gateway tools (get_run, get_design) wait for Studio for tens of seconds.
 * GUESS: 5 minutes is a safe ceiling; the SDK's default is 60s.
 */
const TOOL_TIMEOUT_MS = 5 * 60_000;

/** Shared client for token mode (one identity for the whole server, dev only). */
let tokenClient: Client | undefined;

async function connect(session: Session): Promise<Client> {
  if (config.mode === 'token') {
    if (tokenClient) return tokenClient;
  } else if (session.client) {
    return session.client;
  }

  const url = new URL(config.gatewayUrl!);
  const transport =
    config.mode === 'token'
      ? new StreamableHTTPClientTransport(url, {
          requestInit: { headers: { Authorization: `Bearer ${config.staticToken}` } },
        })
      : new StreamableHTTPClientTransport(url, { authProvider: new SessionOAuthProvider(session) });

  const client = new Client({ name: 'ai-studio-web', version: '0.1.0' });
  try {
    await client.connect(transport);
  } catch (err) {
    if (err instanceof UnauthorizedError) throw new NotSignedInError();
    throw err;
  }
  client.onclose = () => {
    if (config.mode === 'token') tokenClient = undefined;
    else session.client = undefined;
  };
  if (config.mode === 'token') tokenClient = client;
  else session.client = client;
  return client;
}

export function isSignedIn(session: Session | undefined): boolean {
  if (config.mode === 'token') return true;
  return Boolean(session?.tokens);
}

export async function listTools(session: Session) {
  if (!isSignedIn(session)) throw new NotSignedInError();
  const client = await connect(session);
  const { tools } = await client.listTools();
  return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

export async function callTool(
  session: Session,
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolOutcome> {
  if (!isSignedIn(session)) throw new NotSignedInError();
  const client = await connect(session);
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: TOOL_TIMEOUT_MS,
      signal,
    });
    // Legacy servers may answer with { toolResult } instead of content.
    if ('toolResult' in result && !('content' in result)) return { isError: false, data: result.toolResult };
    return normalizeToolResult(result as Parameters<typeof normalizeToolResult>[0]);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      session.tokens = undefined;
      session.client = undefined;
      throw new NotSignedInError();
    }
    throw err;
  }
}
