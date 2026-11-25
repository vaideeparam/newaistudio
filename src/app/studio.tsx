import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { callTool } from '../lib/mcp';

export interface Project {
  id: string;
  name: string;
  description?: string;
  default?: boolean;
  documents?: number;
}
export interface AgentSummary {
  id: string;
  name: string;
  description?: string;
}
/** A connection someone already set up: a named instance of a connector type. GUESS: shape not seen live. */
export interface Connector {
  id: string;
  type: string;
  name: string;
  account?: string;
  status: 'connected' | 'needs_auth' | 'error' | string;
  scope?: 'workspace' | 'project' | 'personal' | string;
  access?: 'read' | 'read_write' | string;
  tools?: number;
  projects?: string[];
}
export interface ConnectorType {
  type: string;
  label: string;
  group: string;
  about?: string;
}
export interface Workspace {
  name: string;
  role?: string;
  default?: boolean;
  this_app_can_use?: boolean;
}

interface StudioState {
  workspace?: string;
  workspaces: Workspace[];
  projects: Project[];
  agents: AgentSummary[];
  connectors: Connector[];
  catalog: ConnectorType[];
  defaultProject?: string;
  loading: boolean;
  error?: string;
  reload: () => Promise<void>;
}

const Ctx = createContext<StudioState | null>(null);

/**
 * What the signed-in person can reach, loaded once for the whole window so
 * every surface (composer, sidebar, routines) can pick a project or agent
 * without a global workspace/project switch.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<StudioState, 'reload'>>({ workspaces: [], projects: [], agents: [], connectors: [], catalog: [], loading: true });

  const reload = useCallback(async () => {
    try {
      const [me, ws, pj, ag, cn] = await Promise.all([
        callTool<{ workspace?: string; default_project?: string }>('whoami'),
        callTool<{ workspaces?: Workspace[] }>('list_workspaces').catch(() => ({ workspaces: [] as Workspace[] })),
        callTool<{ projects?: Project[] }>('list_projects'),
        callTool<{ agents?: AgentSummary[] }>('find_agents'),
        callTool<{ connectors?: Connector[]; catalog?: ConnectorType[] }>('list_connectors').catch(() => ({ connectors: [], catalog: [] })),
      ]);
      setState({
        workspace: me?.workspace,
        defaultProject: me?.default_project ?? undefined,
        workspaces: ws?.workspaces ?? [],
        projects: pj?.projects ?? [],
        agents: dedupe(ag?.agents ?? []),
        connectors: cn?.connectors ?? [],
        catalog: cn?.catalog ?? [],
        loading: false,
      });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}

function dedupe(list: AgentSummary[]): AgentSummary[] {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

export function useStudio(): StudioState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudio must be used inside <StudioProvider>');
  return v;
}
