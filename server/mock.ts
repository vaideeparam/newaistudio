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
    kind: 'form',
    status: 'published',
    project: 'AI-Marketing',
    inputs: [{ name: 'question', type: 'text', required: true, description: 'A question about the documents in the workspace.' }],
    description:
      'Retrieval with no language-model call: the UKE Context Resolver walks the knowledge graph and ranks document summaries built at ingestion. One bounded model call writes the answer; code checks every citation.',
    steps: [
      { id: 'resolve_context', type: 'uke_context_resolver', name: 'Resolve context from the graph' },
      { id: 'pack_sources', type: 'custom_python', name: 'Number the sources' },
      { id: 'write_answer', type: 'llm_prompt', name: 'Write the answer' },
      { id: 'check_citations', type: 'custom_python', name: 'Check every citation' },
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
    // Live shape, 2026-11-27.
    inputs: [
      { name: 'prospect', type: 'json', required: true, description: 'The prospect record: name, title, company, domain, seniority, location, email.' },
      { name: 'research', type: 'json', required: false, description: 'Research findings for this prospect. Thin or absent research is acceptable; the email is written shorter rather than invented.' },
      { name: 'product_profile', type: 'json', required: true, description: 'What is being sold: description, target_audience, value_props, use_cases. Company-context or offering-level.' },
      { name: 'seller_position', type: 'text', required: false, description: 'Who is writing and from where: company age, base, certifications held vs in progress, US presence. Never guessed — absent means the email simply does not mention it.' },
      { name: 'proof_points', type: 'text', required: false, description: 'JSON list of [{customer, what}] this offering may cite. Absent means describe the capability and name nobody.' },
      { name: 'campaign', type: 'text', required: false, description: 'The campaign this prospect was selected under: {title, trigger, messaging_angle}.' },
      { name: 'evidence', type: 'text', required: false, description: 'The dated, sourced fact that put this company on the list: {fact, source_url, why_now, suggested_opening, caveat}.' },
      { name: 'do_not_quote', type: 'text', required: false, description: 'Claims the audit reviewed and refused to stand behind. JSON list of strings.' },
      { name: 'previous_emails', type: 'text', required: false, description: 'JSON list of emails already sent to this prospect, oldest first: [{touch, sent, subject, body}]. Empty list means first contact.' },
    ],
    steps: [
      { id: 'pack_context', type: 'custom_python', name: 'Pack prospect + research context' },
      { id: 'write_email', type: 'llm_prompt', name: 'Write the email' },
      { id: 'validate_email', type: 'custom_python', name: 'Validate and gate the draft' },
    ],
  },
  {
    name: 'ML Explainer Agent',
    id: 'e3651acd',
    kind: 'chat',
    status: 'draft',
    project: 'AI-Marketing',
    description: "A conversational AI agent that explains machine learning concepts in plain language, adapting its depth to the user's background.",
    inputs: [{ name: 'message', type: 'text', required: true, description: "The user's chat message for this turn. Supplied automatically by the chat runtime — callers do not pass it." }],
    steps: [{ id: 'ml_explainer', type: 'orchestrator', name: 'ML Explainer' }],
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
  'agent_versions', 'list_agents', 'run_agent', 'list_schedules', 'schedule_agent', 'control_schedule', 'recent_runs',
  'source_status', 'show_artefact', 'connect_source', 'design_agent', 'get_design', 'save_agent', 'list_connectors', 'resolve_context', 'knowledge_graph', 'governance_summary', 'audit_log',
].map((name) => ({ name, description: `Mock ${name}`, inputSchema: { type: 'object', properties: {} } }));

// ---------- knowledge graph (GUESS: no observed shape yet) ----------
const graph = {
  project: 'AI-Marketing',
  nodes: [
    { id: 'doc', label: 'Positioning v4', type: 'document', docs: 1 },
    { id: 's1', label: '01 Why governed runs', type: 'section' },
    { id: 's2', label: '02 Q3 launch retro', type: 'section' },
    { id: 's3', label: '03 Architecture', type: 'section' },
    { id: 's4', label: '04 Pricing', type: 'section' },
    { id: 's5', label: '05 Customer proof', type: 'section' },
    { id: 'e1', label: 'ai/Studio', type: 'entity' },
    { id: 'e2', label: 'Context Resolver', type: 'entity' },
    { id: 'e3', label: 'Verified citations', type: 'entity' },
    { id: 'e4', label: 'MCP gateway', type: 'entity' },
    { id: 'e5', label: 'LeadGen pipeline', type: 'entity' },
    { id: 'e6', label: 'Regulated buyers', type: 'entity' },
    { id: 'e7', label: 'EU AI Act', type: 'entity' },
    { id: 't1', label: 'Governance', type: 'topic' },
    { id: 't2', label: 'Go-to-market', type: 'topic' },
    { id: 't3', label: 'Retrieval', type: 'topic' },
  ],
  edges: [
    ['doc', 's1', 'has section'], ['doc', 's2', 'has section'], ['doc', 's3', 'has section'], ['doc', 's4', 'has section'], ['doc', 's5', 'has section'],
    ['e1', 's1', 'mentioned in'], ['e1', 's3', 'mentioned in'], ['e2', 's3', 'mentioned in'], ['e3', 's1', 'mentioned in'], ['e3', 's2', 'mentioned in'],
    ['e4', 's3', 'mentioned in'], ['e5', 's2', 'mentioned in'], ['e6', 's2', 'mentioned in'], ['e6', 's5', 'mentioned in'], ['e7', 's1', 'mentioned in'],
    ['s1', 't1', 'has topic'], ['s2', 't2', 'has topic'], ['s3', 't3', 'has topic'], ['s4', 't2', 'has topic'], ['s5', 't2', 'has topic'],
    ['e2', 'e3', 'enables'], ['e1', 'e4', 'exposes'],
  ].map(([source, target, label]) => ({ source, target, label })),
};

/** GUESS: mirrors the Resolver tab in Studio's KG page (document context + entities matched). */
function resolve(query: string) {
  const q = query.toLowerCase();
  const pick = (ids: string[]) => graph.nodes.filter((n) => ids.includes(n.id));
  const gov = /govern|audit|complian|regul|risk|act/.test(q);
  const ids = gov ? ['e3', 'e6', 'e7', 't1', 's1', 's2'] : ['e1', 'e2', 'e4', 't3', 's3'];
  return {
    query,
    model_calls: 0,
    timing_ms: 184,
    token_count: 2310,
    document_context: gov
      ? [
          { document_name: 'Positioning v4', heading: '01 Why governed runs', score: 0.5248, summary: 'Code does what code can check; the model only enters where judgment is required. Every run carries a receipt.' },
          { document_name: 'Positioning v4', heading: '02 Q3 launch retro', score: 0.5216, summary: 'Every enterprise call opened with: can you show me where the answer came from? Regulated buyers asked first.' },
          { document_name: 'Positioning v4', heading: '05 Customer proof', score: 0.4976, summary: 'Two regulated customers moved from pilot to production after citation checks were shown in the run receipt.' },
        ]
      : [
          { document_name: 'Positioning v4', heading: '03 Architecture', score: 0.5611, summary: 'The Context Resolver walks the graph and ranks summaries written at ingestion; no model call is made during retrieval.' },
          { document_name: 'Positioning v4', heading: '01 Why governed runs', score: 0.4402, summary: 'ai/Studio exposes every agent through the MCP gateway, so any client can run it with the same governance.' },
        ],
    entities_matched: pick(ids)
      .filter((n) => n.type === 'entity' || n.type === 'topic')
      .map((n, i) => ({ id: n.id, name: n.label, source: i % 3 === 2 ? 'embedding' : 'document_kg', confidence: i % 3 === 2 ? 0.47 : 0.9 - i * 0.05 })),
    highlight: ids,
  };
}

// ---------- agent definitions (shape observed live via agent_details include_definition, 2026-11-25) ----------
type Step = { id: string; type: string; name: string };
function definitionFor(a: { name: string; description: string; steps: Step[]; inputs?: { name: string; type: string; required?: boolean; description?: string }[] }) {
  const kg = a.name.startsWith('VV-KG');
  const steps = a.steps.map((st, i) => {
    const prev = a.steps[i - 1];
    const model = st.type === 'llm_prompt';
    return {
      id: st.id,
      operator: kg && i === 0 ? 'uke_context_resolver' : st.type,
      name: st.name,
      description: model
        ? 'The only model call. It sees the numbered sources and nothing else, and its output is capped.'
        : kg && i === 0
          ? 'Entity recognition, a two-hop graph walk and a ranked read of document summaries. No language model is called here.'
          : 'Deterministic step. No model.',
      config: model
        ? {
            model: 'gpt-5.6-luna',
            temperature: 1,
            max_tokens: 1500,
            reasoning_effort: 'low',
            timeout_seconds: 120,
            web_search: false,
            system_prompt:
              'You answer questions about documents using only the numbered sources you are given. EMIT JSON ONLY.\n\nRules:\n- Use only the sources.\n- Cite the source id for every claim. Never cite an id that was not given to you.\n- British spelling. No marketing adjectives.',
          }
        : kg && i === 0
          ? { token_budget: 4000, n_hops: 2, max_entities: 20, max_community_summaries: 5, timeout_seconds: 60 }
          : { timeout_seconds: 30, code: '# Check every citation against the sources the model was actually given.\n# No model here either.\nimport json, re\n\nknown = {s["id"]: s for s in packed["sources"]}\ncited = re.findall(r"\\[(S\\d+)\\]", answer)\nfailed = [c for c in cited if c not in known]\nresult = {"answer": answer, "citation_check": {"checked": len(cited), "failed": len(failed)}}\n' },
      input_bindings: prev
        ? [{ param: model ? 'prompt' : 'input', source: { type: 'step_output', step_id: prev.id, path: model ? 'result.prompt' : 'result' } }]
        : [{ param: 'query', source: { type: 'mind_input', ref: a.inputs?.[0]?.name ?? 'message' } }],
      on_error: 'fail',
      position: { x: 80 + i * 300, y: 100 },
    };
  });
  return {
    name: a.name,
    version: '1.0.1',
    description: a.description,
    interface: {
      inputs: a.inputs ?? [{ name: 'message', type: 'text', required: true, description: 'What the agent is asked.' }],
      outputs: [{ name: 'response', type: 'json', description: kg ? '{question, answer, citations[], citation_check{checked,failed}, context_stats}' : 'The result' }],
    },
    governance: {
      audit_level: 'standard',
      pii_handling: kg ? 'none' : 'redact',
      allowed_models: null,
      blocked_models: null,
      human_approval: a.name.includes('Email') ? 'before_send' : 'none',
      guardrail_names: a.name.includes('Email') ? ['no-generic-outbound'] : [],
      approval_threshold_usd: null,
    },
    guarantees: { max_cost_usd: 0.1, max_latency_ms: 180000, timeout_ms: 180000, max_retries: 1, idempotent: false, deterministic_output_schema: true },
    runtime_hints: { preferred_models: ['gpt-5.6-luna'] },
    chain_of_thought: {
      steps,
      connections: a.steps.slice(1).map((st, i) => ({ from_step: a.steps[i]!.id, to_step: st.id })),
      control_nodes: [],
    },
    cluster_id: 'divum-edge',
  };
}

// ---------- connectors (GUESS: tool name and shape not seen on the MCP yet) ----------
const connectors = [
  { id: 'cn-gmail-sales', type: 'gmail', name: 'Sales inbox', account: 'sales@ mailbox', status: 'connected', scope: 'workspace', access: 'read', tools: 6, projects: ['AI-Marketing'] },
  { id: 'cn-slack-pm', type: 'slack', name: 'ai/Studio Slack', account: '#ai-aistudio-pm, #ai-aistudio-pm-followup', status: 'connected', scope: 'workspace', access: 'read_write', tools: 9, projects: ['AI-aiStudio-PM'] },
  { id: 'cn-teamdocs', type: 'mcp', name: 'TeamDocs MCP', account: 'ai-studio › ai-pm-corner', status: 'connected', scope: 'workspace', access: 'read_write', tools: 24, projects: ['AI-aiStudio-PM'] },
  { id: 'cn-pg-orders', type: 'postgresql', name: 'Orders DB', account: 'orders-replica · read replica', status: 'connected', scope: 'project', access: 'read', tools: 3, projects: ['PureAI'] },
  { id: 'cn-turso', type: 'sql', name: 'Campaign workspace', account: 'Turso · leadgen', status: 'connected', scope: 'project', access: 'read_write', tools: 4, projects: ['AI-Marketing'] },
  { id: 'cn-mongo', type: 'mongodb', name: 'Events store', account: 'events cluster', status: 'needs_auth', scope: 'project', access: 'read', tools: 3, projects: ['PureAI'] },
  { id: 'cn-sharepoint', type: 'sharepoint', name: 'PureAI SharePoint', account: 'pureai.sharepoint.com', status: 'connected', scope: 'project', access: 'read', tools: 4, projects: ['PureAI'] },
];
const connectorCatalog = [
  { type: 'gmail', label: 'Gmail', group: 'Apps', about: 'Read and draft email' },
  { type: 'outlook', label: 'Outlook', group: 'Apps', about: 'Mail and calendar' },
  { type: 'slack', label: 'Slack', group: 'Apps', about: 'Channels, threads and posting' },
  { type: 'teams', label: 'Microsoft Teams', group: 'Apps', about: 'Chats and channels' },
  { type: 'sharepoint', label: 'SharePoint', group: 'Files', about: 'Sites and libraries' },
  { type: 'onedrive', label: 'OneDrive', group: 'Files', about: 'Your files' },
  { type: 'gdrive', label: 'Google Drive', group: 'Files', about: 'My Drive and shared drives' },
  { type: 'postgresql', label: 'PostgreSQL', group: 'Data', about: 'Query tables, read-only by default' },
  { type: 'mysql', label: 'MySQL', group: 'Data', about: 'Query tables' },
  { type: 'sql', label: 'SQL Server / Turso', group: 'Data', about: 'Any SQL database' },
  { type: 'mongodb', label: 'MongoDB', group: 'Data', about: 'Collections and aggregations' },
  { type: 'rest', label: 'REST API', group: 'Custom', about: 'Any HTTP API with an OpenAPI spec' },
  { type: 'mcp', label: 'MCP server', group: 'Custom', about: 'Any remote MCP server by URL' },
];

// ---------- agent designer (GUESS: get_design shape not observed yet) ----------
const designs = new Map<string, { request: string; stage: 'plan' | 'questions' | 'design'; approved?: boolean; answers?: Record<string, unknown> }>();

function designView(id: string) {
  const d = designs.get(id)!;
  if (d.stage === 'plan') {
    return {
      design_id: id,
      status: 'waiting',
      waiting_on: 'plan',
      plan: [
        'Read the new documents added to the project since the last run (code)',
        'Pull out decisions, risks and dates from each one (model, one call per document)',
        'Check each item against its source passage (code)',
        'Write a one-page brief with numbered sources (model)',
      ],
      summary: 'Here is my plan: four steps, two of them checked by code.',
    };
  }
  if (d.stage === 'questions') {
    return {
      design_id: id,
      status: 'waiting',
      waiting_on: 'questions',
      questions: [
        { question: 'Who reads the brief?', options: ['Leadership', 'The project team', 'A customer'] },
        { question: 'How long should it be?', options: ['A few bullets', 'One page', 'Detailed'] },
      ],
    };
  }
  return {
    design_id: id,
    status: 'ready',
    name: 'Daily Document Brief',
    inputs: [{ name: 'since', type: 'date', required: false, description: 'Only documents added after this date. Default: last run.' }],
    steps: [
      { id: 'collect_new_docs', type: 'custom_python', name: 'Collect new documents' },
      { id: 'extract_items', type: 'llm_prompt', name: 'Extract decisions, risks and dates' },
      { id: 'verify_items', type: 'custom_python', name: 'Check every item against its source' },
      { id: 'write_brief', type: 'llm_prompt', name: `Write the brief for ${String(d.answers?.['Who reads the brief?'] ?? 'the team').toLowerCase()}` },
    ],
    changes: ['New agent'],
  };
}

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
      // Like the gateway: only agents people can run (published).
      const list = agents
        .filter((a) => a.status === 'published')
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
        .map(({ name, description, id }) => ({ name, description, id }));
      return ok({ agents: list, count: list.length, total: list.length, complete: true });
    }
    case 'list_agents': {
      const project = str('project');
      const list = agents
        .filter((a) => !project || a.project === project)
        .map(({ name, description, id, status, project: p }) => ({ name, description, id, status, project: p, version: 'c41f', updated: '2026-11-26T18:51:45Z' }));
      return ok({ agents: list });
    }
    case 'agent_details': {
      const a = agents.find((x) => x.name === str('agent') || x.id === str('agent'));
      if (!a) return fail('No agent with that name');
      return ok({
        ...a,
        how_it_runs: a.kind === 'chat' ? 'chat' : 'inputs',
        updated: '2026-11-20T11:38:44Z',
        tags: a.status === 'published' ? ['v1.2'] : [],
        ...(args.include_definition ? { definition: definitionFor(a) } : {}),
      });
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
    case 'list_connectors':
      return ok({ connectors, catalog: connectorCatalog });
    case 'design_agent': {
      const id = str('design_id') ?? `design-${++seq}`;
      if (!designs.has(id)) designs.set(id, { request: str('request') ?? 'helps the team', stage: 'plan' });
      const d = designs.get(id)!;
      if (args.approve_plan) d.stage = 'questions';
      else if (args.answers) {
        d.answers = args.answers as Record<string, unknown>;
        d.stage = 'design';
      } else if (str('request') && d.stage === 'design') d.request += '; ' + str('request');
      return ok({ design_id: id, status: 'running', progress: 'The designer is working' });
    }
    case 'get_design': {
      const id = str('design_id') ?? '';
      if (!designs.has(id)) return fail('Unknown design_id');
      await new Promise((r) => setTimeout(r, 1200));
      return ok(designView(id));
    }
    case 'save_agent':
      return ok({ saved: true, name: str('name') ?? 'Daily Document Brief', tag: str('tag'), status: 'draft' });
    case 'run_agent': {
      const agent = str('agent') ?? 'agent';
      const a = agents.find((x) => x.name === agent || x.id === agent);
      return startRun(str('message') ?? String(Object.values((args.inputs as Record<string, unknown>) ?? {})[0] ?? ''), a?.project ?? 'AI-Marketing', str('conversation_id'), a?.name ?? agent);
    }
    case 'ask_project': {
      const message = str('message');
      if (!message) return fail('message is required');
      return startRun(message, str('project') ?? 'AI-Marketing', str('conversation_id'));
    }
    case 'get_run': {
      const past = recentRuns.find((r) => r.run_id === str('run_id'));
      // Like the gateway: older chat sessions can't be reopened.
      if (past?.run_id === 'r-5') return fail("⚠️ That item doesn't exist, or you can't open it. (Session not found)");
      if (past && !runs.has(past.run_id)) {
        const a = agents.find((x) => x.name === past.agent);
        runs.set(past.run_id, { message: past.summary, project: a?.project ?? 'AI-Marketing', agent: past.agent, conversation_id: past.run_id, startedAt: Date.now() - 4200 });
      }
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
              { tool: 'resolve_context', status: 'done', kind: 'code', ms: 212 },
              { tool: 'pack_sources', status: 'done', kind: 'code', ms: 88 },
              { tool: 'write_answer', status: 'done', kind: 'model', ms: 2140, model: 'gpt-5.6-luna', tokens: 1840 },
              { tool: 'check_citations', status: 'done', kind: 'code', ms: 41 },
            ]
          : [
              { tool: 'search_documents', status: 'done', kind: 'code', ms: 340 },
              { tool: 'answer', status: 'done', kind: 'model', ms: 1980, model: 'claude-sonnet', tokens: 1620 },
            ],
        cost_usd: 0.0142,
        took_s: (Date.now() - run.startedAt) / 1000,
        ...(run.agent ? richAgentAnswer() : {}),
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
      const a = agents.find((x) => x.name === agent || x.id === agent);
      // Like the gateway: drafts have no run list.
      if (a?.status === 'draft') return fail(`⚠️ That item doesn't exist, or you can't open it. (no agent you can use matches "${agent}")`);
      return ok({ runs: recentRuns.filter((r) => !agent || r.agent === a?.name) });
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
    case 'resolve_context':
      await new Promise((r) => setTimeout(r, 400));
      return ok(resolve(str('query') ?? ''));
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
    case 'show_artefact': {
      // Live shape: the page's text only; the page itself is on the connector's card.
      const key = str('artefact_key');
      const content = key === 'sample-guide' ? GUIDE_TEXT : 'Precision vs recall\nTwo complementary metrics.';
      return ok({ name: key, type: null, format: 'text of the page (the page is on the card)', content, note: 'Shown on the card.' });
    }
    default:
      return fail(`Mock mode has no data for tool "${name}"`);
  }
}

const GUIDE_TEXT = [
  'Choosing a decision threshold',
  'A sample page: how the cut-off on a model score changes what it catches and what it gets wrong.',
  'Score ≥ t → positive',
  'Lower t catches more',
  'Higher t flags less',
  'Why the threshold matters',
  'Every classifier that outputs a score needs a cut-off. Move it down and the model flags more cases, so it misses fewer but raises more false alarms. Move it up and the opposite happens.',
  'At a glance',
  'Sample model',
  'Precision 0.82',
  'Recall 0.67',
  'F1 0.74',
  'Formulas',
  'Precision = TP / (TP+FP)',
  'Recall = TP / (TP+FN)',
  'F1 = 2 × (P×R) / (P+R)',
  'Generated in a sample run. AI can make mistakes.',
].join('\n');

/** Sample of a rich agent answer, shaped like the live ML Explainer run (2026-11-27): markdown + an html artefact. */
function richAgentAnswer() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;margin:24px;color:#191712;background:#f8f6f0}h1{font-size:22px}.k{display:flex;gap:12px}.k div{flex:1;background:#fff;border:1px solid #e3ded2;border-radius:10px;padding:12px}.k b{display:block;font-size:22px}</style></head><body><h1>Precision vs recall</h1><div class="k"><div>Precision<b>0.82</b></div><div>Recall<b>0.67</b></div><div>F1<b>0.74</b></div></div><p>Sample page. In the live app this is the page Studio made.</p></body></html>`;
  return {
    answer:
      'The page **precision_vs_recall.html** covers both metrics with a worked example.\n\n---\n\n### What is in the page\n\n' +
      '| Section | What you will find |\n|---|---|\n| **KPI tiles** | Precision, recall and F1 for the example |\n| **Confusion matrix** | Which cell hurts which metric |\n| **Formulas** | `TP / (TP+FP)` and `TP / (TP+FN)` |\n\n' +
      '```kpi\n[{"label":"Precision","value":"0.82","delta":"+0.05 vs baseline","good":true},{"label":"Recall","value":"0.67","delta":"-0.08","good":false},{"label":"F1","value":"0.74"}]\n```\n\n' +
      '### Threshold sweep\n\n| Threshold | Precision | Recall |\n|---|---|---|\n| 0.3 | 0.61 | 0.91 |\n| 0.5 | 0.74 | 0.80 |\n| 0.7 | 0.82 | 0.67 |\n| 0.9 | 0.93 | 0.38 |\n\n' +
      '- [x] Split chronologically for time series\n- [ ] Tune the threshold to the cost of each mistake\n\n> Raising the threshold trades recall for precision.\n\n```python\nprecision = tp / (tp + fp)\nrecall = tp / (tp + fn)\n```',
    citations: [],
    // Live pages come back as text only (2026-11-27); the second one carries its HTML to cover that path too.
    artefacts: [
      { title: 'threshold_guide.html', type: 'html', path: 'threshold_guide.html', content: GUIDE_TEXT, artefact_key: 'sample-guide' },
      { title: 'precision_vs_recall.html', type: 'html', path: 'precision_vs_recall.html', content: 'Precision vs recall\nTwo complementary metrics.', artefact_key: 'sample-artefact' },
    ],
    __resources: [{ uri: 'ui://artefact/sample-artefact', mimeType: 'text/html', text: html }],
  };
}
