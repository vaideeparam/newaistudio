import { callTool } from '../../lib/mcp';
import { normalizeCitations } from './citations';
import type { Answer, AskResponse, Project, Step, Workspace } from './types';

export async function listWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  const r = await callTool<{ workspaces?: Workspace[] }>('list_workspaces', {}, { signal });
  return r?.workspaces ?? [];
}

/**
 * GUESS: the Gateway has no per-call workspace argument, so we switch the
 * account's default workspace and then list its projects. This changes the
 * default for the person's other Studio clients too.
 */
export async function selectWorkspace(name: string, signal?: AbortSignal): Promise<void> {
  await callTool('use_workspace', { workspace: name }, { signal });
}

export async function listProjects(signal?: AbortSignal): Promise<Project[]> {
  const r = await callTool<{ projects?: Project[] }>('list_projects', {}, { signal });
  return r?.projects ?? [];
}

export interface AskOptions {
  project: string;
  conversationId?: string;
  newConversation?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: { progress?: string; steps?: Step[] }) => void;
}

/** Safety net so a stuck run cannot spin forever. get_run itself waits server-side. */
const MAX_POLLS = 40;

export async function askProject(message: string, opts: AskOptions): Promise<Answer> {
  let r = await callTool<AskResponse>(
    'ask_project',
    {
      message,
      project: opts.project,
      ...(opts.conversationId && !opts.newConversation ? { conversation_id: opts.conversationId } : {}),
      ...(opts.newConversation ? { new_conversation: true } : {}),
    },
    { signal: opts.signal },
  );

  let polls = 0;
  while (r?.status === 'running' && r.run_id) {
    opts.onProgress?.({ progress: r.progress, steps: r.steps });
    if (++polls > MAX_POLLS) throw new Error('Studio is still working on this. Try asking again in a minute.');
    r = await callTool<AskResponse>('get_run', { run_id: r.run_id }, { signal: opts.signal });
  }
  opts.onProgress?.({ steps: r?.steps });

  return {
    text: r?.answer?.trim() ?? '',
    citations: normalizeCitations(r?.citations),
    conversationId: r?.conversation_id,
    tookS: r?.took_s,
    project: r?.project,
  };
}
