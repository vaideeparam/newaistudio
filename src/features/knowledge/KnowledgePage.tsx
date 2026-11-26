import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../app/session';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { useTool } from '../../lib/useTool';
import { useChats } from '../chat/store';
import { Graph, type GEdge, type GNode } from './Graph';

/** GUESS: mirrors the Resolver tab of Studio's KG page. */
interface Resolved {
  query: string;
  model_calls?: number;
  timing_ms?: number;
  token_count?: number;
  document_context?: { document_name: string; heading?: string; summary?: string; score?: number }[];
  entities_matched?: { id?: string; name: string; source?: string; confidence?: number }[];
  highlight?: string[];
}

interface SourceStatus {
  microsoft?: { connected: boolean; account?: string | null };
  google?: { connected: boolean; account?: string | null };
  sources?: { name: string; type: string; files_indexed?: number; last_sync?: string; last_status?: string }[];
}

const CONNECTORS = [
  { id: 'sharepoint', label: 'SharePoint', sub: 'Sites and document libraries', key: 'microsoft' as const },
  { id: 'onedrive', label: 'OneDrive', sub: 'Your files and shared folders', key: 'microsoft' as const },
  { id: 'gdrive', label: 'Google Drive', sub: 'My Drive and shared drives', key: 'google' as const },
];

/**
 * Knowledge: what Studio knows, per project. Sources feed it in, the graph
 * shows what was understood, and any node can be asked about directly.
 */
export function KnowledgePage() {
  const { session } = useSession();
  const { projects, defaultProject, workspace } = useStudio();
  const [project, setProject] = useState<string>('');
  const [sel, setSel] = useState<string | undefined>();
  const { start } = useChats();
  const nav = useNavigate();

  useEffect(() => {
    if (!project && projects.length) setProject(defaultProject ?? projects[0]?.name ?? '');
  }, [projects, defaultProject, project]);

  const sources = useTool<SourceStatus>('source_status', { project });
  const graph = useTool<{ nodes?: GNode[]; edges?: GEdge[] }>('knowledge_graph', { project });
  const nodes = graph.data?.nodes ?? [];
  const edges = graph.data?.edges ?? [];
  const node = nodes.find((n) => n.id === sel);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [resolving, setResolving] = useState(false);
  const hits = useMemo(() => new Set(resolved?.highlight ?? resolved?.entities_matched?.map((e) => e.id ?? '') ?? []), [resolved]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    nodes.forEach((n) => (m[n.type] = (m[n.type] ?? 0) + 1));
    return m;
  }, [nodes]);
  useEffect(() => setResolved(null), [project]);

  const resolve = async () => {
    if (!query.trim()) return;
    setResolving(true);
    try {
      setResolved(await callTool<Resolved>('resolve_context', { project, query }));
    } finally {
      setResolving(false);
    }
  };

  const connect = async (source: string) => {
    const r = await callTool<{ link?: string; sign_in?: string }>('connect_source', { project, source });
    const link = r?.link ?? r?.sign_in;
    if (link) window.open(link, '_blank', 'noopener');
  };

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">
            Knowledge
            {session?.mode === 'connector' && <span className="sample-tag" title="No backend tool for this screen yet">Sample data</span>}
          </h1>
          <p className="page__sub">Where your documents come from, and what Studio understood from them.</p>
        </div>
      </div>

      <div className="project-tabs" role="tablist">
        {projects.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.name === project} className={p.name === project ? 'is-on' : ''} onClick={() => { setProject(p.name); setSel(undefined); }}>
            {p.name}
            {p.documents != null && <span className="count">{p.documents}</span>}
          </button>
        ))}
      </div>

      <div className="kg">
        <section className="as-card kg__graph">
          <div className="zone-head">
            <span className="as-label">What Studio understood</span>
            <span className="legend-dots">
              <i className="g-document" /> document {counts.document ?? 0} <i className="g-section" /> section {counts.section ?? 0}
              <i className="g-entity" /> entity {counts.entity ?? 0} <i className="g-topic" /> topic {counts.topic ?? 0}
            </span>
          </div>
          <form
            className="resolver"
            onSubmit={(e) => {
              e.preventDefault();
              void resolve();
            }}
          >
            <Icon name="bolt" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a question to see what Studio would read for it" />
            {resolved && (
              <button type="button" className="as-btn as-btn--ghost resolver__clear" onClick={() => { setResolved(null); setQuery(''); }}>
                Clear
              </button>
            )}
            <button type="submit" className="as-btn as-btn--secondary" disabled={resolving || !query.trim()}>
              {resolving ? 'Looking…' : 'Show me'}
            </button>
          </form>
          {nodes.length > 0 ? (
            <Graph nodes={nodes} edges={edges} selected={sel} onSelect={setSel} highlight={hits} />
          ) : (
            <p className="muted">{graph.loading ? 'Reading the graph…' : 'No graph yet. It is built as documents are added.'}</p>
          )}
          {resolved && (
            <div className="resolved">
              <div className="resolved__head">
                <span className="as-status as-status--governed">
                  Found in {resolved.timing_ms ?? '—'} ms{resolved.model_calls === 0 ? ' · no AI model used' : ''}
                </span>
                <span className="muted small">{resolved.entities_matched?.length ?? 0} things matched</span>
              </div>
              {resolved.document_context?.map((c, i) => (
                <div key={i} className="passage">
                  <div className="passage__score" title={`score ${c.score}`}>
                    <span style={{ width: `${Math.round((c.score ?? 0) * 160)}%` }} />
                  </div>
                  <div>
                    <div className="passage__title">
                      {c.document_name}
                      {c.heading && <span className="muted"> · {c.heading}</span>}
                    </div>
                    <div className="passage__text">{c.summary}</div>
                  </div>
                </div>
              ))}
              <div className="resolved__actions">
                <button
                  type="button"
                  className="as-btn as-btn--primary"
                  onClick={() => nav(`/c/${start({ kind: 'project', name: project }, resolved.query, workspace)}`)}
                >
                  Ask this
                </button>
              </div>
            </div>
          )}
          {node && !resolved && (
            <div className="kg__node">
              <div>
                <div className="as-card__title">{node.label}</div>
                <div className="muted small">
                  {node.type} · in {node.docs ?? 0} documents ·{' '}
                  {edges.filter((e) => e.source === node.id || e.target === node.id).length} links
                </div>
              </div>
              <button
                type="button"
                className="as-btn as-btn--primary"
                onClick={() => nav(`/c/${start({ kind: 'project', name: project }, `What do our documents say about ${node.label}?`, workspace)}`)}
              >
                Ask about {node.label}
              </button>
            </div>
          )}
        </section>

        <section className="kg__side">
          <div className="as-label sub-head">Sources in {project}</div>
          {sources.data?.sources?.map((s) => (
            <div key={s.name} className="as-card source">
              <Icon name="doc" />
              <div className="source__main">
                <div className="as-card__title">{s.name}</div>
                <div className="muted small">
                  {s.type.replace(/_/g, ' ')} · {s.files_indexed ?? 0} files
                  {s.last_sync && ` · synced ${new Date(s.last_sync).toLocaleDateString()}`}
                </div>
              </div>
              <span className={`as-status ${s.last_status === 'success' ? 'as-status--governed' : ''}`}>{s.last_status}</span>
            </div>
          ))}
          {sources.data && !sources.data.sources?.length && <p className="muted small">No sources yet.</p>}

          <div className="as-label sub-head">Connectors</div>
          {CONNECTORS.map((c) => {
            const st = sources.data?.[c.key];
            return (
              <div key={c.id} className="connector">
                <div className="connector__logo">{c.label.slice(0, 1)}</div>
                <div className="connector__main">
                  <div className="connector__name">{c.label}</div>
                  <div className="muted small">{st?.connected ? st.account : c.sub}</div>
                </div>
                {st?.connected ? (
                  <span className="as-status as-status--governed">Connected</span>
                ) : (
                  <button type="button" className="as-btn as-btn--secondary" onClick={() => void connect(c.id)}>
                    Connect
                  </button>
                )}
              </div>
            );
          })}
          <p className="muted small isolation-note">
            <Icon name="lock" size={12} /> Files stay in {workspace ?? 'this workspace'}. Connecting a source adds it to {project || 'this project'} only.
          </p>
        </section>
      </div>
    </div>
  );
}
