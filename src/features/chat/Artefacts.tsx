import { useEffect, useState } from 'react';
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
          onClick={() => open({ title: a.title, wide: true, body: <ArtefactViewer a={a} project={project} /> })}
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

export function ArtefactViewer({ a, project }: { a: Artefact; project?: string }) {
  const [html, setHtml] = useState<string | undefined>(a.html ?? (isHtml(a.content) ? a.content : undefined));
  const [text, setText] = useState<string | undefined>(a.content);
  const [loading, setLoading] = useState(!html && !!a.artefact_key);
  const [full, setFull] = useState(false);
  const [save, setSave] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [name, setName] = useState(a.title);
  const [err, setErr] = useState<string | null>(null);

  // Ask Studio for the page itself: show_artefact may carry the HTML as an MCP-UI resource.
  useEffect(() => {
    if (html || !a.artefact_key) return;
    let live = true;
    callTool<ShowResult>('show_artefact', { artefact_key: a.artefact_key, ...(project ? { project } : {}) })
      .then((r) => {
        if (!live) return;
        const res = r?.__resources?.find((x) => /html/.test(x.mimeType ?? '') && x.text);
        const page = res?.text ?? r?.html ?? (isHtml(r?.content) ? r?.content : undefined);
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
  }, [a.artefact_key, html, project]);

  const download = () => {
    const blob = new Blob([html ?? text ?? ''], { type: html ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = html ? a.title.replace(/(\.html?)?$/i, '.html') : a.title.replace(/\.html?$/i, '') + '.txt';
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
        <button type="button" className="as-btn as-btn--ghost as-icon-btn" onClick={download} aria-label="Download" title="Download">
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
        <div className="arte-text">
          <p className="arte-text__note">
            Studio sent this page's text only, so it's shown as a reading view. The full page (charts, tiles, layout) appears here once the gateway returns its HTML.
          </p>
          {(text ?? '').split('\n').map((l, i) => {
            const t = l.trim();
            if (!t) return null;
            const head = t.length < 60 && !/[.!?:]$/.test(t);
            return head ? (
              <h3 key={i} className="arte-text__h">
                {t}
              </h3>
            ) : (
              <p key={i}>{t}</p>
            );
          })}
        </div>
      )}
    </div>
  );
}
