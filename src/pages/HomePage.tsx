import { useTool } from '../lib/useTool';

/** Shapes observed from the Gateway on 2026-11-25. */
interface WhoAmI {
  you?: { name: string; email?: string };
  workspace?: string;
  projects?: string[];
  default_project?: string | null;
  agents?: string[];
}

interface ProjectList {
  projects: { id: string; name: string; description?: string; default?: boolean }[];
}

export function HomePage() {
  const me = useTool<WhoAmI>('whoami');
  const projects = useTool<ProjectList>('list_projects');

  return (
    <div className="page">
      <h1>Welcome{me.data?.you?.name ? `, ${me.data.you.name.split(' ')[0]}` : ''}</h1>
      {me.data?.workspace && <p className="muted">Workspace: {me.data.workspace}</p>}
      {me.error && <p className="error">{me.error}</p>}

      <section className="card">
        <h2>Projects</h2>
        {projects.loading && <p className="muted">Loading projects…</p>}
        {projects.error && <p className="error">{projects.error}</p>}
        {projects.data && (
          <ul className="list">
            {projects.data.projects.map((p) => (
              <li key={p.id} className="list__item">
                <strong>{p.name}</strong>
                {p.description && p.description !== p.name && <span className="muted"> · {p.description}</span>}
                {p.default && <span className="badge">Default</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {me.data?.agents && (
        <section className="card">
          <h2>Agents</h2>
          <p className="muted">{me.data.agents.length} agents available</p>
        </section>
      )}
    </div>
  );
}
