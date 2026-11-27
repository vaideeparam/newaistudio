import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { useTool } from '../../lib/useTool';
import { useChats } from '../chat/store';
import type { SourceStatus } from '../connectors/ConnectorsPage';

/** project_status, as the live gateway returns it. */
interface ProjectStatus {
  status?: string;
  documents?: number;
  ready_documents?: number;
  failed_documents?: number;
  sources?: number;
  next_step?: string;
}
interface Doc {
  id: string;
  name: string;
  status?: string;
  source?: string;
  pages?: number;
  added?: string;
  error?: string;
}
interface DocPage {
  documents?: Doc[];
  total?: number;
  next_page?: string;
}

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
] as const;

const STATUS_LABEL: Record<string, string> = { ready: 'Ready', processing: 'Processing', waiting: 'Waiting', failed: 'Failed' };

/**
 * Knowledge: what each project knows. Readiness, every document with its
 * status (search, filter, retry), where they came from, and a way to ask.
 */
export function KnowledgePage() {
  const { projects, defaultProject } = useStudio();
  const [project, setProject] = useState('');
  useEffect(() => {
    if (!project && projects.length) setProject(defaultProject ?? projects[0]?.name ?? '');
  }, [projects, defaultProject, project]);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Knowledge</h1>
          <p className="page__sub">What each project knows: its documents, how they're doing, and where they came from.</p>
        </div>
      </div>
      <div className="project-tabs" role="tablist">
        {projects.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.name === project} className={p.name === project ? 'is-on' : ''} onClick={() => setProject(p.name)}>
            {p.name}
            {p.documents != null && <span className="count">{p.documents}</span>}
          </button>
        ))}
      </div>
      {project && <ProjectKnowledge key={project} project={project} />}
    </div>
  );
}

function ProjectKnowledge({ project }: { project: string }) {
  const { workspace } = useStudio();
  const { start } = useChats();
  const nav = useNavigate();
  const status = useTool<ProjectStatus>('project_status', { project });
  const sources = useTool<SourceStatus>('source_status', { project });
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = async (more?: string) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await callTool<DocPage>('search_documents', {
        project,
        ...(search ? { search } : {}),
        ...(filter ? { status: filter } : {}),
        ...(more ? { next_page: more } : {}),
      });
      setDocs((d) => (more ? [...d, ...(r?.documents ?? [])] : r?.documents ?? []));
      setTotal(r?.total ?? r?.documents?.length);
      setNext(r?.next_page);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, search, filter]);

  const askProject = (question: string) => nav(`/c/${start({ kind: 'project', name: project }, question, workspace)}`);
  const retry = async (d: Doc) => {
    setRetrying(d.id);
    setNote(null);
    try {
      const r = await callTool<{ note?: string }>('retry_file', { project, document: d.id });
      setNote(r?.note ?? `Retrying ${d.name}.`);
      void load();
      status.reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(null);
    }
  };

  const s = status.data;
  const pct = s?.documents ? Math.round(((s.ready_documents ?? 0) / s.documents) * 100) : 0;

  return (
    <div className="kn">
      <section className="kn__stats">
        <div className="as-card kn-stat">
          <span className="kn-stat__n">{s?.documents ?? '—'}</span>
          <span className="muted small">documents</span>
        </div>
        <div className="as-card kn-stat">
          <span className="kn-stat__n">{s?.ready_documents ?? '—'}</span>
          <span className="muted small">ready to answer from{s?.documents ? ` · ${pct}%` : ''}</span>
        </div>
        <button type="button" className={`as-card kn-stat${s?.failed_documents ? ' kn-stat--warn' : ''}`} disabled={!s?.failed_documents} onClick={() => setFilter('failed')}>
          <span className="kn-stat__n">{s?.failed_documents ?? '—'}</span>
          <span className="muted small">failed{s?.failed_documents ? ' · show them' : ''}</span>
        </button>
        <div className="as-card kn-stat">
          <span className="kn-stat__n">{sources.data?.sources?.length ?? s?.sources ?? '—'}</span>
          <span className="muted small">
            sources · <Link to="/connectors">manage</Link>
          </span>
        </div>
      </section>
      {status.error && <p className="turn__error small">{status.error}</p>}
      {s?.status && s.status !== 'ready' && <p className="muted small">This project is still being set up ({s.status}). Documents appear as they're processed.</p>}

      <form
        className="kn-ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (ask.trim()) askProject(ask.trim());
        }}
      >
        <Icon name="spark" />
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={`Ask ${project} a question, answered from its documents with sources`} />
        <button type="submit" className="as-btn as-btn--primary" disabled={!ask.trim()}>
          Ask
        </button>
      </form>

      <section className="as-card kn-docs">
        <div className="kn-docs__head">
          <div className="seg seg--wrap" role="tablist" aria-label="Status">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? 'is-on' : ''} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <form
            className="search search--sm"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
            }}
          >
            <Icon name="search" />
            <input placeholder="Find a document by name" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        </div>
        <div className="muted small kn-docs__count">
          {total != null ? `${docs.length} of ${total}${filter ? ` ${STATUS_LABEL[filter]?.toLowerCase()}` : ''} documents${search ? ` matching “${search}”` : ''}` : ''}
        </div>
        {err && <p className="turn__error small">{err}</p>}
        {note && <p className="muted small">{note}</p>}
        <ul className="kn-list">
          {docs.map((d) => (
            <li key={d.id} className="kn-doc">
              <Icon name="doc" size={14} />
              <div className="kn-doc__main">
                <div className="kn-doc__name" title={d.name}>
                  {d.name}
                </div>
                <div className="muted small">
                  {[d.source?.replace(/_/g, ' '), d.pages != null ? `${d.pages} page${d.pages === 1 ? '' : 's'}` : '', d.added ? `added ${new Date(d.added).toLocaleDateString()}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {d.error && <div className="small turn__error">{d.error}</div>}
              </div>
              <span className={`as-status${d.status === 'ready' ? ' as-status--governed' : d.status === 'failed' ? ' as-status--failed' : ''}`}>{STATUS_LABEL[d.status ?? ''] ?? d.status}</span>
              {d.status === 'failed' ? (
                <button type="button" className="as-btn as-btn--secondary kn-doc__act" disabled={retrying !== null} onClick={() => void retry(d)}>
                  {retrying === d.id ? 'Retrying…' : 'Retry'}
                </button>
              ) : (
                <button type="button" className="as-btn as-btn--ghost kn-doc__act" disabled={d.status !== 'ready'} onClick={() => askProject(`Summarise "${d.name}": what it covers and its key points.`)}>
                  Ask about it
                </button>
              )}
            </li>
          ))}
        </ul>
        {loading && <p className="muted small">Loading…</p>}
        {!loading && !docs.length && !err && <p className="muted small">{search || filter ? 'No documents match.' : 'No documents yet. Add some from Connectors.'}</p>}
        {next && !loading && (
          <button type="button" className="as-btn as-btn--secondary" onClick={() => void load(next)}>
            Show more
          </button>
        )}
      </section>

      <p className="muted small kn-gap">
        <Icon name="graph" size={12} /> Studio also builds a knowledge graph from these documents (people, products, topics and how they link). The gateway has no tool to read it yet, so it isn&rsquo;t drawn here.
      </p>
    </div>
  );
}
