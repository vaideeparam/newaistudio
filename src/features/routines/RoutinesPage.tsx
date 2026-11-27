import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStudio } from '../../app/studio';
import { Icon } from '../../components/Icon';
import { callTool } from '../../lib/mcp';
import { useTool } from '../../lib/useTool';

interface Schedule {
  schedule: string;
  agent: string;
  project?: string;
  name?: string;
  message?: string;
  when: string;
  state: 'active' | 'paused' | string;
  next_run?: string | null;
  last_run?: string;
}

/** Routines: agents that run on a schedule, like Routines in Claude web. */
export function RoutinesPage() {
  const { data, loading, error, reload } = useTool<{ schedules?: Schedule[]; summary?: string }>('list_schedules');
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const list = data?.schedules ?? [];

  const toggle = async (s: Schedule) => {
    const action = s.state === 'active' ? 'pause' : 'resume';
    await callTool('control_schedule', { schedule: s.schedule, action, confirmed: true });
    await reload();
  };
  const runNow = async (s: Schedule) => {
    await callTool('control_schedule', { schedule: s.schedule, action: 'run_now', confirmed: true });
    await reload();
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Routines</h1>
          <p className="page__sub">Agents that run on their own, on a schedule. {data?.summary}</p>
        </div>
        <button type="button" className="as-btn as-btn--primary" onClick={() => setParams({ new: '1' })}>
          <Icon name="plus" size={14} /> New routine
        </button>
      </div>

      {creating && (
        <NewRoutine
          initialAgent={params.get('agent') ?? undefined}
          onDone={async () => {
            setParams({});
            await reload();
          }}
          onCancel={() => setParams({})}
        />
      )}

      {loading && <p className="muted">Loading routines…</p>}
      {error && <p className="error">{error}</p>}

      <div className="routines">
        {list.map((s) => (
          <div key={s.schedule} className={`as-card routine${s.state !== 'active' ? ' is-paused' : ''}`}>
            <div className="routine__icon">
              <Icon name="routine" />
            </div>
            <div className="routine__main">
              <div className="as-card__title">{s.name ?? s.message ?? s.agent}</div>
              <div className="routine__when">{s.when}</div>
              <div className="routine__meta">
                <span>
                  <Icon name="agent" size={12} /> {s.agent}
                </span>
                {s.project && (
                  <span>
                    <Icon name="doc" size={12} /> {s.project}
                  </span>
                )}
                {s.last_run && <span>Last: {s.last_run}</span>}
              </div>
            </div>
            <div className="routine__side">
              <div className="routine__next">{s.state === 'active' && s.next_run ? `Next ${s.next_run}` : 'Paused'}</div>
              <div className="routine__actions">
                <button type="button" className="as-btn as-btn--ghost as-icon-btn" title="Run now" onClick={() => void runNow(s)}>
                  <Icon name="play" size={14} />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.state === 'active'}
                  className={`switch${s.state === 'active' ? ' is-on' : ''}`}
                  title={s.state === 'active' ? 'Pause' : 'Resume'}
                  onClick={() => void toggle(s)}
                >
                  <span />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const KINDS = [
  { v: 'daily', label: 'Every day' },
  { v: 'weekdays', label: 'Weekdays' },
  { v: 'weekly', label: 'Every week' },
  { v: 'hourly', label: 'Every few hours' },
] as const;

function NewRoutine({ initialAgent, onDone, onCancel }: { initialAgent?: string; onDone: () => void; onCancel: () => void }) {
  const { agents } = useStudio();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [name, setName] = useState('');
  const [agent, setAgent] = useState(initialAgent ?? '');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['v']>('weekdays');
  const [time, setTime] = useState('09:00');
  const [weekday, setWeekday] = useState('monday');
  const [hours, setHours] = useState(4);
  const [preview, setPreview] = useState<{ when?: string; next_runs?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!agent && agents[0]) setAgent(agents[0].name);
  }, [agents, agent]);
  useEffect(() => {
    setPreview(null);
  }, [agent, message, kind, time, weekday, hours]);

  const when =
    kind === 'daily'
      ? { kind: 'daily', time }
      : kind === 'weekly'
        ? { kind: 'weekly', weekday, time }
        : kind === 'hourly'
          ? { kind: 'every', every: hours, unit: 'hours' }
          : { kind: 'cron', expression: `${time.split(':')[1] ?? '0'} ${time.split(':')[0] ?? '9'} * * 1-5` };

  const call = async (confirmed: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await callTool<{ when?: string; next_runs?: string[] }>('schedule_agent', {
        agent,
        name: name || undefined,
        message,
        when,
        timezone: tz,
        ...(confirmed ? { confirmed: true } : {}),
      });
      if (confirmed) onDone();
      else setPreview(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="as-card new-routine">
      <div className="new-routine__grid">
        <label className="field">
          <span className="field__label">Name</span>
          <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning pipeline brief" />
        </label>
        <label className="field">
          <span className="field__label">Agent</span>
          <select className="field__input" value={agent} onChange={(e) => setAgent(e.target.value)}>
            {agents.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--wide">
          <span className="field__label">What should it do each time?</span>
          <textarea
            className="field__input"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Summarise yesterday's new documents and flag anything that changes our Q1 plan."
          />
        </label>
        <div className="field field--wide">
          <span className="field__label">When</span>
          <div className="seg">
            {KINDS.map((k) => (
              <button key={k.v} type="button" className={kind === k.v ? 'is-on' : ''} onClick={() => setKind(k.v)}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="when-row">
            {kind === 'weekly' && (
              <select className="field__input" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
            {kind === 'hourly' ? (
              <select className="field__input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                  <option key={h} value={h}>
                    every {h} h
                  </option>
                ))}
              </select>
            ) : (
              <input className="field__input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            )}
            <span className="muted small">{tz}</span>
          </div>
        </div>
      </div>

      {preview && (
        <div className="preview">
          <div className="as-label">Preview · nothing is scheduled yet</div>
          <div className="preview__when">{preview.when}</div>
          {preview.next_runs && <div className="muted small">Next runs: {preview.next_runs.join(' · ')}</div>}
        </div>
      )}
      {err && <p className="error">{err}</p>}

      <div className="new-routine__foot">
        <span className="muted small">
          <Icon name="shield" size={12} /> Runs as you, with your access, inside this workspace.
        </span>
        <span className="as-spacer" />
        <button type="button" className="as-btn as-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {preview ? (
          <button type="button" className="as-btn as-btn--primary" disabled={busy} onClick={() => void call(true)}>
            <Icon name="check" size={14} /> Create routine
          </button>
        ) : (
          <button type="button" className="as-btn as-btn--primary" disabled={busy || !agent || !message.trim()} onClick={() => void call(false)}>
            Preview
          </button>
        )}
      </div>
    </div>
  );
}
