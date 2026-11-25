/**
 * Canned Studio MCP responses so the UI can be built and demoed without a live session.
 * Shapes follow what the real ai/Studio MCP returned on 2026-11-25 (whoami, list_projects,
 * find_agents, agent_details, list_schedules, recent_runs, source_status, ask_project, get_run).
 * Tools marked GUESS below have no observed shape yet (knowledge graph, governance, audit).
 */
import type { ToolOutcome } from './normalize.js';

const ok = (data: unknown): ToolOutcome => ({ isError: false, data });
const fail = (message: string): ToolOutcome => ({ isError: true, data: message });

export const mockUser = { name: 'Vaidee Sethuraman', email: 'demo@example.com' };

const workspaces = [
  { name: 'App Minds', role: 'owner', default: true, this_app_can_use: true },
  { name: 'Param Network', role: 'developer', default: false, this_app_can_use: true },
  { name: 'Customer Sandbox', role: 'viewer', default: false, this_app_can_use: false },
];

const projects = [
  { name: 'AI-Marketing', description: 'Positioning, campaigns and launch material', default: true, id: 'p-mkt' },
  { name: 'AI-aiStudio-PM', description: 'Team trackers, stand-ups and weekly reports', default: false, id: 'p-pm' },
  { name: 'PureAI', description: 'Customer engagement: contracts and specs', default: false, id: 'p-pure' },
  { name: 'Param MCP', description: 'MCP gateway design notes', default: false, id: 'p-mcp' },
];

const docCounts: Record<string, number> = { 'AI-Marketing': 49, 'AI-aiStudio-PM': 12, PureAI: 31, 'Param MCP': 0 };

const agents = [
  {
    name: 'AI-Studio-PM',
    id: 'f195e6ea',
    kind: 'chat',
    status: 'published',
    project: 'AI-aiStudio-PM',
    description:
      'AI project manager for the ai/Studio team: daily stand-up, update sweeps, end-of-day wins and weekly report. Pass job = standup | sweep | wins | weekly.',
    steps: [
      { id: 'read_trackers', type: 'mcp_tool', name: 'Read TeamDocs trackers' },
      { id: 'compose', type: 'llm_prompt', name: 'Write the update' },
      { id: 'post', type: 'mcp_tool', name: 'Post to Slack' },
    ],
  },
  {
    name: 'VV-KG: Answer from the graph',
    id: 'a1e82d9f',
    kind: 'chat',
    status: 'published',
    project: 'AI-Marketing',
    description:
      'Retrieval with no language-model call: the UKE Context Resolver walks the knowledge graph and ranks document summaries built at ingestion. One bounded model call writes the answer; code checks every citation.',
    steps: [
      { id: 'resolve', type: 'custom_python', name: 'Walk the knowledge graph' },
      { id: 'rank', type: 'custom_python', name: 'Rank document summaries' },
      { id: 'answer', type: 'llm_prompt', name: 'Write the answer' },
      { id: 'verify', type: 'custom_python', name: 'Check every citation' },
    ],
  },
  {
    name: 'VV-SC: Supply Chain Brief',
    id: '10893f3a',
    kind: 'form',
    status: 'draft',
    project: 'AI-Marketing',
    description:
      'Three steps: a seeded generator, one bounded model call, a rendered dashboard. The model writes only the narrative block, and the dashboard marks where it did.',
    inputs: [{ name: 'seed', type: 'text', required: false, description: 'Fixes the generated scenario. Default 20260913.' }],
    steps: [
      { id: 'generate_scenario', type: 'custom_python', name: 'Generate the scenario' },
      { id: 'derive_insight', type: 'llm_prompt', name: 'Read it like a COO' },
      { id: 'render_dashboard', type: 'custom_python', name: 'Render the dashboard' },
    ],
  },
  {
    name: 'P3: LeadGen Prospect Research',
    id: '9bd600fd',
    kind: 'form',
    status: 'published',
    project: 'AI-Marketing',
    description:
      'Researches one prospect from live web search rather than model recall. Every finding carries the URL that evidences it; findings without one are dropped.',
    inputs: [
      { name: 'name', type: 'text', required: true },
      { name: 'company', type: 'text', required: true },
    ],
    steps: [
      { id: 'plan', type: 'custom_python', name: 'Plan the queries' },
      { id: 'search', type: 'llm_prompt', name: 'Search the web' },
      { id: 'filter', type: 'custom_python', name: 'Drop findings without a URL' },
    ],
  },
  {
    name: 'P1: LeadGen Email Composer',
    id: 'e76458bf',
    kind: 'form',
    status: 'published',
    project: 'AI-Marketing',
    description:
      'Writes one cold outbound email for a single prospect, grounded in research. A deterministic validator rejects generic phrasing. Every draft is flagged for human review.',
    steps: [
      { id: 'compose', type: 'llm_prompt', name: 'Draft the email' },
      { id: 'validate', type: 'custom_python', name: 'Validate the draft' },
    ],
  },
];

let schedules = [
  {
    schedule: 'sch-1',
    agent: 'AI-Studio-PM',
    project: 'AI-aiStudio-PM',
    name: 'Morning stand-up',
    message: 'job = standup',
    when: 'Monday to Saturday at 09:22 (Asia/Calcutta)',
    state: 'active',
    next_run: 'Thu 26 Nov 2026, 09:22',
    last_run: 'completed (Wed 25 Nov 2026, 09:22)',
  },
  {
    schedule: 'sch-2',
    agent: 'AI-Studio-PM',
    project: 'AI-aiStudio-PM',
    name: 'Update sweeps',
    message: 'job = sweep',
    when: 'Monday to Saturday at 11:52, 14:52 and 17:52 (Asia/Calcutta)',
    state: 'active',
    next_run: 'Thu 26 Nov 2026, 11:52',
    last_run: 'completed (Wed 25 Nov 2026, 17:52)',
  },
  {
    schedule: 'sch-3',
    agent: 'AI-Studio-PM',
    project: 'AI-aiStudio-PM',
    name: 'End-of-day wins',
    message: 'job = wins',
    when: 'Monday to Saturday at 20:52 (Asia/Calcutta)',
    state: 'active',
    next_run: 'Thu 26 Nov 2026, 20:52',
    last_run: 'completed (Wed 25 Nov 2026, 20:52)',
  },
  {
    schedule: 'sch-4',
    agent: 'AI-Studio-PM',
    project: 'AI-aiStudio-PM',
    name: 'Weekly report',
    message: 'job = weekly',
    when: 'Saturdays at 17:17 (Asia/Calcutta)',
    state: 'paused',
    next_run: null,
    last_run: 'completed (Sat 21 Nov 2026, 17:17)',
  },
];

const recentRuns = [
  { run_id: 'r-5', agent: 'AI-Studio-PM', status: 'completed', summary: 'sweep, then wins', kind: 'chat', turns: 1, cost_usd: 0.05662, when: '2026-11-25T15:22:00Z' },
  { run_id: 'r-4', agent: 'AI-Studio-PM', status: 'completed', summary: 'sweep', kind: 'chat', turns: 1, cost_usd: 0.052708, when: '2026-11-25T12:22:00Z' },
  { run_id: 'r-3', agent: 'VV-KG: Answer from the graph', status: 'completed', summary: 'Which wedges did we test in Q3?', kind: 'chat', turns: 3, cost_usd: 0.0181, when: '2026-11-25T10:02:00Z' },
  { run_id: 'r-2', agent: 'AI-Studio-PM', status: 'completed', summary: 'sweep', kind: 'chat', turns: 1, cost_usd: 0.09213, when: '2026-11-25T09:22:00Z' },
  { run_id: 'r-1', agent: 'P3: LeadGen Prospect Research', status: 'failed', summary: 'Prospect: Acme Logistics', kind: 'form', turns: 1, cost_usd: 0.0112, when: '2026-11-24T16:40:00Z' },
];

const tools: { name: string; description: string; inputSchema: unknown }[] = [
  'whoami', 'list_workspaces', 'list_projects', 'ask_project', 'get_run', 'find_agents', 'agent_details',
  'agent_versions', 'run_agent', 'list_schedules', 'schedule_agent', 'control_schedule', 'recent_runs',
  'source_status', 'connect_source', 'knowledge_graph', 'governance_summary', 'audit_log',
].map((name) => ({ name, description: `Mock ${name}`, inputSchema: { type: 'object', properties: {} } }));

// ---------- knowledge graph (GUESS: no observed shape yet) ----------
const graph = {
  project: 'AI-Marketing',
  nodes: [
    { id: 'ai-studio', label: 'ai/Studio', type: 'product', docs: 31 },
    { id: 'gov', label: 'Governed runs', type: 'concept', docs: 18 },
    { id: 'kg', label: 'Knowledge graph', type: 'concept', docs: 9 },
    { id: 'mcp', label: 'MCP gateway', type: 'product', docs: 12 },
    { id: 'leadgen', label: 'LeadGen pipeline', type: 'initiative', docs: 14 },
    { id: 'pureai', label: 'PureAI', type: 'customer', docs: 6 },
    { id: 'floforward', label: 'FloForward', type: 'customer', docs: 4 },
    { id: 'q3', label: 'Q3 launch', type: 'event', docs: 7 },
    { id: 'wedges', label: 'GTM wedges', type: 'concept', docs: 5 },
    { id: 'citations', label: 'Verified citations', type: 'concept', docs: 8 },
    { id: 'divum', label: 'Divum.ai', type: 'partner', docs: 3 },
  ],
  edges: [
    ['ai-studio', 'gov', 'enforces'],
    ['ai-studio', 'kg', 'builds'],
    ['ai-studio', 'mcp', 'exposes'],
    ['kg', 'citations', 'grounds'],
    ['gov', 'citations', 'checks'],
    ['leadgen', 'wedges', 'targets'],
    ['leadgen', 'ai-studio', 'runs on'],
    ['pureai', 'ai-studio', 'uses'],
    ['floforward', 'ai-studio', 'uses'],
    ['q3', 'wedges', 'tested'],
    ['divum', 'mcp', 'integrates'],
    ['q3', 'ai-studio', 'launched'],
  ].map(([source, target, label]) => ({ source, target, label })),
};

// ---------- ask runs ----------
const runs = new Map<string, { message: string; project: string; agent?: string; conversation_id: string; startedAt: number }>();
let seq = 0;

function startRun(message: string, project: string, conversation_id: string | undefined, agent?: string) {
  const run_id = `mock-run-${++seq}`;
  const conv = conversation_id ?? `mock-conv-${seq}`;
  runs.set(run_id, { message, project, agent, conversation_id: conv, startedAt: Date.now() });
  return ok({
    status: 'running',
    run_id,
    conversation_id: conv,
    progress: agent ? `Running ${agent}` : 'Searching documents',
    steps: [{ tool: agent ? 'walk_graph' : 'search_documents', status: 'running' }],
  });
}

export function mockListTools() {
  return tools;
}

export async function mockCallTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined);
  switch (name) {
    case 'whoami':
      return ok({
        you: mockUser,
        workspace: 'App Minds',
        projects: projects.map((p) => p.name),
        project_count: projects.length,
        default_project: 'AI-Marketing',
        agents: agents.map((a) => a.name),
      });
    case 'list_workspaces':
      return ok({ workspaces });
    case 'list_projects': {
      const q = (str('search') ?? '').toLowerCase();
      return ok({
        projects: projects
          .filter((p) => p.name.toLowerCase().includes(q))
          .map((p) => ({ ...p, documents: docCounts[p.name] ?? 0 })),
      });
    }
    case 'find_agents': {
      const q = (str('search') ?? '').toLowerCase();
      const list = agents
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
        .map(({ name, description, id }) => ({ name, description, id }));
      return ok({ agents: list, count: list.length, total: agents.length, complete: true });
    }
    case 'agent_details': {
      const a = agents.find((x) => x.name === str('agent') || x.id === str('agent'));
      if (!a) return fail('No agent with that name');
      return ok({ ...a, updated: '2026-11-20T11:38:44Z', tags: a.status === 'published' ? ['v1.2'] : [] });
    }
    case 'agent_versions':
      return ok({
        agent: str('agent'),
        versions: [
          { version: 'c41f', when: '2026-11-20T11:38:44Z', who: 'Vaidee Sethuraman', message: 'Tighten citation check' },
          { version: '9a07', when: '2026-11-12T08:02:10Z', who: 'Vaidee Sethuraman', message: 'Add graph walk step' },
          { version: '51be', when: '2026-10-30T15:44:51Z', who: 'Priya R', message: 'First version' },
        ],
        tags: [{ tag: 'v1.2', version: 'c41f' }],
      });
    case 'run_agent': {
      const agent = str('agent') ?? 'agent';
      const a = agents.find((x) => x.name === agent || x.id === agent);
      return startRun(str('message') ?? JSON.stringify(args.inputs ?? {}), a?.project ?? 'AI-Marketing', str('conversation_id'), a?.name ?? agent);
    }
    case 'ask_project': {
      const message = str('message');
      if (!message) return fail('message is required');
      return startRun(message, str('project') ?? 'AI-Marketing', str('conversation_id'));
    }
    case 'get_run': {
      const run = runs.get(str('run_id') ?? '');
      if (!run) return fail('Unknown run_id');
      await new Promise((r) => setTimeout(r, 1400));
      return ok({
        run_id: args.run_id,
        conversation_id: run.conversation_id,
        project: run.project,
        agent: run.agent,
        answer:
          `Here is what the **${run.project}** documents say about "${run.message}".\n\n` +
          'ai/Studio positions every run as governed: deterministic steps do the work they can check, and the model is called only where judgment is needed [1]. ' +
          'In the Q3 launch the strongest wedge was verified citations, which buyers in regulated industries asked about first [2].\n\n' +
          '- Governed runs carry a receipt showing which steps were code and which were the model [1]\n' +
          '- The knowledge graph is built at ingestion, so retrieval needs no model call [3]',
        citations: [
          { source: '[1] positioning-v4.pdf', page: 3, quote: 'Code does what code can check; the model only enters where judgment is required.' },
          { source: '[2] q3-launch-retro.docx', page: 7, quote: 'Every enterprise call opened with: can you show me where the answer came from?' },
          { source: '[3] uke-architecture.md', quote: 'The Context Resolver walks the graph and ranks summaries written at ingestion.' },
        ],
        steps: run.agent
          ? [
              { tool: 'walk_graph', status: 'done', kind: 'code', ms: 212 },
              { tool: 'rank_summaries', status: 'done', kind: 'code', ms: 88 },
              { tool: 'answer', status: 'done', kind: 'model', ms: 2140, model: 'claude-sonnet', tokens: 1840 },
              { tool: 'verify_citations', status: 'done', kind: 'code', ms: 41 },
            ]
          : [
              { tool: 'search_documents', status: 'done', kind: 'code', ms: 340 },
              { tool: 'answer', status: 'done', kind: 'model', ms: 1980, model: 'claude-sonnet', tokens: 1620 },
            ],
        cost_usd: 0.0142,
        took_s: (Date.now() - run.startedAt) / 1000,
      });
    }
    case 'list_schedules': {
      const agent = str('agent');
      const list = agent ? schedules.filter((s) => s.agent === agent) : schedules;
      const active = list.filter((s) => s.state === 'active').length;
      return ok({ schedules: list, summary: `${list.length} schedules: ${active} active, ${list.length - active} paused` });
    }
    case 'schedule_agent': {
      const when = args.when as { kind?: string; time?: string; weekday?: string } | undefined;
      const label =
        when?.kind === 'daily'
          ? `Every day at ${when.time} (${str('timezone')})`
          : when?.kind === 'weekly'
            ? `${when.weekday ?? 'Monday'}s at ${when.time} (${str('timezone')})`
            : `${when?.kind ?? 'custom'} (${str('timezone')})`;
      if (!args.confirmed) {
        return ok({ preview: true, agent: str('agent'), when: label, next_runs: ['Thu 26 Nov 2026, 09:00', 'Fri 27 Nov 2026, 09:00', 'Sat 28 Nov 2026, 09:00'] });
      }
      const s = {
        schedule: `sch-${schedules.length + 1}`,
        agent: str('agent') ?? '',
        project: str('project') ?? 'AI-Marketing',
        name: str('name') ?? str('message') ?? 'New routine',
        message: str('message') ?? '',
        when: label,
        state: 'active',
        next_run: 'Thu 26 Nov 2026, 09:00',
        last_run: '',
      };
      schedules = [...schedules, s];
      return ok({ created: true, ...s });
    }
    case 'control_schedule': {
      const s = schedules.find((x) => x.schedule === str('schedule'));
      if (!s) return fail('Unknown schedule');
      if (!args.confirmed) return ok({ preview: true, action: args.action, schedule: s.schedule });
      if (args.action === 'pause') s.state = 'paused';
      if (args.action === 'resume') s.state = 'active';
      return ok({ done: true, schedule: s });
    }
    case 'recent_runs': {
      const agent = str('agent');
      return ok({ runs: recentRuns.filter((r) => !agent || r.agent === agent) });
    }
    case 'source_status': {
      const project = str('project') ?? 'AI-Marketing';
      return ok({
        project,
        microsoft: { connected: project === 'PureAI', account: project === 'PureAI' ? 'sharepoint · pureai.sharepoint.com' : null },
        google: { connected: false, account: null },
        sources:
          (docCounts[project] ?? 0) > 0
            ? [{ name: project.toLowerCase(), type: project === 'PureAI' ? 'sharepoint_folder' : 'teamdocs_folder', files_indexed: docCounts[project], last_sync: '2026-11-21T02:00:10Z', last_status: 'success' }]
            : [],
      });
    }
    case 'connect_source':
      return ok({ link: 'https://example.invalid/connect', note: 'Mock: sign-in link would open here.' });
    case 'knowledge_graph':
      return ok(graph);
    case 'governance_summary': // GUESS
      return ok({
        workspace: 'App Minds',
        isolation: 'Each workspace has its own vector store, graph and run history. Nothing is shared across workspaces unless a project is explicitly shared.',
        residency: 'ap-south-1 (Mumbai)',
        models: [
          { name: 'claude-sonnet', provider: 'Anthropic via Bedrock', allowed: true, retention: 'zero retention' },
          { name: 'gpt-4.1', provider: 'Azure OpenAI', allowed: false, retention: '—' },
        ],
        members: [
          { name: 'Vaidee Sethuraman', role: 'owner' },
          { name: 'Priya R', role: 'developer' },
          { name: 'Ops team (12)', role: 'user' },
        ],
        shared_projects: [{ project: 'PureAI', with: 'PureAI (customer workspace)', access: 'read, cited answers only' }],
        policies: ['Every answer must cite a source', 'PII redacted before model calls', 'Human review before outbound email'],
      });
    case 'audit_log': // GUESS
      return ok({
        events: [
          { when: '2026-11-25T15:22:00Z', who: 'Routine · Update sweeps', what: 'Ran AI-Studio-PM', scope: 'AI-aiStudio-PM', model_calls: 1, cost_usd: 0.0566 },
          { when: '2026-11-25T10:02:00Z', who: 'Vaidee Sethuraman', what: 'Asked VV-KG: Answer from the graph', scope: 'AI-Marketing', model_calls: 1, cost_usd: 0.0181 },
          { when: '2026-11-24T16:40:00Z', who: 'Priya R', what: 'Published P3: LeadGen Prospect Research v1.2', scope: 'AI-Marketing', model_calls: 0, cost_usd: 0 },
          { when: '2026-11-24T09:12:00Z', who: 'Vaidee Sethuraman', what: 'Shared PureAI with customer workspace (read only)', scope: 'PureAI', model_calls: 0, cost_usd: 0 },
        ],
      });
    default:
      return fail(`Mock mode has no data for tool "${name}"`);
  }
}
