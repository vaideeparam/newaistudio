/**
 * Canned Studio MCP responses so the UI can be built and demoed without a live session.
 * Shapes follow what the real ai/Studio MCP returned on 2026-11-25 (whoami, list_projects,
 * find_agents, agent_details, list_schedules, recent_runs, source_status, ask_project, get_run).
 * Tools marked GUESS below have no gateway tool at all (governance, audit): their screen says so.
 * File sources, documents and pipeline runs follow mcp-service tools.py (uat @ 370c6192).
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
  {
    name: 'Sales Pulse Dashboard',
    id: 'dc9552b2',
    kind: 'form',
    status: 'draft',
    project: 'AI-Marketing',
    description: 'Generates seeded synthetic sales data, has an LLM analyse it, and renders a self-contained HTML dashboard.',
    inputs: [
      { name: 'seed', type: 'number', required: false, description: 'Random seed for deterministic data generation (default 42)' },
      { name: 'months', type: 'number', required: false, description: 'Number of months to generate (default 12)' },
    ],
    steps: [
      { id: 'generate_sales_data', type: 'custom_python', name: 'Generate sales data' },
      { id: 'analyse_numbers', type: 'llm_prompt', name: 'Analyse the numbers' },
      { id: 'render_dashboard', type: 'custom_python', name: 'Render dashboard' },
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
  'agent_versions', 'list_agents', 'run_agent', 'list_schedules', 'schedule_agent', 'control_schedule', 'recent_runs',
  'source_status', 'project_status', 'search_documents', 'show_artefact', 'connect_source', 'disconnect_source',
  'browse_source', 'add_files', 'retry_file', 'design_agent', 'get_design', 'save_agent',
  // Not gateway tools: the Governance screen's sample data (labelled as such in the UI).
  'governance_summary', 'audit_log',
].map((name) => ({ name, description: `Mock ${name}`, inputSchema: { type: 'object', properties: {} } }));

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
const runs = new Map<string, { message: string; project: string; agent?: string; conversation_id: string; startedAt: number; inputs?: Record<string, unknown> }>();
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
      // Like the gateway: in a host with cards, a form agent run without confirmed answers with its Run form.
      if (a?.kind === 'form' && !args.confirmed) return ok({ status: 'needs_inputs', agent: a.name, missing: [], note: 'The Run form is on the card.' });
      const started = startRun(str('message') ?? String(Object.values((args.inputs as Record<string, unknown>) ?? {})[0] ?? ''), a?.project ?? 'AI-Marketing', str('conversation_id'), a?.name ?? agent);
      const id = (started.data as { run_id?: string }).run_id;
      if (id && runs.has(id)) runs.get(id)!.inputs = (args.inputs as Record<string, unknown>) ?? {};
      return started;
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
      if (run.agent === 'Sales Pulse Dashboard') return ok(pipelineRun(String(args.run_id), run.inputs));
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
        microsoft: { connected: project === 'PureAI' || connected.has(`${project}:microsoft`), account: project === 'PureAI' ? 'sharepoint · pureai.sharepoint.com' : connected.has(`${project}:microsoft`) ? 'sample account' : null },
        google: { connected: connected.has(`${project}:google`), account: connected.has(`${project}:google`) ? 'sample account' : null },
        syncs: (docCounts[project] ?? 0) > 0 ? [{ run_id: `sync-${project}`, source: project.toLowerCase(), status: 'completed', files_done: docCounts[project], files_total: docCounts[project], files_failed: project === 'AI-Marketing' ? 2 : 0, started: '2026-11-21T02:00:04Z' }] : [],
        sources:
          (docCounts[project] ?? 0) > 0
            ? [{ name: project.toLowerCase(), type: project === 'PureAI' ? 'sharepoint_folder' : 'teamdocs_folder', files_indexed: docCounts[project], last_sync: '2026-11-21T02:00:10Z', last_status: 'success' }]
            : [],
      });
    }
    case 'project_status': {
      const project = str('project') ?? 'AI-Marketing';
      const n = docCounts[project] ?? 0;
      const failed = project === 'AI-Marketing' ? 2 : 0;
      return ok({ project, status: 'ready', documents: n, ready_documents: n - failed, failed_documents: failed, can_set_up: true, microsoft: { connected: project === 'PureAI', account: null }, sources: n ? 1 : 0 });
    }
    case 'search_documents': {
      const project = str('project') ?? 'AI-Marketing';
      const all = sampleDocs(project);
      const q = (str('search') ?? '').toLowerCase();
      const st = str('status');
      const hits = all.filter((d) => (!q || d.name.toLowerCase().includes(q)) && (!st || d.status === st));
      const from = Number((str('next_page') ?? 'c:0').slice(2)) || 0;
      const page = hits.slice(from, from + 20);
      return ok({ project, documents: page, count: page.length, total: hits.length, ...(from + 20 < hits.length ? { next_page: `c:${from + 20}` } : {}) });
    }
    case 'connect_source': {
      const project = str('project') ?? 'AI-Marketing';
      if (connected.has(`${project}:${sourceKey(str('source'))}`) && !args.reconnect) return ok({ project, status: 'connected', note: 'Already connected.' });
      connected.add(`${project}:${sourceKey(str('source'))}`); // the sample "signs in" as soon as the link is asked for
      return ok({ project, status: 'open_link', link: 'about:blank#sample-sign-in', expires_in_minutes: 10 });
    }
    case 'disconnect_source': {
      const project = str('project') ?? 'AI-Marketing';
      if (!args.confirm) return ok({ project, status: 'confirm', warning: 'Disconnecting means browsing and adding files needs a new sign-in; documents already added stay.' });
      connected.delete(`${project}:${sourceKey(str('source'))}`);
      return ok({ project, status: 'disconnected', note: 'Disconnected here. Documents already added stay.' });
    }
    case 'browse_source': {
      const source = str('source') ?? 'onedrive';
      if (source === 'sharepoint') {
        if (!str('site_id')) return ok({ level: 'sites', items: str('search') ? [{ id: 'site-1', name: 'Marketing site', kind: 'site' }] : [] });
        if (!str('drive_id')) return ok({ level: 'libraries', items: [{ id: 'lib-1', name: 'Documents', kind: 'library', site_id: str('site_id') }] });
        return ok({ level: 'folder', items: [{ id: 'sp-f1', name: 'Campaigns', kind: 'folder', site_id: str('site_id'), drive_id: str('drive_id') }] });
      }
      const folder = str('folder_id');
      const items = folder
        ? [{ id: `${folder}-a`, name: 'Q4 plan.docx', kind: 'file', size_kb: 84 }, { id: `${folder}-b`, name: 'Briefs', kind: 'folder', items_inside: 6 }]
        : [{ id: 'od-1', name: 'Marketing', kind: 'folder', items_inside: 12 }, { id: 'od-2', name: 'Launch notes.pdf', kind: 'file', size_mb: 1.2 }];
      return ok({ level: source === 'gdrive' ? 'gdrive' : 'onedrive', items, count: items.length });
    }
    case 'add_files': {
      const items = Array.isArray(args.items) ? (args.items as string[]) : [];
      if (!items.length) return fail('items: give the ids from browse_source');
      return ok({ project: str('project'), added: items.map((i) => (i === 'od-1' ? 'Marketing' : i === 'od-2' ? 'Launch notes.pdf' : i)), job_id: 'job-1', note: 'Syncing has started.' });
    }
    case 'retry_file':
      return ok({ note: str('document') ? 'Retrying that document.' : 'Retrying the failed files.' });
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
      if (key === 'sales-pulse') {
        const html = dashboardHtml(42, 12);
        return ok({ name: 'Dashboard html', type: 'html', content: 'Sales pulse dashboard', note: 'Shown on the card.', ...(args.include_page ? { page: { format: 'html', content: html } } : {}) });
      }
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

// ---------- file sources (shapes from mcp-service tools.py) ----------
const connected = new Set<string>();
const sourceKey = (s?: string) => (s === 'gdrive' ? 'google' : 'microsoft');

function sampleDocs(project: string) {
  const n = docCounts[project] ?? 0;
  const kinds = ['brief', 'retro', 'plan', 'notes', 'deck'];
  return Array.from({ length: n }, (_, i) => ({
    name: `${project.toLowerCase()}-${kinds[i % kinds.length]}-${String(i + 1).padStart(2, '0')}.${i % 3 ? 'md' : 'pdf'}`,
    id: `doc-${project}-${i}`,
    status: project === 'AI-Marketing' && i >= n - 2 ? 'failed' : 'ready',
    source: 'teamdocs_folder',
    pages: 1 + (i % 7),
    added: '2026-11-21T02:00:09Z',
  }));
}

// ---------- the DAG mind's run (made-up data from a seeded generator, never a live payload) ----------
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function salesRows(seed: number, months: number) {
  const r = rng(seed);
  const rows: { month: string; region: string; product: string; revenue: number }[] = [];
  for (let m = 1; m <= months; m++)
    for (const region of ['North', 'South', 'East', 'West'])
      for (const product of ['Alpha', 'Beta', 'Gamma'])
        rows.push({ month: `M${String(m).padStart(2, '0')}`, region, product, revenue: Math.round((20000 + r() * 30000) * (1 + m * 0.015)) });
  return rows;
}
function dashboardHtml(seed: number, months: number) {
  const rows = salesRows(seed, months);
  const total = rows.reduce((t, x) => t + x.revenue, 0);
  const byRegion = ['North', 'South', 'East', 'West'].map((g) => [g, rows.filter((x) => x.region === g).reduce((t, x) => t + x.revenue, 0)] as const);
  const max = Math.max(...byRegion.map(([, v]) => v));
  const bars = byRegion
    .map(([g, v], i) => `<g><rect x="${20 + i * 80}" y="${160 - (v / max) * 140}" width="50" height="${(v / max) * 140}" fill="#2a6df4" rx="4"/><text x="${45 + i * 80}" y="178" text-anchor="middle" font-size="12">${g}</text></g>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Sales pulse</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#1b1d22;background:#fff}.k{display:flex;gap:12px;flex-wrap:wrap}.k div{border:1px solid #e3e5ea;border-radius:10px;padding:12px 16px;min-width:140px}.k b{display:block;font-size:22px}.ai{background:#f3f6ff;border-left:4px solid #2a6df4;padding:12px 16px;border-radius:6px;margin-top:16px}</style></head><body><h1>Sales pulse</h1><p>Sample data, seed ${seed}, ${months} months.</p><div class="k"><div><b>${(total / 1e6).toFixed(2)}M</b>Total revenue</div><div><b>${byRegion.sort((a, b) => b[1] - a[1])[0]?.[0]}</b>Top region</div></div><h2>Revenue by region</h2><svg viewBox="0 0 340 190" width="100%" style="max-width:520px">${bars}</svg><div class="ai"><b>AI analysis</b><p>Revenue grew steadily across the period. Diversify beyond the leading product line.</p></div></body></html>`;
}
function pipelineRun(run_id: string, inputs: Record<string, unknown> = {}) {
  const seed = Number(inputs.seed ?? 42) || 42;
  const months = Number(inputs.months ?? 12) || 12;
  const analysis = { headline: 'Sample: revenue rose over the period.', insights: ['North led the regions.', 'Gamma grew fastest.'], risk: 'One product carries most of the revenue.', recommendation: 'Shift some budget to the fastest-growing product.' };
  return {
    run_id,
    conversation_id: run_id,
    answer: JSON.stringify(analysis),
    cost: { usd: 0.0034, tokens: 10307 },
    outputs: {
      generate_sales_data: { result: { months, rows: `${salesRows(seed, months).length} rows` } },
      analyse_numbers: { output: JSON.stringify(analysis) },
      render_dashboard: { result: { dashboard_html: 'Sales pulse Sample data… (in full: the artefact "Dashboard html")' } },
    },
    artefacts: [{ title: 'Dashboard html', type: 'html', artefact_key: 'sales-pulse' }],
    steps: [
      { tool: 'Running analysis', status: 'done' },
      { tool: 'llm_prompt', status: 'done' },
      { tool: 'Running analysis', status: 'done' },
    ],
    took_s: 20.9,
  };
}
