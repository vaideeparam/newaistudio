import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../../app/session';
import { AuthRequiredError } from '../../lib/mcp';
import { askProject, listProjects, listWorkspaces, selectWorkspace } from './api';
import { AnswerView } from './AnswerView';
import type { Project, Turn, Workspace } from './types';
import './ask.css';

type Load<T> = { state: 'idle' | 'loading' | 'ready' | 'error'; data: T; error?: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AskPage() {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const workspaceName = params.get('workspace');
  const projectId = params.get('project');

  const [workspaces, setWorkspaces] = useState<Load<Workspace[]>>({ state: 'idle', data: [] });
  const [projects, setProjects] = useState<Load<Project[]>>({ state: 'idle', data: [] });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [question, setQuestion] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // RequireSession already gates this page; this only guards the effects.
  const signedIn = !!session.session?.signedIn;
  const project = projects.data.find((p) => p.id === projectId);
  const busy = turns.some((t) => t.state === 'running');

  const setParam = useCallback(
    (key: string, value: string | null, also?: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries({ [key]: value, ...also })) {
            if (v == null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Workspaces: load once signed in, default to the account's default usable workspace.
  useEffect(() => {
    if (!signedIn) return;
    const ac = new AbortController();
    setWorkspaces((w) => ({ ...w, state: 'loading' }));
    listWorkspaces(ac.signal)
      .then((all) => {
        const usable = all.filter((w) => w.this_app_can_use !== false);
        setWorkspaces({ state: 'ready', data: usable });
        const pick = usable.find((w) => w.default) ?? usable[0];
        if (!workspaceName && pick) setParam('workspace', pick.name);
      })
      .catch((e) => !ac.signal.aborted && setWorkspaces({ state: 'error', data: [], error: errorText(e) }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Projects: switch the Gateway's default workspace, then list its projects.
  useEffect(() => {
    if (!signedIn || !workspaceName || workspaces.state !== 'ready') return;
    const ac = new AbortController();
    setProjects({ state: 'loading', data: [] });
    const current = workspaces.data.find((w) => w.name === workspaceName);
    (current?.default ? Promise.resolve() : selectWorkspace(workspaceName, ac.signal))
      .then(() => listProjects(ac.signal))
      .then((list) => {
        setProjects({ state: 'ready', data: list });
        if (!list.some((p) => p.id === projectId)) {
          const pick = list.find((p) => p.default) ?? (list.length === 1 ? list[0] : undefined);
          setParam('project', pick?.id ?? null);
        }
      })
      .catch((e) => !ac.signal.aborted && setProjects({ state: 'error', data: [], error: errorText(e) }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, workspaceName, workspaces.state]);

  // A new project means a new conversation.
  useEffect(() => {
    abortRef.current?.abort();
    setTurns([]);
    setConversationId(undefined);
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateTurn = (id: string, patch: Partial<Turn>) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || !project || busy) return;

    const id = crypto.randomUUID();
    const ac = new AbortController();
    abortRef.current = ac;
    setQuestion('');
    setTurns((ts) => [...ts, { id, question: q, state: 'running' }]);

    try {
      const answer = await askProject(q, {
        project: project.id,
        conversationId,
        newConversation: !conversationId,
        signal: ac.signal,
        onProgress: ({ progress, steps }) => updateTurn(id, { progress, steps }),
      });
      if (answer.conversationId) setConversationId(answer.conversationId);
      updateTurn(id, {
        state: 'done',
        answer: answer.text ? answer : { ...answer, text: 'Studio returned an empty answer.' },
      });
    } catch (err) {
      if (ac.signal.aborted) return updateTurn(id, { state: 'error', error: 'Stopped.' });
      if (err instanceof AuthRequiredError) {
        updateTurn(id, { state: 'error', error: 'Your session ended. Sign in again to keep asking.' });
        return;
      }
      updateTurn(id, { state: 'error', error: errorText(err) });
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setConversationId(undefined);
  }

  return (
    <div className="ask-page">
      <header className="ask-bar">
        <label className="ask-field">
          <span>Workspace</span>
          <select
            value={workspaceName ?? ''}
            disabled={workspaces.state !== 'ready' || busy}
            onChange={(e) => setParam('workspace', e.target.value, { project: null })}
          >
            {workspaces.state === 'loading' && <option value="">Loading…</option>}
            {workspaces.data.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ask-field">
          <span>Project</span>
          <select
            value={projectId ?? ''}
            disabled={projects.state !== 'ready' || busy}
            onChange={(e) => setParam('project', e.target.value || null)}
          >
            <option value="">{projects.state === 'loading' ? 'Loading…' : 'Choose a project'}</option>
            {projects.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="ask-btn" onClick={newChat} disabled={!turns.length}>
          New chat
        </button>
      </header>

      {(workspaces.error || projects.error) && (
        <p className="ask-error" role="alert">
          {workspaces.error ?? projects.error}
        </p>
      )}
      {workspaces.state === 'ready' && !workspaces.data.length && (
        <p className="ask-error">
          This app is not connected to any workspace yet. In Studio, open Settings, Copilot, Connected apps to add one.
        </p>
      )}

      <main className="ask-thread" aria-live="polite">
        {!turns.length && (
          <div className="ask-empty">
            {project ? (
              <>
                <h2>Ask {project.name}</h2>
                <p>Answers come from this project's documents, with numbered sources you can check.</p>
              </>
            ) : (
              <p>Choose a project to start asking.</p>
            )}
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id} className="ask-turn">
            <div className="ask-question">{t.question}</div>
            {t.state === 'running' && (
              <div className="ask-running">
                <span className="ask-spinner" aria-hidden />
                <span>{t.progress ? `Working · ${t.progress}` : 'Working…'}</span>
                {!!t.steps?.length && (
                  <ul className="ask-steps">
                    {t.steps.map((s, i) => (
                      <li key={i} className={s.status === 'done' ? 'is-done' : ''}>
                        {s.tool}
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="ask-btn ask-btn-ghost" onClick={() => abortRef.current?.abort()}>
                  Stop
                </button>
              </div>
            )}
            {t.state === 'done' && t.answer && <AnswerView answer={t.answer} />}
            {t.state === 'error' && (
              <p className="ask-error" role="alert">
                {t.error}
                {t.error?.startsWith('Your session ended') && (
                  <button type="button" className="ask-btn ask-btn-ghost" onClick={() => session.signIn()}>
                    Sign in
                  </button>
                )}
              </p>
            )}
          </article>
        ))}
        <div ref={endRef} />
      </main>

      <form className="ask-composer" onSubmit={submit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={project ? `Ask ${project.name} a question` : 'Choose a project first'}
          disabled={!project}
          rows={2}
          aria-label="Your question"
        />
        <button type="submit" className="ask-btn ask-btn-primary" disabled={!project || !question.trim() || busy}>
          Ask
        </button>
      </form>
    </div>
  );
}
