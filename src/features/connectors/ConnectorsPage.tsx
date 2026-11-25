import { useMemo, useState } from 'react';
import { usePanel } from '../../app/panel';
import { useStudio, type ConnectorType } from '../../app/studio';
import { ConnectorLogo } from '../../components/ConnectorLogo';
import { Icon } from '../../components/Icon';

const SCOPE_LABEL: Record<string, string> = {
  workspace: 'Whole workspace',
  project: 'Project',
  personal: 'Only you',
};

/**
 * Connectors: the named connections already set up (Gmail inbox, Slack,
 * databases, MCP servers), who can use them and with what access, plus a
 * catalog to add more. In chat they are switched on from the composer's + menu.
 */
export function ConnectorsPage() {
  const { connectors, catalog, workspace } = useStudio();
  const { open } = usePanel();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const m = new Map<string, ConnectorType[]>();
    catalog
      .filter((c) => (c.label + ' ' + (c.about ?? '')).toLowerCase().includes(q.toLowerCase()))
      .forEach((c) => m.set(c.group, [...(m.get(c.group) ?? []), c]));
    return [...m.entries()];
  }, [catalog, q]);
  const label = (type: string) => catalog.find((c) => c.type === type)?.label ?? type;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="as-display page__title">Connectors</h1>
          <p className="page__sub">Apps, files, databases and MCP servers your agents and chats can use. Switch them on in a chat from the + menu.</p>
        </div>
      </div>

      <div className="as-label sub-head">Connected in {workspace ?? 'this workspace'}</div>
      <div className="cn-list">
        {connectors.map((c) => (
          <div key={c.id} className="as-card cn-row">
            <ConnectorLogo type={c.type} size={36} />
            <div className="cn-row__main">
              <div className="as-card__title">{c.name}</div>
              <div className="muted small">
                {label(c.type)} · {c.account}
              </div>
            </div>
            <div className="cn-row__facts">
              <span className="pill" title="Who can use it">
                <Icon name="lock" size={10} /> {SCOPE_LABEL[c.scope ?? ''] ?? c.scope}
                {c.scope === 'project' && c.projects?.length ? `: ${c.projects.join(', ')}` : ''}
              </span>
              <span className={`pill${c.access === 'read_write' ? ' pill--write' : ''}`}>{c.access === 'read_write' ? 'read & write' : 'read only'}</span>
              {c.tools != null && <span className="pill">{c.tools} tools</span>}
            </div>
            {c.status === 'connected' ? (
              <span className="as-status as-status--governed">Connected</span>
            ) : (
              <button type="button" className="as-btn as-btn--secondary cn-row__fix">
                Reconnect
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="cn-catalog-head">
        <div className="as-label">Add a connector</div>
        <label className="search search--sm">
          <Icon name="search" />
          <input placeholder="Search connectors" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {groups.map(([group, items]) => (
        <div key={group} className="cn-group">
          <div className="cn-group__name">{group}</div>
          <div className="grid">
            {items.map((t) => (
              <button
                key={t.type}
                type="button"
                className="as-card cn-tile"
                onClick={() => open({ title: `Connect ${t.label}`, body: <ConnectForm type={t} workspace={workspace} /> })}
              >
                <ConnectorLogo type={t.type} size={32} />
                <div>
                  <div className="as-card__title">{t.label}</div>
                  <div className="muted small">{t.about}</div>
                </div>
                <span className="cn-tile__count">{connectors.filter((c) => c.type === t.type).length || ''}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectForm({ type, workspace }: { type: ConnectorType; workspace?: string }) {
  const { projects } = useStudio();
  const [scope, setScope] = useState<'workspace' | 'project' | 'personal'>('project');
  const [access, setAccess] = useState<'read' | 'read_write'>('read');
  const isData = type.group === 'Data';
  const isCustom = type.group === 'Custom';

  return (
    <div className="connect-form">
      <div className="connect-form__head">
        <ConnectorLogo type={type.type} size={40} />
        <div>
          <div className="as-card__title">{type.label}</div>
          <div className="muted small">{type.about}</div>
        </div>
      </div>
      <label className="field">
        <span className="field__label">Name it</span>
        <input className="field__input" placeholder={`e.g. ${isData ? 'Orders DB' : type.label + ' · team'}`} />
      </label>
      {isData && (
        <label className="field">
          <span className="field__label">Connection string</span>
          <input className="field__input as-mono" placeholder="Stored encrypted in the workspace vault" />
        </label>
      )}
      {isCustom && (
        <label className="field">
          <span className="field__label">{type.type === 'mcp' ? 'MCP server URL' : 'OpenAPI spec URL'}</span>
          <input className="field__input as-mono" placeholder="https://" />
        </label>
      )}
      <div className="field">
        <span className="field__label">Who can use it</span>
        <div className="seg">
          {(['personal', 'project', 'workspace'] as const).map((s) => (
            <button key={s} type="button" className={scope === s ? 'is-on' : ''} onClick={() => setScope(s)}>
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </div>
        {scope === 'project' && (
          <select className="field__input">
            {projects.map((p) => (
              <option key={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="field">
        <span className="field__label">Access</span>
        <div className="seg">
          <button type="button" className={access === 'read' ? 'is-on' : ''} onClick={() => setAccess('read')}>
            Read only
          </button>
          <button type="button" className={access === 'read_write' ? 'is-on' : ''} onClick={() => setAccess('read_write')}>
            Read & write
          </button>
        </div>
        {access === 'read_write' && <span className="muted small">Writes from agents are logged in Governance and can require a human to approve.</span>}
      </div>
      <p className="isolation-note small">
        <Icon name="lock" size={12} /> Credentials stay in {workspace ?? 'this workspace'} and are never sent to the model.
      </p>
      <button type="button" className="as-btn as-btn--primary">
        {isData || isCustom ? 'Test and connect' : `Sign in to ${type.label}`}
      </button>
    </div>
  );
}
