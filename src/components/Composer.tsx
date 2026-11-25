import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStudio } from '../app/studio';
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
}

export function Composer({ target, onTargetChange, onSubmit, placeholder, disabled, autoFocus, lockTarget }: Props) {
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [plus, setPlus] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled || !target) return;
    onSubmit(t);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
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
        aria-label="Message"
      />
      <div className="as-composer__bar">
        <div className="pop-anchor">
          <button type="button" className="as-btn as-btn--ghost as-icon-btn" aria-label="Add files or connect a source" onClick={() => setPlus((v) => !v)}>
            <Icon name="plus" />
          </button>
          {plus && (
            <div className="as-menu pop pop--up" onMouseLeave={() => setPlus(false)}>
              <div className="as-menu__item"><Icon name="upload" /> Upload files</div>
              <div className="as-menu__item"><Icon name="plug" /> Connect OneDrive or SharePoint</div>
              <div className="as-menu__item"><Icon name="plug" /> Connect Google Drive</div>
              <div className="as-menu__item"><Icon name="doc" /> Paste text as a document</div>
            </div>
          )}
        </div>
        <TargetChip target={target} open={picker} setOpen={setPicker} onChange={onTargetChange} locked={lockTarget} />
        <span className="as-spacer" />
        <button type="button" className="as-send" aria-label="Send" disabled={!text.trim() || disabled || !target} onClick={submit}>
          <Icon name="send" />
        </button>
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
