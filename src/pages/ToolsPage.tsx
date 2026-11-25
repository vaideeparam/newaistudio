import { useEffect, useState } from 'react';
import { callTool, listTools, type ToolInfo } from '../lib/mcp';

/**
 * Developer page: list the Gateway's tools and call one with JSON args.
 * Handy while building features; hide it from the nav before launch.
 */
export function ToolsPage() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [args, setArgs] = useState('{}');
  const [output, setOutput] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTools()
      .then((t) => {
        setTools(t);
        setSelected(t[0]?.name ?? '');
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const tool = tools.find((t) => t.name === selected);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      setOutput(JSON.stringify(await callTool(selected, parsed), null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>Gateway tools</h1>
      <p className="muted">{tools.length} tools exposed by the ai/Studio Gateway MCP.</p>
      <div className="tools">
        <label className="field">
          <span>Tool</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {tool?.description && <p className="muted">{tool.description}</p>}
        <label className="field">
          <span>Arguments (JSON)</span>
          <textarea rows={5} value={args} onChange={(e) => setArgs(e.target.value)} spellCheck={false} />
        </label>
        <button type="button" className="btn btn--primary" disabled={!selected || busy} onClick={() => void run()}>
          {busy ? 'Running…' : 'Call tool'}
        </button>
        {error && <p className="error">{error}</p>}
        {output && <pre className="output">{output}</pre>}
      </div>
    </div>
  );
}
