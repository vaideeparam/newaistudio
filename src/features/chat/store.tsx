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
}

export interface Conversation {
  id: string;
  title: string;
  target: Target;
  workspace?: string;
  /** Connector ids switched on for this conversation (from the composer's + menu). */
  connectors?: string[];
  /** Form agents: the inputs the first run was started with. */
  inputs?: Record<string, string>;
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
  missing?: string[];
  error?: string;
  output?: unknown;
}

/** What to show when a run ends without a plain answer (form agents, questions, failures). */
function fallbackText(r: RunResponse | undefined): string {
  if (!r) return '';
  if (r.error) return `The run failed: ${r.error}`;
  if (r.status === 'needs_inputs') return `${r.message ?? 'This agent needs more inputs.'}${r.missing?.length ? ` Missing: ${r.missing.join(', ')}.` : ''}`;
  if (r.question) return r.question;
  if (r.message) return r.message;
  if (r.output != null) return '```\n' + JSON.stringify(r.output, null, 2) + '\n```';
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
  start: (target: Target, question: string, workspace?: string, connectors?: string[], inputs?: Record<string, string>) => string;
  setConnectors: (id: string, connectors: string[]) => void;
  send: (id: string, question: string) => void;
  remove: (id: string) => void;
  /** Stop the running turn: cancels the run on Studio and keeps what was asked. */
  stop: (id: string) => void;
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
            answer: r?.answer?.trim() || fallbackText(r),
            citations: normalizeCitations(r?.citations),
            steps: r?.steps ?? [],
            tookS: r?.took_s,
            costUsd: r?.cost_usd,
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
    (target: Target, question: string, workspace?: string, connectors: string[] = [], inputs?: Record<string, string>) => {
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

  return <Ctx.Provider value={{ conversations, get, start, send, remove, setConnectors, stop }}>{children}</Ctx.Provider>;
}

export function useChats(): ChatState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChats must be used inside <ChatProvider>');
  return v;
}
