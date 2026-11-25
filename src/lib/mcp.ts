/**
 * Browser-side MCP client. It never talks to the Gateway directly: every call
 * goes through our server at /api/mcp, which holds the Gateway session and tokens.
 */

export class AuthRequiredError extends Error {
  constructor(message = 'Sign in to ai/Studio to continue') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class McpToolError extends Error {
  constructor(
    readonly tool: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface Envelope<T> {
  data?: T;
  error?: { message: string; tool?: string; details?: unknown };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Studio-Request': '1', ...init.headers },
  });
  let body: Envelope<T> = {};
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    /* non-JSON error page */
  }
  if (res.status === 401) throw new AuthRequiredError(body.error?.message);
  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `Request failed (${res.status})`;
    throw new McpToolError(body.error?.tool ?? path, msg, body.error?.details);
  }
  return body.data as T;
}

/**
 * Call a Gateway MCP tool.
 * Resolves to the tool's structuredContent, else its single text block parsed
 * as JSON, else the raw text. Rejects with McpToolError when the tool reports
 * an error and AuthRequiredError when the user must sign in.
 * There is no client-side timeout: some tools (get_run) wait ~30s by design.
 */
export function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  return request<T>(`/api/mcp/tools/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify(args),
    signal: opts.signal,
  });
}

export function listTools(): Promise<ToolInfo[]> {
  return request<ToolInfo[]>('/api/mcp/tools');
}
