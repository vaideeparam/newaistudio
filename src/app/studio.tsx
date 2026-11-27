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
  /** From list_agents: draft | published (archived are left out). */
  status?: string;
  project?: string;
  updated?: string;
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
      const [me, ws, pj, ag] = await Promise.all([
        callTool<{ workspace?: string; default_project?: string }>('whoami'),
        callTool<{ workspaces?: Workspace[] }>('list_workspaces').catch(() => ({ workspaces: [] as Workspace[] })),
        callTool<{ projects?: Project[] }>('list_projects'),
        callTool<{ agents?: AgentSummary[] }>('find_agents'),
      ]);
      const projectsList = pj?.projects ?? [];
      // find_agents returns only agents people can run (published). list_agents per project adds
      // drafts, so a mind you just saved shows up, with its project and status.
      const perProject = await Promise.all(
        projectsList.map((p) =>
          callTool<{ agents?: AgentSummary[] }>('list_agents', { project: p.name })
            .then((r) => (r?.agents ?? []).map((a) => ({ ...a, project: p.name })))
            .catch(() => [] as AgentSummary[]),
        ),
      );
      const byId = new Map<string, AgentSummary>();
      for (const a of ag?.agents ?? []) byId.set(a.id, { status: 'published', ...a });
      for (const a of perProject.flat()) {
        if (a.status === 'archived') {
          byId.delete(a.id);
          continue;
        }
        byId.set(a.id, { ...byId.get(a.id), ...a, description: a.description || byId.get(a.id)?.description });
      }
      const allAgents = [...byId.values()].sort((x, y) => (y.updated ?? '').localeCompare(x.updated ?? ''));
      // The gateway's only connectors are file sources (OneDrive, SharePoint, Google Drive), per project.
      const cnList = { connectors: await connectorsFromSources(projectsList), catalog: FILE_CATALOG };
      setState({
        workspace: me?.workspace,
        defaultProject: me?.default_project ?? undefined,
        workspaces: ws?.workspaces ?? [],
        projects: pj?.projects ?? [],
        agents: allAgents,
        connectors: cnList.connectors ?? [],
        catalog: cnList.catalog ?? [],
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

const FILE_CATALOG: ConnectorType[] = [
  { type: 'sharepoint', label: 'SharePoint', group: 'Files', about: 'Sites and libraries' },
  { type: 'onedrive', label: 'OneDrive', group: 'Files', about: 'Your files' },
  { type: 'gdrive', label: 'Google Drive', group: 'Files', about: 'My Drive and shared drives' },
];

interface SourceStatus {
  microsoft?: { connected: boolean; account?: string | null };
  google?: { connected: boolean; account?: string | null };
  sources?: { name: string; type: string; files_indexed?: number }[];
}

/**
 * The live Gateway has no list of connectors: it exposes file sources per
 * project (source_status / connect_source / browse_source), so the list is
 * built from those.
 */
async function connectorsFromSources(projects: Project[]): Promise<Connector[]> {
  const all = await Promise.all(
    projects.map((p) =>
      callTool<SourceStatus>('source_status', { project: p.name })
        .then((s) => ({ p, s }))
        .catch(() => null),
    ),
  );
  const out: Connector[] = [];
  for (const r of all) {
    if (!r?.s) continue;
    const { p, s } = r;
    if (s.microsoft?.connected)
      out.push({ id: `ms-${p.id}`, type: 'sharepoint', name: `Microsoft · ${p.name}`, account: s.microsoft.account ?? undefined, status: 'connected', scope: 'project', access: 'read', projects: [p.name] });
    if (s.google?.connected)
      out.push({ id: `g-${p.id}`, type: 'gdrive', name: `Google Drive · ${p.name}`, account: s.google.account ?? undefined, status: 'connected', scope: 'project', access: 'read', projects: [p.name] });
    for (const src of s.sources ?? []) {
      out.push({
        id: `src-${p.id}-${src.name}`,
        type: src.type.startsWith('teamdocs') ? 'teamdocs' : src.type.split('_')[0] ?? src.type,
        name: src.name,
        account: `${src.type.replace(/_/g, ' ')} · ${src.files_indexed ?? 0} files`,
        status: 'connected',
        scope: 'project',
        access: 'read',
        projects: [p.name],
      });
    }
  }
  return out;
}

export function useStudio(): StudioState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudio must be used inside <StudioProvider>');
  return v;
}
