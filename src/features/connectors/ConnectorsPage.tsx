import { useEffect, useState } from 'react';
import { usePanel } from '../../app/panel';
import { useStudio } from '../../app/studio';
import { ConnectorLogo } from '../../components/ConnectorLogo';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { useTool } from '../../lib/useTool';

/** source_status, as the live gateway returns it (mcp-service tools.py t_source_status). */
export interface SourceStatus {
  project?: string;
  microsoft?: { connected: boolean; account?: string | null };
  google?: { connected: boolean; account?: string | null };
  sources?: { name: string; type: string; files_indexed?: number; last_sync?: string; last_status?: string }[];
  syncs?: SyncRun[];
}
export interface SyncRun {
  run_id: string;
  source?: string;
  status?: string;
  stage?: string;
  files_done?: number;
  files_total?: number;
  files_failed?: number;
  started?: string;
  error?: string;
}

type Source = 'onedrive' | 'sharepoint' | 'gdrive';
const PROVIDERS: { key: 'microsoft' | 'google'; label: string; about: string; sources: { id: Source; label: string }[] }[] = [
  { key: 'microsoft', label: 'Microsoft', about: 'OneDrive and SharePoint', sources: [{ id: 'onedrive', label: 'OneDrive' }, { id: 'sharepoint', label: 'SharePoint' }] },
  { key: 'google', label: 'Google Drive', about: 'My Drive and shared drives', sources: [{ id: 'gdrive', label: 'Google Drive' }] },
];

/** What Studio can't connect through the gateway yet, said plainly instead of offering buttons that do nothing. */
const NOT_YET = [
  { type: 'gmail', label: 'Gmail and Outlook mail' },
  { type: 'slack', label: 'Slack and Teams' },
  { type: 'postgres', label: 'Databases' },
  { type: 'mcp', label: 'MCP servers and APIs' },
];

const BUSY = new Set(['running', 'processing', 'pending', 'queued', 'in_progress', 'started']);

/** The sign-in link connect_source returns: in the result for apps without cards, else in the card data. */
function linkOf(r: unknown): string | undefined {
  const o = (r ?? {}) as { link?: string; __card?: { link?: string } };
  return o.link ?? o.__card?.link;
}

/**
 * Connectors: the file sources each project syncs from (the only connectors the
 * gateway has), with sign-in, browse and add, sync progress and retry.
 */
export function ConnectorsPage() {
  const { projects, defaultProject, workspace } = useStudio();
  const [project, setProject] = useState('');
  useEffect(() => {
    if (!project && projects.length) setProject(defaultProject ?? projects[0]?.name ?? '');
  }, [projects, defaultProject, project]);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Connectors</h1>
          <p className="page__sub">Where each project's documents come from. Files you add are synced and kept up to date.</p>
        </div>
      </div>

      <div className="project-tabs" role="tablist">
        {projects.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.name === project} className={p.name === project ? 'is-on' : ''} onClick={() => setProject(p.name)}>
            {p.name}
          </button>
        ))}
      </div>

      {project && <ProjectSources key={project} project={project} workspace={workspace} />}

      <div className="as-label sub-head">Not through ai/Studio's gateway yet</div>
      <div className="as-card cn-gap">
        <div className="cn-gap__logos">
          {NOT_YET.map((n) => (
            <span key={n.type} className="cn-gap__item">
              <ConnectorLogo type={n.type} size={22} /> {n.label}
            </span>
          ))}
        </div>
        <p className="muted small">
          Agents can use these when they are set up in Studio, but the gateway has no tools to list or connect them, so they can't be managed from here yet.
        </p>
      </div>
    </div>
  );
}

function ProjectSources({ project, workspace }: { project: string; workspace?: string }) {
  const st = useTool<SourceStatus>('source_status', { project });
  const { open } = usePanel();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ source: Source; warning: string } | null>(null);
  const d = st.data;
  const syncing = (d?.syncs ?? []).some((s) => BUSY.has(String(s.status).toLowerCase()));

  // Follow a running sync without a reload button.
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(() => st.reload(), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing]);

  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = (source: Source, reconnect = false) =>
    act(`connect-${source}`, async () => {
      const r = await callTool<{ status?: string; note?: string }>('connect_source', { project, source, ...(reconnect ? { reconnect: true } : {}) });
      const link = linkOf(r);
      if (r?.status === 'connected') {
        st.reload();
        return;
      }
      if (!link) throw new Error('Studio did not return a sign-in link. Try again.');
      window.open(link, '_blank', 'noopener');
      setMsg('Sign in in the new tab, then come back here. This page checks again when you return.');
      const back = () => {
        st.reload();
        window.removeEventListener('focus', back);
      };
      window.addEventListener('focus', back);
    });

  const askDisconnect = (source: Source) =>
    act(`disconnect-${source}`, async () => {
      const r = await callTool<{ status?: string; warning?: string; note?: string }>('disconnect_source', { project, source });
      if (r?.status === 'confirm') setConfirm({ source, warning: r.warning ?? 'Disconnect this account from the project?' });
      else setMsg(r?.note ?? null);
    });

  const disconnect = (source: Source) =>
    act(`disconnect-${source}`, async () => {
      const r = await callTool<{ note?: string }>('disconnect_source', { project, source, confirm: true });
      setConfirm(null);
      setMsg(r?.note ?? 'Disconnected.');
      st.reload();
    });

  const retry = (run: SyncRun) =>
    act(`retry-${run.run_id}`, async () => {
      const r = await callTool<{ note?: string }>('retry_file', { project, run_id: run.run_id });
      setMsg(r?.note ?? 'Retrying.');
      st.reload();
    });

  const browse = (source: Source, label: string) =>
    open({ title: `Add from ${label}`, body: <Browser project={project} source={source} label={label} onAdded={() => st.reload()} /> });

  if (st.error) return <p className="turn__error">{st.error}</p>;

  return (
    <>
      <div className="as-label sub-head">Accounts</div>
      <div className="cn-list">
        {PROVIDERS.map((pv) => {
          const s = d?.[pv.key];
          const on = Boolean(s?.connected);
          return (
            <div key={pv.key} className="as-card cn-row">
              <ConnectorLogo type={pv.sources[0]?.id ?? pv.key} size={36} />
              <div className="cn-row__main">
                <div className="as-card__title">{pv.label}</div>
                <div className="muted small">{st.loading && !d ? 'Checking…' : on ? s?.account || 'Connected' : pv.about}</div>
              </div>
              <div className="cn-row__actions">
                {on ? (
                  <>
                    {pv.sources.map((src) => (
                      <button key={src.id} type="button" className="as-btn as-btn--secondary" onClick={() => browse(src.id, src.label)}>
                        <Icon name="plus" size={12} /> Add from {src.label}
                      </button>
                    ))}
                    <button type="button" className="as-btn as-btn--ghost" disabled={busy !== null} onClick={() => void askDisconnect(pv.sources[0]!.id)}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button type="button" className="as-btn as-btn--primary" disabled={busy !== null || !d} onClick={() => void connect(pv.sources[0]!.id)}>
                    {busy === `connect-${pv.sources[0]!.id}` ? 'Opening…' : `Connect ${pv.label}`}
                  </button>
                )}
              </div>
              {confirm && pv.sources.some((x) => x.id === confirm.source) && (
                <div className="cn-confirm" role="alertdialog" aria-label={`Disconnect ${pv.label}`}>
                  <p className="small">{confirm.warning}</p>
                  <div className="cn-confirm__actions">
                    <button type="button" className="as-btn as-btn--ghost" onClick={() => setConfirm(null)}>
                      Keep connected
                    </button>
                    <button type="button" className="as-btn as-btn--danger" disabled={busy !== null} onClick={() => void disconnect(confirm.source)}>
                      Disconnect {pv.label}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {msg && <p className="muted small cn-msg">{msg}</p>}

      <div className="as-label sub-head">Synced into {project}</div>
      {d && !d.sources?.length && <p className="muted small">Nothing synced yet. Connect an account above and add folders or files.</p>}
      <div className="cn-list">
        {d?.sources?.map((s) => (
          <div key={s.name} className="as-card cn-row">
            <ConnectorLogo type={s.type.split('_')[0] ?? s.type} size={32} />
            <div className="cn-row__main">
              <div className="as-card__title">{s.name}</div>
              <div className="muted small">
                {s.type.replace(/_/g, ' ')} · {s.files_indexed ?? 0} files
                {s.last_sync && ` · synced ${new Date(s.last_sync).toLocaleString()}`}
              </div>
            </div>
            {s.last_status && <span className={`as-status ${s.last_status === 'success' ? 'as-status--governed' : ''}`}>{s.last_status === 'success' ? 'Up to date' : s.last_status}</span>}
          </div>
        ))}
      </div>

      {Boolean(d?.syncs?.length) && (
        <>
          <div className="as-label sub-head">Syncs</div>
          <div className="cn-list">
            {d?.syncs?.map((r) => {
              const total = r.files_total ?? 0;
              const pct = total ? Math.round(((r.files_done ?? 0) / total) * 100) : 0;
              const running = BUSY.has(String(r.status).toLowerCase());
              return (
                <div key={r.run_id} className="as-card cn-sync">
                  <div className="cn-sync__top">
                    <span className="as-card__title">{r.source ?? 'Sync'}</span>
                    <span className="muted small">
                      {r.files_done ?? 0} of {total} files{r.files_failed ? ` · ${r.files_failed} failed` : ''}
                      {r.stage ? ` · ${r.stage}` : ''}
                    </span>
                  </div>
                  <div className="cn-sync__bar" aria-label={`${pct}% done`}>
                    <span style={{ width: `${pct}%` }} className={running ? 'is-running' : ''} />
                  </div>
                  {r.error && <p className="small turn__error">{r.error}</p>}
                  {(Boolean(r.files_failed) || String(r.status).toLowerCase() === 'failed') && (
                    <button type="button" className="as-btn as-btn--secondary" disabled={busy !== null} onClick={() => void retry(r)}>
                      {busy === `retry-${r.run_id}` ? 'Retrying…' : r.files_failed ? `Retry ${r.files_failed} failed` : 'Retry sync'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="muted small isolation-note">
        <Icon name="lock" size={12} /> Files stay in {workspace ?? 'this workspace'}. A sign-in here is used for {project} only.
      </p>
    </>
  );
}

interface BrowseItem {
  id: string;
  name: string;
  kind?: string;
  drive_id?: string;
  site_id?: string;
  size?: number;
  modified?: string;
}
interface Crumb {
  label: string;
  where: Record<string, string>;
}

const MODES = [
  { id: 'summary_vlm_plus', label: 'Best for layouts', about: 'Slides, tables, charts and scanned pages' },
  { id: 'summary_vlm', label: 'Balanced', about: 'Most document collections' },
  { id: 'chunk_rag', label: 'Large text', about: 'Big, text-heavy collections' },
];

/** browse_source → choose folders or files → add_files. The person's press of Add is the confirmation. */
function Browser({ project, source, label, onAdded }: { project: string; source: Source; label: string; onAdded: () => void }) {
  const [trail, setTrail] = useState<Crumb[]>([{ label, where: {} }]);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [level, setLevel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Map<string, BrowseItem>>(new Map());
  const [mode, setMode] = useState('summary_vlm_plus');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string[] | null>(null);
  const here = trail[trail.length - 1]!;

  const load = async (where: Record<string, string>) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await callTool<{ items?: BrowseItem[]; level?: string }>('browse_source', { project, source, ...where });
      setItems(r?.items ?? []);
      setLevel(r?.level ?? '');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(here.where);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  const enter = (it: BrowseItem) => {
    const where: Record<string, string> = { ...here.where };
    if (it.kind === 'site') where.site_id = it.id;
    else if (it.kind === 'library') where.drive_id = it.drive_id ?? it.id;
    else where.folder_id = it.id;
    if (it.drive_id && it.kind !== 'library') where.drive_id = it.drive_id;
    if (it.site_id) where.site_id = it.site_id;
    delete where.search;
    setTrail([...trail, { label: it.name, where }]);
  };
  const canOpen = (it: BrowseItem) => it.kind !== 'file';
  // SharePoint syncs folders or whole libraries, not single files or sites.
  const canPick = (it: BrowseItem) => (source === 'sharepoint' ? it.kind === 'folder' || it.kind === 'library' : it.kind !== 'site');
  const toggle = (it: BrowseItem) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(it.id)) n.delete(it.id);
      else n.set(it.id, it);
      return n;
    });

  const add = async () => {
    setAdding(true);
    setErr(null);
    try {
      const r = await callTool<{ added?: string[] }>('add_files', { project, source, items: [...picked.keys()], rag_mode: mode });
      setAdded(r?.added ?? [...picked.values()].map((p) => p.name));
      setPicked(new Map());
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  if (added)
    return (
      <div className="browser">
        <p>
          <Icon name="check" /> Added {added.length} to {project}. Syncing has started; documents become searchable one by one.
        </p>
        <ul className="small">
          {added.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <button type="button" className="as-btn as-btn--secondary" onClick={() => setAdded(null)}>
          Add more
        </button>
      </div>
    );

  return (
    <div className="browser">
      <nav className="browser__trail" aria-label="Folders">
        {trail.map((c, i) => (
          <span key={i}>
            {i > 0 && <Icon name="chevron" size={10} />}
            <button type="button" className="as-btn as-btn--ghost" disabled={i === trail.length - 1} onClick={() => setTrail(trail.slice(0, i + 1))}>
              {c.label}
            </button>
          </span>
        ))}
      </nav>
      <form
        className="search search--sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) setTrail([...trail.slice(0, 1), { label: `“${q.trim()}”`, where: { search: q.trim() } }]);
        }}
      >
        <Icon name="search" />
        <input placeholder={source === 'sharepoint' && level !== 'libraries' ? 'Find a site' : 'Search by name, or paste a link'} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {err && <p className="turn__error small">{err}</p>}
      {loading ? (
        <p className="muted small">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted small">{source === 'sharepoint' && !here.where.site_id && !here.where.search ? 'Search for a site to start.' : 'Nothing here.'}</p>
      ) : (
        <ul className="browser__list">
          {items.map((it) => (
            <li key={it.id} className={picked.has(it.id) ? 'is-picked' : ''}>
              {canPick(it) ? (
                <input type="checkbox" aria-label={`Choose ${it.name}`} checked={picked.has(it.id)} onChange={() => toggle(it)} />
              ) : (
                <span className="browser__nopick" />
              )}
              <Icon name={it.kind === 'file' ? 'doc' : 'workspace'} size={14} />
              {canOpen(it) ? (
                <button type="button" className="browser__name" onClick={() => enter(it)}>
                  {it.name}
                </button>
              ) : (
                <span className="browser__name">{it.name}</span>
              )}
              <span className="muted small">{it.kind}</span>
            </li>
          ))}
        </ul>
      )}
      {picked.size > 0 && (
        <div className="browser__add">
          <div className="field">
            <span className="field__label">How Studio reads them</span>
            <div className="seg seg--wrap">
              {MODES.map((m) => (
                <button key={m.id} type="button" className={mode === m.id ? 'is-on' : ''} title={m.about} onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>
            <span className="muted small">{MODES.find((m) => m.id === mode)?.about}. Fixed once they're added.</span>
          </div>
          <button type="button" className="as-btn as-btn--primary" disabled={adding} onClick={() => void add()}>
            {adding ? 'Adding…' : `Add ${picked.size} to ${project}`}
          </button>
        </div>
      )}
    </div>
  );
}
