import { useEffect, useRef, useState } from 'react';
import { usePanel } from '../../app/panel';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import type { Artefact } from './store';

interface ShowResult {
  name?: string;
  content?: string;
  html?: string;
  format?: string;
  __resources?: { uri?: string; mimeType?: string; text?: string }[];
  /** The whole artefact, from the result's card-only _meta (mcp-service viewer_app.py). */
  __page?: { format?: string; content?: string };
  /** The whole artefact, when asked for with include_page (gateway patch 02). */
  page?: { format?: string; content?: string };
}

const isHtml = (s?: string) => !!s && /^\s*(<!doctype|<html|<div|<section|<body|<head|<style)/i.test(s);

/**
 * Artefacts an answer made, shown inline under it like Claude's artifact
 * cards. Opening one shows it in the side pane (the whole screen on a
 * phone): the page itself in a sandboxed frame when the gateway sends its
 * HTML, otherwise its text, laid out for reading.
 */
export function ArtefactCards({ artefacts, project }: { artefacts: Artefact[]; project?: string }) {
  const { open } = usePanel();
  if (!artefacts.length) return null;
  return (
    <div className="arte-list">
      {artefacts.map((a, i) => (
        <button
          key={a.artefact_key ?? i}
          type="button"
          className="arte-card"
          onClick={() => open({ title: prettyTitle(a.title), wide: true, body: <ArtefactViewer a={a} project={project} /> })}
        >
          <span className="arte-card__icon">
            <Icon name="page" size={18} />
          </span>
          <span className="arte-card__text">
            <span className="arte-card__title">{prettyTitle(a.title)}</span>
            <span className="arte-card__meta">
              {(a.type ?? 'page').toUpperCase()} · {firstLine(a.content) ?? 'Made by Studio'}
            </span>
          </span>
          <span className="arte-card__open">Open</span>
        </button>
      ))}
    </div>
  );
}

const prettyTitle = (t: string) => {
  const s = t.replace(/\.html?$/i, '').replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const firstLine = (s?: string) => s?.split('\n').find((l) => l.trim().length > 12)?.slice(0, 70);

// Newer gateways return the whole page in the result when asked (include_page); older ones reject the flag,
// so it is tried once and then left off. The page may also arrive in the card data (__page).
let includePage = true;
async function showArtefact(key: string, project?: string): Promise<ShowResult> {
  const base = { artefact_key: key, ...(project ? { project } : {}) };
  if (includePage) {
    try {
      return await callTool<ShowResult>('show_artefact', { ...base, include_page: true });
    } catch (e) {
      if (!/include_page|unexpected|unknown|additional|invalid/i.test(e instanceof Error ? e.message : String(e))) throw e;
      includePage = false;
    }
  }
  return callTool<ShowResult>('show_artefact', base);
}

export function ArtefactViewer({ a, project }: { a: Artefact; project?: string }) {
  const [html, setHtml] = useState<string | undefined>(a.html ?? (isHtml(a.content) ? a.content : undefined));
  const [text, setText] = useState<string | undefined>(a.content);
  const [loading, setLoading] = useState(!html && !!a.artefact_key);
  const [full, setFull] = useState(false);
  const [save, setSave] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [name, setName] = useState(a.title);
  const [err, setErr] = useState<string | null>(null);

  // Ask Studio for the page itself: show_artefact may carry the HTML as an MCP-UI resource.
  // Runs once per artefact: setting the page must not cancel the request that brought it (that left "Opening…").
  const known = useRef(Boolean(html));
  useEffect(() => {
    if (known.current || !a.artefact_key) return;
    let live = true;
    showArtefact(a.artefact_key, project)
      .then((r) => {
        if (!live) return;
        const res = r?.__resources?.find((x) => /html/.test(x.mimeType ?? '') && x.text);
        const card = r?.page ?? r?.__page;
        const whole = card?.format === 'html' ? card.content : undefined;
        const page = whole ?? res?.text ?? r?.html ?? (isHtml(r?.content) ? r?.content : undefined);
        if (!page && card?.content) {
          setText(card.content);
          return;
        }
        if (page) setHtml(page);
        else if (r?.content) setText(r.content);
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [a.artefact_key, project]);

  const download = async () => {
    const filename = html ? a.title.replace(/(\.html?)?$/i, '.html') : a.title.replace(/\.html?$/i, '') + '.txt';
    const data = new Blob([html ?? text ?? ''], { type: html ? 'text/html' : 'text/plain' });
    // Inside claude.ai the page can't download directly: the viewer's downloads capability asks the person.
    const claude = (window as unknown as { claude?: { use(n: string): Promise<{ save(r: { filename: string; data: Blob }): Promise<unknown> } | null> } }).claude;
    if (claude?.use) {
      const dl = await claude.use('downloads').catch(() => null);
      if (dl) {
        await dl.save({ filename, data }).catch(() => undefined);
        return;
      }
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doSave = async () => {
    setSave('busy');
    setErr(null);
    try {
      await callTool('save_artefact', { name, artefact_key: a.artefact_key, ...(project ? { project } : {}) });
      setSave('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSave('confirm');
    }
  };

  return (
    <div className={`arte-view${full ? ' is-full' : ''}`}>
      <div className="arte-view__bar">
        {full && <span className="arte-view__title">{a.title}</span>}
        <span className="as-spacer" />
        {a.artefact_key && save === 'idle' && (
          <button type="button" className="as-btn as-btn--ghost" onClick={() => setSave('confirm')}>
            Save to project
          </button>
        )}
        {save === 'done' && <span className="as-status as-status--governed">Saved</span>}
        <button type="button" className="as-btn as-btn--ghost as-icon-btn" onClick={() => void download()} aria-label="Download" title="Download">
          <Icon name="download" size={15} />
        </button>
        <button type="button" className="as-btn as-btn--ghost as-icon-btn" onClick={() => setFull((v) => !v)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
          <Icon name={full ? 'close' : 'expand'} size={15} />
        </button>
      </div>
      {(save === 'confirm' || save === 'busy') && (
        <div className="confirm">
          <p>Keep this in {project ?? 'the project'}'s saved artefacts?</p>
          <div className="save-row">
            <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            <button type="button" className="as-btn as-btn--primary" onClick={() => void doSave()} disabled={save === 'busy' || !name.trim()}>
              {save === 'busy' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="as-btn as-btn--ghost" onClick={() => setSave('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {err && <div className="as-callout as-callout--error">{err}</div>}

      {loading ? (
        <p className="muted">Opening…</p>
      ) : html ? (
        // No allow-same-origin: the page runs its own scripts but can't reach this app or its data.
        <iframe className="arte-frame" title={a.title} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={html} />
      ) : (
        <PageText text={text ?? ''} />
      )}
    </div>
  );
}

type Block = { k: 'title' | 'lede' | 'h' | 'sub' | 'p' | 'foot'; t: string } | { k: 'tiles'; items: string[] };

const isSentence = (l: string) => l.length >= 70 || /[.!?]["')]?$/.test(l);
const isFormula = (l: string) => /[=×÷]|\(.*[+/].*\)|\b[A-Z]{2,}\s*\/\s*/.test(l);

/** Turns the text of a page Studio made into a laid-out document: title, lede, sections, tiles for short facts. */
export function pageBlocks(text: string): Block[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: Block[] = [];
  let i = 0;
  if (lines[0]) out.push({ k: 'title', t: lines[i++]! });
  if (lines[i] && isSentence(lines[i]!) && lines[i]!.length < 260) out.push({ k: 'lede', t: lines[i++]! });
  while (i < lines.length) {
    const l = lines[i]!;
    if (/^generated (in|by)\b/i.test(l)) {
      out.push({ k: 'foot', t: l });
      i++;
      continue;
    }
    if (isSentence(l)) {
      out.push({ k: 'p', t: l });
      i++;
      continue;
    }
    const run: string[] = [];
    while (i < lines.length && !isSentence(lines[i]!) && !/^generated (in|by)\b/i.test(lines[i]!)) run.push(lines[i++]!);
    const beforeParagraph = i < lines.length && isSentence(lines[i]!) && !/^generated (in|by)\b/i.test(lines[i]!);
    const tail = beforeParagraph && run.length > 2 ? run.pop() : undefined;
    if (run.length <= 2) {
      out.push({ k: 'h', t: run[0]! });
      if (run[1]) out.push({ k: 'sub', t: run[1] });
    } else {
      // A plain line right before formulas names them ("Key formula"); otherwise the first line heads the group.
      let tiles: string[] = [];
      run.forEach((t, j) => {
        const next = run[j + 1];
        const headsFormulas = !isFormula(t) && next !== undefined && isFormula(next) && (j === 0 || !isFormula(run[j - 1]!) || tiles.length > 0);
        if ((j === 0 && !isFormula(t) && run.length > 3) || (headsFormulas && tiles.length > 0)) {
          if (tiles.length) out.push({ k: 'tiles', items: tiles });
          tiles = [];
          out.push({ k: 'h', t });
        } else tiles.push(t);
      });
      if (tiles.length) out.push({ k: 'tiles', items: tiles });
    }
    if (tail) out.push({ k: 'h', t: tail });
  }
  return out;
}

function PageText({ text }: { text: string }) {
  const blocks = pageBlocks(text);
  return (
    <div className="arte-text">
      <p className="arte-text__note">Text view. Studio sends this page's words but not its design yet.</p>
      <article className="arte-doc">
        {blocks.map((b, i) =>
          b.k === 'tiles' ? (
            <div key={i} className="arte-doc__tiles">
              {b.items.map((t, j) => (
                <div key={j} className={`arte-doc__tile${isFormula(t) ? ' is-formula' : ''}`}>
                  {t}
                </div>
              ))}
            </div>
          ) : b.k === 'title' ? (
            <h1 key={i} className="arte-doc__title">
              {b.t}
            </h1>
          ) : b.k === 'h' ? (
            <h2 key={i} className="arte-doc__h">
              {b.t}
            </h2>
          ) : (
            <p key={i} className={`arte-doc__${b.k}`}>
              {b.t}
            </p>
          ),
        )}
      </article>
    </div>
  );
}
