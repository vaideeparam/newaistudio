import { useState } from 'react';
import { Icon } from '../../components/Icon';

export interface AgentInput {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

/** prospect_profile → "Prospect profile" */
export const humanize = (name: string) => {
  const s = name.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Text the chat runtime fills in (e.g. "Supplied automatically by the chat runtime") is not for people. */
export const isRuntimeInput = (i: AgentInput) => /supplied automatically|callers do not pass/i.test(i.description ?? '');

const wantsJson = (i: AgentInput) => i.type === 'json' || /^\s*json\b/i.test(i.description ?? '');
const isLong = (i: AgentInput) => wantsJson(i) || (i.description?.length ?? 0) > 90 || /text|markdown|body/i.test(i.type);

/** Parses JSON-looking values so the agent gets objects and lists, and leaves plain text as text. */
function valueOf(i: AgentInput, raw: string): unknown {
  const t = raw.trim();
  if ((i.type === 'number' || i.type === 'integer') && t !== '' && Number.isFinite(Number(t))) return Number(t);
  if (wantsJson(i) && /^[[{]/.test(t)) {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return t;
}

function jsonProblem(i: AgentInput, raw: string): string | null {
  const t = raw.trim();
  if (!t || !wantsJson(i) || !/^[[{]/.test(t)) return null;
  try {
    JSON.parse(t);
    return null;
  } catch (e) {
    return `This isn't valid JSON yet (${e instanceof Error ? e.message.replace(/^JSON\.parse: /, '') : 'check brackets and quotes'}).`;
  }
}

/**
 * The run form for a DAG mind that takes inputs: one column, human labels,
 * the agent's own help text, required fields first and optional ones folded
 * away, JSON fields checked as you type.
 */
export function RunForm({
  inputs,
  agentName,
  onRun,
  footer,
}: {
  inputs: AgentInput[];
  agentName: string;
  onRun: (values: Record<string, unknown>, summary: string) => void;
  footer?: React.ReactNode;
}) {
  const fields = inputs.filter((i) => !isRuntimeInput(i));
  const required = fields.filter((i) => i.required);
  const optional = fields.filter((i) => !i.required);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showOptional, setShowOptional] = useState(optional.length <= 2);

  const missing = required.filter((i) => !values[i.name]?.trim());
  const problems = fields.map((i) => jsonProblem(i, values[i.name] ?? '')).filter(Boolean);
  const filledOptional = optional.filter((i) => values[i.name]?.trim()).length;
  const ready = missing.length === 0 && problems.length === 0;

  const submit = () => {
    if (!ready) {
      setTouched(Object.fromEntries(fields.map((i) => [i.name, true])));
      return;
    }
    const out: Record<string, unknown> = {};
    for (const i of fields) {
      const v = values[i.name];
      if (v?.trim()) out[i.name] = valueOf(i, v);
    }
    const first = required[0] ?? fields.find((i) => values[i.name]?.trim());
    // A JSON record reads better as its first few plain values ("Asha Rao, VP Supply Chain, Acme").
    const parsed = first ? out[first.name] : undefined;
    const firstVal =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.values(parsed as Record<string, unknown>).filter((x) => typeof x === 'string').slice(0, 3).join(', ')
        : first
          ? (values[first.name] ?? '').trim().replace(/\s+/g, ' ')
          : '';
    const summary = first ? `${humanize(first.name)}: ${firstVal.length > 90 ? firstVal.slice(0, 90) + '…' : firstVal}` : `Run ${agentName}`;
    onRun(out, summary);
  };

  const field = (i: AgentInput) => {
    const v = values[i.name] ?? '';
    const err = jsonProblem(i, v) ?? (touched[i.name] && i.required && !v.trim() ? 'Required' : null);
    const json = wantsJson(i);
    const id = `in-${i.name}`;
    return (
      <div key={i.name} className={`rf-field${err ? ' has-error' : ''}`}>
        <div className="rf-field__head">
          <label htmlFor={id} className="rf-field__label">
            {humanize(i.name)}
          </label>
          <span className={`rf-chip${i.required ? ' rf-chip--req' : ''}`}>{i.required ? 'Required' : 'Optional'}</span>
          {json && <span className="rf-chip rf-chip--type">JSON</span>}
        </div>
        {i.description && (
          <p className="rf-field__help" id={`${id}-help`}>
            {i.description}
          </p>
        )}
        {isLong(i) ? (
          <textarea
            id={id}
            className={`field__input rf-field__input${json ? ' as-mono' : ''}`}
            rows={json ? 4 : 3}
            value={v}
            spellCheck={!json}
            aria-describedby={i.description ? `${id}-help` : undefined}
            aria-invalid={!!err}
            placeholder={json ? (/list/i.test(i.description ?? '') ? '[ … ]  or plain text' : '{ … }  or plain text') : undefined}
            onChange={(e) => setValues((s) => ({ ...s, [i.name]: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, [i.name]: true }))}
          />
        ) : (
          <input
            id={id}
            className="field__input rf-field__input"
            value={v}
            type={i.type === 'date' ? 'date' : i.type === 'number' || i.type === 'integer' ? 'number' : 'text'}
            aria-describedby={i.description ? `${id}-help` : undefined}
            aria-invalid={!!err}
            onChange={(e) => setValues((s) => ({ ...s, [i.name]: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, [i.name]: true }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
        )}
        {err && <p className="rf-field__err">{err}</p>}
      </div>
    );
  };

  return (
    <form
      className="run-form"
      aria-label={`Run ${agentName}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {required.map(field)}
      {optional.length > 0 && (
        <>
          <button type="button" className="rf-more" aria-expanded={showOptional} onClick={() => setShowOptional((v) => !v)}>
            <Icon name="chevron" size={12} className={showOptional ? 'rot90' : ''} />
            {showOptional ? 'Optional details' : `Add optional details (${optional.length}${filledOptional ? `, ${filledOptional} filled` : ''})`}
          </button>
          {showOptional && <div className="rf-optional">{optional.map(field)}</div>}
        </>
      )}
      <div className="rf-actions">
        {footer}
        <span className="as-spacer" />
        {!ready && missing.length > 0 && <span className="muted small">{missing.length === 1 ? `Fill in ${humanize(missing[0]!.name).toLowerCase()}` : `${missing.length} required fields left`}</span>}
        <button type="submit" className={`as-btn as-btn--primary${ready ? "" : " is-blocked"}`}>
          <Icon name="play" size={13} /> Run
        </button>
      </div>
    </form>
  );
}
