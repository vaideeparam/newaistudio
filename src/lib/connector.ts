/**
 * Live data for the published preview page.
 *
 * The preview has no server, so it cannot hold a token. Instead it asks the
 * claude.ai viewer to call the viewer's own "Param ai/Studio Gateway MCP"
 * connector. Calls run with the viewer's credentials and the page never sees
 * a token. When the page is opened anywhere else, or the viewer declines,
 * everything falls back to the built-in sample data.
 */

/** Display name of the connector in claude.ai, exactly as Settings › Connectors shows it. */
export const CONNECTOR = import.meta.env.VITE_STUDIO_CONNECTOR ?? 'Param ai/Studio Gateway MCP';

/** True when the page runs inside a claude.ai viewer (live data is possible). */
export const inViewer = () => Boolean((window as unknown as ClaudeWindow).claude?.use);

/** Gateway tools the preview may call live. Must match the published manifest. */
export const LIVE_TOOLS = [
  'whoami',
  'list_workspaces',
  'list_projects',
  'find_agents',
  'agent_details',
  'agent_versions',
  'ask_project',
  'run_agent',
  'get_run',
  'list_schedules',
  'recent_runs',
  'source_status',
  'search_documents',
  'design_agent',
  'get_design',
  'save_agent',
  'publish_agent',
  'tag_agent_version',
  'list_agents',
  'cancel_run',
  'answer_agent_question',
  'resume_run',
  'schedule_agent',
  'control_schedule',
] as const;

/** Screens whose backend tool doesn't exist yet: they keep sample data, labelled as such. */
export const SAMPLE_ONLY = new Set(['knowledge_graph', 'governance_summary', 'audit_log', 'resolve_context']);

interface McpError {
  code: string;
  message: string;
  retryable?: boolean;
}
interface McpNamespace {
  callTool(server: string, tool: string, input?: unknown, opts?: unknown): Promise<{ payload?: unknown; content?: unknown }>;
}
interface ClaudeWindow {
  claude?: { use(name: string): Promise<unknown> };
}

let ns: Promise<McpNamespace | null> | null = null;

/** The viewer's MCP bridge, or null outside a claude.ai viewer. */
export function bridge(): Promise<McpNamespace | null> {
  if (!ns) {
    const c = (window as unknown as ClaudeWindow).claude;
    ns = c?.use ? (c.use('mcp') as Promise<McpNamespace | null>).catch(() => null) : Promise.resolve(null);
  }
  return ns;
}

/** Plain-language reason for a connector failure, keyed by the runtime's error code. */
export function explain(e: unknown): string {
  const err = e as Partial<McpError>;
  switch (err.code) {
    case 'needs_reauth':
      return `Your ai/Studio connector needs to sign in again: reconnect "${CONNECTOR}" in claude.ai Settings, Connectors.`;
    case 'server_not_connected':
      return `Add the "${CONNECTOR}" connector in claude.ai Settings, Connectors, to see your own data here.`;
    case 'not_in_manifest':
    case 'approval_required':
    case 'consent_required':
      return 'This page needs your OK to use your ai/Studio connector. Allow it from the page’s Permissions menu.';
    case 'selection_required':
      return 'Choose which ai/Studio connector this page should use.';
    case 'server_unavailable':
      return 'ai/Studio did not answer in time. Try again in a moment.';
    case 'tool_error':
      return err.message ?? 'ai/Studio reported an error.';
    case 'unavailable':
      return err.message ?? 'Live data is only available inside claude.ai.';
    default:
      return `${err.message ?? 'The ai/Studio connector failed.'}${err.code ? ` (${err.code})` : ''}`;
  }
}

export class ConnectorError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

/** Call one Gateway tool through the viewer's connector and return its JSON payload. */
export async function liveCall<T>(tool: string, args: Record<string, unknown>): Promise<T> {
  const mcp = await bridge();
  if (!mcp) throw new ConnectorError('unavailable', 'This view did not grant the page access to your connectors. Open the page in claude.ai and allow ai/Studio from its Permissions menu.');
  try {
    const r = await mcp.callTool(CONNECTOR, tool, args);
    return r.payload as T;
  } catch (e) {
    throw new ConnectorError((e as McpError).code ?? 'upstream_error', explain(e));
  }
}
