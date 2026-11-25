import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { useTool } from '../../lib/useTool';
import { useChats } from '../chat/store';
import { Graph, type GEdge, type GNode } from './Graph';

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

  const connect = async (source: string) => {
    const r = await callTool<{ link?: string; sign_in?: string }>('connect_source', { project, source });
    const link = r?.link ?? r?.sign_in;
    if (link) window.open(link, '_blank', 'noopener');
  };

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Knowledge</h1>
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
            <span className="as-label">Knowledge graph</span>
            <span className="legend-dots">
              <i className="g-product" /> product <i className="g-concept" /> concept <i className="g-customer" /> customer
              <i className="g-initiative" /> initiative <i className="g-event" /> event
            </span>
          </div>
          {nodes.length > 0 ? (
            <Graph nodes={nodes} edges={edges} selected={sel} onSelect={setSel} />
          ) : (
            <p className="muted">{graph.loading ? 'Reading the graph…' : 'No graph yet. It is built as documents are added.'}</p>
          )}
          {node && (
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
