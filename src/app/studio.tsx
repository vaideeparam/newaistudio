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
  const [state, setState] = useState<Omit<StudioState, 'reload'>>({ workspaces: [], projects: [], agents: [], loading: true });

  const reload = useCallback(async () => {
    try {
      const [me, ws, pj, ag] = await Promise.all([
        callTool<{ workspace?: string; default_project?: string }>('whoami'),
        callTool<{ workspaces?: Workspace[] }>('list_workspaces').catch(() => ({ workspaces: [] as Workspace[] })),
        callTool<{ projects?: Project[] }>('list_projects'),
        callTool<{ agents?: AgentSummary[] }>('find_agents'),
      ]);
      setState({
        workspace: me?.workspace,
        defaultProject: me?.default_project ?? undefined,
        workspaces: ws?.workspaces ?? [],
        projects: pj?.projects ?? [],
        agents: dedupe(ag?.agents ?? []),
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
