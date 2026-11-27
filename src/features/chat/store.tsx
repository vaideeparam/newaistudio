import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { normalizeCitations } from '../ask/citations';
import type { Citation } from '../ask/types';
import { callTool } from '../../lib/mcp';

/** Who a message goes to. Chosen per conversation in the composer, not by a global switch. */
export type Target = { kind: 'project'; name: string } | { kind: 'agent'; name: string; id: string; project?: string; version?: string };

export interface RunStep {
  tool: string;
  status: string;
  /** code = deterministic/governed step, model = LLM call. Not always reported. */
  kind?: 'code' | 'model' | string;
  ms?: number;
  model?: string;
  tokens?: number;
}

export interface Turn {
  id: string;
  question: string;
  state: 'running' | 'done' | 'error';
  progress?: string;
  steps: RunStep[];
  answer?: string;
  citations: Citation[];
  tookS?: number;
  costUsd?: number;
  runId?: string;
  error?: string;
  artefacts?: Artefact[];
  /** A gentle explanation shown instead of an answer (e.g. an older run Studio no longer keeps). */
  note?: string;
  /** Reopened run whose answer Studio no longer has. */
  expired?: boolean;
}

/** A page, report or table an answer made (observed live 2026-11-27 on get_run). */
export interface Artefact {
  title: string;
  /** "html", … */
  type?: string;
  path?: string;
  /** The page's text (not its HTML). */
  content?: string;
  /** Pass to show_artefact / save_artefact. */
  artefact_key?: string;
  /** Present when the gateway also sent the page itself (MCP-UI resource). */
  html?: string;
}

export interface Conversation {
  id: string;
  title: string;
  target: Target;
  workspace?: string;
  /** Connector ids switched on for this conversation (from the composer's + menu). */
  connectors?: string[];
  /** Form agents: the inputs the first run was started with. */
  inputs?: Record<string, unknown>;
  conversationId?: string;
  turns: Turn[];
  updatedAt: number;
}

interface RunResponse {
  status?: string;
  run_id?: string;
  conversation_id?: string;
  progress?: string;
  steps?: RunStep[];
  answer?: string;
  citations?: { source: string; page?: number | string; quote?: string }[];
  took_s?: number;
  cost_usd?: number;
  /** needs_inputs / awaiting approval / failed runs explain themselves here. */
  message?: string;
  question?: string;
  missing?: Array<string | { name?: string; label?: string }>;
  invalid?: Array<{ field?: string; label?: string; problem?: string }>;
  error?: string;
  output?: unknown;
  outputs?: unknown;
  artefacts?: Artefact[];
  cost?: { usd?: number; tokens?: number };
  __resources?: { uri?: string; mimeType?: string; text?: string }[];
}

/** Attach any HTML the gateway sent as an MCP-UI resource to the artefact it belongs to. */
function artefactsOf(r: RunResponse | undefined): Artefact[] {
  const list = (r?.artefacts ?? []).map((a) => ({ ...a }));
  const html = (r?.__resources ?? []).filter((x) => /html/.test(x.mimeType ?? '') && x.text);
  html.forEach((h, i) => {
    const a = list.find((x) => h.uri?.includes(x.artefact_key ?? '\u0000') || h.uri?.includes(x.path ?? '\u0000')) ?? list[i];
    if (a) a.html = h.text;
    else list.push({ title: h.uri ?? 'Page', type: 'html', html: h.text });
  });
  return list;
}

/** What to show when a run ends without a plain answer (form agents, questions, failures). */
/**
 * A pipeline's answer is often its last model step's JSON ({"headline": …, "insights": […]}).
 * Shown as a short document instead of raw JSON; anything else is left as it is.
 */
export function readableAnswer(answer: string | undefined): string | undefined {
  if (!answer || !/^[{[]/.test(answer)) return answer;
  let v: unknown;
  try {
    v = JSON.parse(answer);
  } catch {
    return answer;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return answer;
  const label = (k: string) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const parts: string[] = [];
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val == null || val === '') continue;
    if (/^(headline|title|summary)$/i.test(k) && typeof val === 'string' && !parts.length) parts.push(`**${val}**`);
    else if (Array.isArray(val)) parts.push(`### ${label(k)}\n\n${val.map((x) => `- ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n')}`);
    else if (typeof val === 'object') parts.push(`### ${label(k)}\n\n\`\`\`json\n${JSON.stringify(val, null, 2)}\n\`\`\``);
    else parts.push(`### ${label(k)}\n\n${String(val)}`);
  }
  return parts.join('\n\n') || answer;
}

/** A pipeline's outputs in plain words: short values as a list, long ones point at their page. */
export function outputsText(outs: unknown): string {
  if (outs == null || typeof outs !== 'object' || Array.isArray(outs)) return '```\n' + JSON.stringify(outs, null, 2) + '\n```';
  const o = outs as Record<string, unknown>;
  if (o.truncated && typeof o.preview === 'string') return 'The outputs are long; the start is shown.\n\n```\n' + o.preview + '\n```';
  const lines: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    const label = k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    if (typeof v === 'string') {
      const page = /\(in full: the artefact "([^"]+)"\)\s*$/.exec(v);
      lines.push(page ? `- **${label}**: opens as the page “${page[1]}” below.` : `- **${label}**: ${v}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`- **${label}**: ${v}`);
    else lines.push(`- **${label}**:\n\n\`\`\`json\n${JSON.stringify(v, null, 2)}\n\`\`\``);
  }
  return lines.length ? `**Outputs**\n\n${lines.join('\n')}` : 'The run finished with no outputs.';
}

function fallbackText(r: RunResponse | undefined): string {
  if (!r) return '';
  if (r.error) return `The run failed: ${r.error}`;
  if (r.status === 'needs_inputs') {
    const missing = (r.missing ?? []).map((m) => (typeof m === 'string' ? m : m.label || m.name || '')).filter(Boolean);
    const invalid = (r.invalid ?? []).map((i) => i.problem || i.label || i.field || '').filter(Boolean);
    return [
      r.message ?? 'Nothing was run yet: this mind needs a few more details.',
      missing.length ? `Still needed: ${missing.join(', ')}.` : '',
      invalid.length ? `To fix: ${invalid.join('; ')}.` : '',
    ].filter(Boolean).join(' ');
  }
  if (r.question) return r.question;
  if (r.message) return r.message;
  const outs = r.outputs ?? r.output;
  if (outs != null) return outputsText(outs);
  return '';
}

const KEY = 'studio.conversations.v1';
const MAX_POLLS = 40;

function load(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Conversation[]) : [];
    // A run cannot survive a reload of the page; mark leftovers so they don't spin forever.
    return list.map((c) => ({
      ...c,
      turns: c.turns.map((t) => (t.state === 'running' ? { ...t, state: 'error' as const, error: 'Interrupted' } : t)),
    }));
  } catch {
    return [];
  }
}

interface ChatState {
  conversations: Conversation[];
  get: (id: string) => Conversation | undefined;
  start: (target: Target, question: string, workspace?: string, connectors?: string[], inputs?: Record<string, unknown>) => string;
  setConnectors: (id: string, connectors: string[]) => void;
  send: (id: string, question: string) => void;
  remove: (id: string) => void;
  /** Stop the running turn: cancels the run on Studio and keeps what was asked. */
  stop: (id: string) => void;
  reopen: (target: Target, runId: string, title: string, workspace?: string) => string;
  hydrate: (convId: string, turnId: string, runId: string) => void;
}

const Ctx = createContext<ChatState | null>(null);

let n = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(conversations.slice(0, 50)));
    } catch {
      /* storage may be unavailable */
    }
  }, [conversations]);

  const stopped = useRef(new Set<string>());
  const patchTurn = useCallback((convId: string, turnId: string, patch: Partial<Turn>, convPatch: Partial<Conversation> = {}) => {
    setConversations((list) =>
      list.map((c) =>
        c.id !== convId
          ? c
          : { ...c, ...convPatch, updatedAt: Date.now(), turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) },
      ),
    );
  }, []);

  const run = useCallback(
    async (conv: Conversation, turn: Turn) => {
      try {
        const base =
          conv.target.kind === 'project'
            ? { tool: 'ask_project', args: { message: turn.question, project: conv.target.name } }
            : { tool: 'run_agent', args: { agent: conv.target.id || conv.target.name, message: turn.question } };
        // TODO(dev MCP): pass conv.connectors once ask_project/run_agent take a connectors argument.
        // The Gateway rejects unknown arguments, so they are only shown in the UI for now.
        const args: Record<string, unknown> = { ...base.args };
        if (conv.target.kind === 'agent' && conv.inputs && !conv.conversationId) {
          args.inputs = conv.inputs;
          delete args.message;
        }
        if (conv.target.kind === 'agent' && conv.target.version) args.version = conv.target.version;
        // The person pressed Run in this app's own form or composer, so the gateway shouldn't answer with its Run form.
        if (conv.target.kind === 'agent') args.confirmed = true;
        if (conv.conversationId) args.conversation_id = conv.conversationId;
        else args.new_conversation = true;

        let r = await callTool<RunResponse>(base.tool, args);
        let polls = 0;
        while (r?.status === 'running' && r.run_id) {
          if (stopped.current.has(turn.id)) return;
          patchTurn(conv.id, turn.id, { progress: r.progress, steps: r.steps ?? [], runId: r.run_id }, { conversationId: r.conversation_id });
          if (++polls > MAX_POLLS) throw new Error('Studio is still working on this. Ask again in a minute.');
          r = await callTool<RunResponse>('get_run', { run_id: r.run_id });
        }
        if (stopped.current.has(turn.id)) return;
        patchTurn(
          conv.id,
          turn.id,
          {
            state: 'done',
            answer: readableAnswer(r?.answer?.trim()) || fallbackText(r),
            citations: normalizeCitations(r?.citations),
            steps: r?.steps ?? [],
            tookS: r?.took_s,
            costUsd: r?.cost_usd ?? r?.cost?.usd,
            artefacts: artefactsOf(r),
            runId: r?.run_id ?? turn.runId,
          },
          { conversationId: r?.conversation_id ?? conv.conversationId },
        );
      } catch (e) {
        if (stopped.current.has(turn.id)) return;
        patchTurn(conv.id, turn.id, { state: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    },
    [patchTurn],
  );

  const start = useCallback(
    (target: Target, question: string, workspace?: string, connectors: string[] = [], inputs?: Record<string, unknown>) => {
      const turn: Turn = { id: uid('t'), question, state: 'running', steps: [], citations: [] };
      const conv: Conversation = {
        id: uid('c'),
        title: question.length > 60 ? question.slice(0, 57) + '…' : question,
        target,
        workspace,
        connectors,
        inputs,
        turns: [turn],
        updatedAt: Date.now(),
      };
      setConversations((list) => [conv, ...list]);
      void run(conv, turn);
      return conv.id;
    },
    [run],
  );

  const send = useCallback(
    (id: string, question: string) => {
      const turn: Turn = { id: uid('t'), question, state: 'running', steps: [], citations: [] };
      let target: Conversation | undefined;
      setConversations((list) =>
        list.map((c) => {
          if (c.id !== id) return c;
          target = { ...c, turns: [...c.turns, turn], updatedAt: Date.now() };
          return target;
        }),
      );
      // setState updaters run synchronously for this call, so target is set here.
      queueMicrotask(() => target && void run(target, turn));
    },
    [run],
  );

  /**
   * Reopen an earlier Studio run (from recent_runs) as a conversation here:
   * get_run returns its answer, steps and pages again. Continuing it carries
   * on the same Studio conversation.
   */
  const reopen = useCallback(
    (target: Target, runId: string, title: string, workspace?: string) => {
      const existing = conversations.find((c) => c.conversationId === runId || c.turns.some((t) => t.runId === runId));
      if (existing) return existing.id;
      const turn: Turn = { id: uid('t'), question: title, state: 'running', steps: [], citations: [], runId, progress: 'Opening this run from Studio' };
      const conv: Conversation = { id: uid('c'), title, target, workspace, connectors: [], turns: [turn], conversationId: runId, updatedAt: Date.now() };
      setConversations((list) => [conv, ...list]);
      void callTool<RunResponse>('get_run', { run_id: runId })
        .then((r) =>
          patchTurn(conv.id, turn.id, {
            state: 'done',
            answer: r?.answer?.trim() || fallbackText(r),
            citations: normalizeCitations(r?.citations),
            steps: r?.steps ?? [],
            tookS: r?.took_s,
            costUsd: r?.cost_usd ?? r?.cost?.usd,
            artefacts: artefactsOf(r),
          }),
        )
        .catch((e) =>
          // Older chat sessions expire on the gateway: keep what we know and offer to run it again.
          patchTurn(
            conv.id,
            turn.id,
            {
              state: 'done',
              answer: '',
              artefacts: [],
              expired: true,
              note: /not found|doesn't exist/i.test(e instanceof Error ? e.message : String(e))
                ? "Studio no longer keeps the full answer for this older run, only its summary. Run it again to get a fresh answer."
                : `Studio couldn't open this run just now (${e instanceof Error ? e.message : String(e)}).`,
            },
            { conversationId: undefined },
          ),
        );
      return conv.id;
    },
    [conversations, patchTurn],
  );

  /** Answers saved before pages were shown: fetch their pages from Studio once. */
  const hydrate = useCallback(
    (convId: string, turnId: string, runId: string) => {
      patchTurn(convId, turnId, { artefacts: [] });
      void callTool<RunResponse>('get_run', { run_id: runId })
        .then((r) => patchTurn(convId, turnId, { artefacts: artefactsOf(r) }))
        .catch(() => undefined);
    },
    [patchTurn],
  );

  const setConnectors = useCallback(
    (id: string, ids: string[]) => setConversations((list) => list.map((c) => (c.id === id ? { ...c, connectors: ids } : c))),
    [],
  );

  const stop = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      const turn = conv?.turns.find((t) => t.state === 'running');
      if (!conv || !turn) return;
      stopped.current.add(turn.id);
      patchTurn(conv.id, turn.id, { state: 'error', error: 'Stopped.' });
      if (turn.runId) void callTool('cancel_run', { run_id: turn.runId }).catch(() => undefined);
    },
    [conversations, patchTurn],
  );

  const remove = useCallback((id: string) => setConversations((list) => list.filter((c) => c.id !== id)), []);
  const get = useCallback((id: string) => conversations.find((c) => c.id === id), [conversations]);

  return <Ctx.Provider value={{ conversations, get, start, send, remove, setConnectors, stop, reopen, hydrate }}>{children}</Ctx.Provider>;
}

export function useChats(): ChatState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChats must be used inside <ChatProvider>');
  return v;
}
