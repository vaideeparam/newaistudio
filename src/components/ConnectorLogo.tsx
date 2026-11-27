/** Neutral lettered tile per connector type (no third-party logos). */
const LOOK: Record<string, { t: string; c: string }> = {
  gmail: { t: 'Gm', c: '#bd5630' },
  outlook: { t: 'Ol', c: '#2563a8' },
  slack: { t: 'Sl', c: '#6b3a9e' },
  teams: { t: 'Tm', c: '#4b4fa8' },
  sharepoint: { t: 'SP', c: '#1a6a6a' },
  onedrive: { t: 'OD', c: '#2563a8' },
  gdrive: { t: 'GD', c: '#2f8f5a' },
  postgresql: { t: 'Pg', c: '#33608f' },
  mysql: { t: 'My', c: '#3b6e85' },
  sql: { t: 'SQL', c: '#56524a' },
  mongodb: { t: 'Mg', c: '#1a5c3a' },
  rest: { t: '{ }', c: '#56524a' },
  mcp: { t: 'MCP', c: '#191712' },
  teamdocs: { t: 'TD', c: '#191712' },
};

export function ConnectorLogo({ type, size = 28 }: { type: string; size?: number }) {
  const l = LOOK[type] ?? { t: type.slice(0, 2).toUpperCase(), c: '#8b867a' };
  return (
    <span
      className="cn-logo"
      style={{ width: size, height: size, background: l.c, fontSize: l.t.length > 2 ? size * 0.3 : size * 0.38 }}
      aria-hidden="true"
    >
      {l.t}
    </span>
  );
}
