/**
 * Canned Gateway responses so the UI can be built without a live Gateway.
 * Shapes follow what the real Gateway MCP returned on 2026-11-25; values are made up.
 */
import type { ToolOutcome } from './normalize.js';

const projects = [
  { name: 'Demo Finance', description: 'Quarterly reports and policies', default: true, id: 'mock-proj-1' },
  { name: 'Demo Marketing', description: 'Campaign briefs', default: false, id: 'mock-proj-2' },
];

const tools: { name: string; description: string; inputSchema: unknown }[] = [
  { name: 'whoami', description: 'Your account, workspace, projects and agents.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_workspaces', description: 'The Studio workspaces you belong to.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'list_projects',
    description: 'Projects you can use, optionally filtered by a search word.',
    inputSchema: { type: 'object', properties: { search: { type: 'string' } } },
  },
  {
    name: 'ask_project',
    description: "Answer a question from a project's documents, with sources.",
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        project: { type: 'string' },
        conversation_id: { type: 'string' },
        new_conversation: { type: 'boolean' },
      },
      required: ['message'],
    },
  },
  {
    name: 'use_workspace',
    description: 'Make one of your workspaces the default.',
    inputSchema: { type: 'object', properties: { workspace: { type: 'string' } }, required: ['workspace'] },
  },
  {
    name: 'use_project',
    description: 'Make a project your default.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] },
  },
  {
    name: 'get_run',
    description: "The answer of a run that returned 'running'.",
    inputSchema: { type: 'object', properties: { run_id: { type: 'string' } }, required: ['run_id'] },
  },
];

const runs = new Map<string, { message: string; project: string; conversation_id: string; startedAt: number }>();
let seq = 0;

const ok = (data: unknown): ToolOutcome => ({ isError: false, data });
const fail = (message: string): ToolOutcome => ({ isError: true, data: message });

export const mockUser = { name: 'Demo User', email: 'demo@example.com' };

export function mockListTools() {
  return tools;
}

export async function mockCallTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  switch (name) {
    case 'whoami':
      return ok({
        you: mockUser,
        workspace: 'Demo Workspace',
        projects: projects.map((p) => p.name),
        project_count: projects.length,
        default_project: 'Demo Finance',
        agents: ['Demo: Research Assistant', 'Demo: Report Writer'],
        agent_count: 2,
      });
    case 'list_workspaces':
      return ok({
        workspaces: [
          { name: 'Demo Workspace', role: 'owner', default: true, this_app_can_use: true },
          { name: 'Other Workspace', role: 'developer', default: false, this_app_can_use: false },
        ],
      });
    case 'list_projects': {
      const q = typeof args.search === 'string' ? args.search.toLowerCase() : '';
      return ok({ projects: projects.filter((p) => p.name.toLowerCase().includes(q)) });
    }
    case 'ask_project': {
      if (typeof args.message !== 'string' || !args.message) return fail('message is required');
      const run_id = `mock-run-${++seq}`;
      const conversation_id = typeof args.conversation_id === 'string' ? args.conversation_id : `mock-conv-${seq}`;
      const project = typeof args.project === 'string' ? args.project : 'Demo Finance';
      runs.set(run_id, { message: args.message, project, conversation_id, startedAt: Date.now() });
      return ok({
        status: 'running',
        run_id,
        conversation_id,
        progress: 'Searching documents',
        steps: [{ tool: 'search_documents', status: 'running' }],
      });
    }
    case 'get_run': {
      const run = typeof args.run_id === 'string' ? runs.get(args.run_id) : undefined;
      if (!run) return fail('Unknown run_id');
      await new Promise((r) => setTimeout(r, 1500));
      return ok({
        run_id: args.run_id,
        conversation_id: run.conversation_id,
        project: run.project,
        answer: `This is a mock answer to "${run.message}". Revenue grew 12% year on year [1], driven mainly by the services line [2].`,
        citations: [
          { source: '[1] Q3-report.pdf', page: 4, quote: 'Total revenue increased 12% compared with Q3 last year.' },
          { source: '[2] board-deck.pptx', page: 11, quote: 'Services contributed the majority of growth.' },
        ],
        steps: [
          { tool: 'search_documents', status: 'done' },
          { tool: 'answer', status: 'done' },
        ],
        took_s: (Date.now() - run.startedAt) / 1000,
      });
    }
    case 'use_workspace': {
      if (args.workspace !== 'Demo Workspace') return fail('This app cannot use that workspace');
      return ok({ workspace: 'Demo Workspace', default: true });
    }
    case 'use_project': {
      const p = projects.find((x) => x.name === args.project || x.id === args.project);
      if (!p) return fail('Unknown project');
      return ok({ default_project: p.name, id: p.id });
    }
    default:
      return fail(`Mock mode has no data for tool "${name}"`);
  }
}
