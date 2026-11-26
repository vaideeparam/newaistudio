import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../app/studio';
import { ConnectorLogo } from './ConnectorLogo';
import type { Target } from '../features/chat/store';
import { Icon } from './Icon';

interface Props {
  target: Target | null;
  onTargetChange?: (t: Target) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Once a conversation has started its target is fixed, like a model in Claude web. */
  lockTarget?: boolean;
  /** Connector ids switched on for this conversation. */
  connectors?: string[];
  onConnectorsChange?: (ids: string[]) => void;
  /** A reply is being written: the send button becomes Stop. */
  running?: boolean;
  onStop?: () => void;
}

/** Phones and tablets: Return adds a line, the send button sends (as in Claude's apps). */
const touch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function Composer({ target, onTargetChange, onSubmit, placeholder, disabled, autoFocus, lockTarget, connectors = [], onConnectorsChange, running, onStop }: Props) {
  const { connectors: all } = useStudio();
  const on = all.filter((c) => connectors.includes(c.id));
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [plus, setPlus] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  // IME (Japanese, Chinese, Korean, Indic keyboards): Enter confirms the word, it must never send.
  const composing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [text]);

  const canSend = !!text.trim() && !disabled && !running && !!target;
  const submit = () => {
    if (!canSend) return;
    onSubmit(text.trim());
    setText('');
    ref.current?.focus();
  };

  /**
   * Enter sends only when it can't be mistaken for anything else: not with
   * Shift/Alt/Ctrl (new line), not mid-composition, not on a touch keyboard,
   * and not while a reply is still being written (the text stays put).
   */
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.altKey || e.ctrlKey) return;
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (touch()) return;
    e.preventDefault();
    if (e.metaKey || canSend) submit();
  };

  return (
    <div className="as-composer">
      <textarea
        ref={ref}
        className="as-composer__input"
        rows={1}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Ask anything, or describe an agent to build…'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => {
          // Some browsers fire the confirming Enter's keydown right after compositionend.
          setTimeout(() => (composing.current = false), 0);
        }}
        enterKeyHint="enter"
        aria-label="Message"
      />
      <div className="as-composer__bar">
        <div className="pop-anchor">
          <button
            type="button"
            className={`as-btn as-btn--ghost as-icon-btn${plus ? ' is-pressed' : ''}`}
            aria-label="Add files, or switch connectors on"
            aria-expanded={plus}
            onClick={() => setPlus((v) => !v)}
          >
            <Icon name="plus" />
          </button>
          {plus && (
            <PlusMenu
              selected={connectors}
              onToggle={
                onConnectorsChange
                  ? (id) => onConnectorsChange(connectors.includes(id) ? connectors.filter((x) => x !== id) : [...connectors, id])
                  : undefined
              }
              onClose={() => setPlus(false)}
            />
          )}
        </div>
        <TargetChip target={target} open={picker} setOpen={setPicker} onChange={onTargetChange} locked={lockTarget} />
        {on.length > 0 && (
          <div className="cn-on" title={on.map((c) => c.name).join(', ')}>
            {on.slice(0, 4).map((c) => (
              <ConnectorLogo key={c.id} type={c.type} size={20} />
            ))}
            <span>{on.length === 1 ? on[0]!.name : `${on.length} connectors`}</span>
          </div>
        )}
        <span className="as-spacer" />
        {running && onStop ? (
          <button type="button" className="as-send as-send--stop" aria-label="Stop" title="Stop" onClick={onStop}>
            <span className="stop-square" />
          </button>
        ) : (
          <button type="button" className="as-send" aria-label="Send" title="Send" disabled={!canSend} onClick={submit}>
            <Icon name="send" />
          </button>
        )}
      </div>
    </div>
  );
}

function TargetChip({
  target,
  open,
  setOpen,
  onChange,
  locked,
}: {
  target: Target | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onChange?: (t: Target) => void;
  locked?: boolean;
}) {
  const { projects, agents } = useStudio();
  const [q, setQ] = useState('');
  const ql = q.toLowerCase();
  const p = useMemo(() => projects.filter((x) => x.name.toLowerCase().includes(ql)), [projects, ql]);
  const a = useMemo(() => agents.filter((x) => x.name.toLowerCase().includes(ql)), [agents, ql]);
  const pick = (t: Target) => {
    onChange?.(t);
    setOpen(false);
    setQ('');
  };

  return (
    <div className="pop-anchor">
      <button
        type="button"
        className="target-chip"
        disabled={locked}
        onClick={() => setOpen(!open)}
        title={locked ? 'This conversation stays with its project or agent' : 'Choose a project or agent'}
      >
        <Icon name={target?.kind === 'agent' ? 'agent' : 'doc'} size={14} />
        <span>{target ? target.name : 'Choose a project or agent'}</span>
        {!locked && <Icon name="down" size={12} />}
      </button>
      {open && (
        <div className="as-menu pop pop--up target-menu">
          <input className="target-menu__search" autoFocus placeholder="Search projects and agents" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="target-menu__list">
            {p.length > 0 && <div className="as-label target-menu__head">Ask a project's documents</div>}
            {p.map((x) => (
              <div key={x.id} className="as-menu__item" onClick={() => pick({ kind: 'project', name: x.name })}>
                <Icon name="doc" />
                <span className="target-menu__name">{x.name}</span>
                {x.documents != null && <span className="target-menu__meta">{x.documents} docs</span>}
              </div>
            ))}
            {a.length > 0 && <div className="as-label target-menu__head">Run an agent</div>}
            {a.map((x) => (
              <div key={x.id} className="as-menu__item" onClick={() => pick({ kind: 'agent', name: x.name, id: x.id })}>
                <Icon name="agent" />
                <span className="target-menu__name">{x.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlusMenu({ selected, onToggle, onClose }: { selected: string[]; onToggle?: (id: string) => void; onClose: () => void }) {
  const { connectors } = useStudio();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const key = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="as-menu pop pop--up plus-menu">
      <div className="as-menu__item">
        <Icon name="upload" /> Add files from your computer
      </div>
      <div className="as-menu__item">
        <Icon name="doc" /> Paste text as a document
      </div>
      <div className="plus-menu__sep" />
      <div className="as-label target-menu__head">Connectors</div>
      {connectors.length === 0 && <div className="muted small plus-menu__empty">None connected yet.</div>}
      <div className="plus-menu__list">
        {connectors.map((c) => {
          const ready = c.status === 'connected';
          const isOn = selected.includes(c.id);
          return (
            <div key={c.id} className={`as-menu__item cn-item${ready ? '' : ' is-off'}`} onClick={() => ready && onToggle?.(c.id)}>
              <ConnectorLogo type={c.type} size={24} />
              <span className="cn-item__text">
                <span className="cn-item__name">{c.name}</span>
                <span className="cn-item__sub">{ready ? c.account : 'Sign-in expired'}</span>
              </span>
              {ready ? (
                onToggle && (
                  <span role="switch" aria-checked={isOn} className={`switch switch--sm${isOn ? ' is-on' : ''}`}>
                    <span />
                  </span>
                )
              ) : (
                <span className="cn-item__fix">Reconnect</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="plus-menu__sep" />
      <Link to="/connectors" className="as-menu__item" onClick={onClose}>
        <Icon name="plug" /> Manage connectors
      </Link>
    </div>
  );
}
