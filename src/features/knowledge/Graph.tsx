import { useMemo, useState } from 'react';

export interface GNode {
  id: string;
  label: string;
  type: string;
  docs?: number;
}
export interface GEdge {
  source: string;
  target: string;
  label?: string;
}

const W = 720;
const H = 440;

/** Small deterministic force layout: enough for tens of nodes, no dependency. */
function layout(nodes: GNode[], edges: GEdge[]) {
  const pos = new Map(
    nodes.map((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      return [n.id, { x: W / 2 + Math.cos(a) * 160, y: H / 2 + Math.sin(a) * 140 }];
    }),
  );
  for (let it = 0; it < 300; it++) {
    const f = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    for (const a of nodes)
      for (const b of nodes) {
        if (a === b) continue;
        const pa = pos.get(a.id)!;
        const pb = pos.get(b.id)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const k = 22000 / d2;
        const d = Math.sqrt(d2);
        f.get(a.id)!.x += (dx / d) * k;
        f.get(a.id)!.y += (dy / d) * k;
      }
    for (const e of edges) {
      const pa = pos.get(e.source);
      const pb = pos.get(e.target);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const k = (d - 150) * 0.03;
      f.get(e.source)!.x += (dx / d) * k;
      f.get(e.source)!.y += (dy / d) * k;
      f.get(e.target)!.x -= (dx / d) * k;
      f.get(e.target)!.y -= (dy / d) * k;
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const fv = f.get(n.id)!;
      p.x = Math.min(W - 60, Math.max(60, p.x + fv.x * 0.6 + (W / 2 - p.x) * 0.01));
      p.y = Math.min(H - 30, Math.max(30, p.y + fv.y * 0.6 + (H / 2 - p.y) * 0.01));
    }
  }
  return pos;
}

const TYPE_CLASS: Record<string, string> = {
  document: 'g-document',
  section: 'g-section',
  entity: 'g-entity',
  topic: 'g-topic',
};

export function Graph({
  nodes,
  edges,
  onSelect,
  selected,
  highlight,
}: {
  nodes: GNode[];
  edges: GEdge[];
  selected?: string;
  onSelect: (id: string) => void;
  /** Nodes the resolver matched: everything else dims. */
  highlight?: Set<string>;
}) {
  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? selected;
  const near = useMemo(() => {
    if (!focus) return highlight && highlight.size ? highlight : null;
    const s = new Set([focus]);
    edges.forEach((e) => {
      if (e.source === focus) s.add(e.target);
      if (e.target === focus) s.add(e.source);
    });
    return s;
  }, [focus, edges, highlight]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph" role="img" aria-label="Knowledge graph">
      {edges.map((e, i) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return null;
        const on = !near || (near.has(e.source) && near.has(e.target));
        return (
          <g key={i} className={on ? '' : 'g-dim'}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="g-edge" />
            {focus && on && e.label && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="g-edge-label">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        const r = n.type === 'document' ? 14 : n.type === 'topic' ? 11 : n.type === 'section' ? 8 : 9;
        return (
          <g
            key={n.id}
            className={`g-node ${TYPE_CLASS[n.type] ?? ''} ${near && !near.has(n.id) ? 'g-dim' : ''} ${selected === n.id ? 'is-sel' : ''} ${highlight?.has(n.id) ? 'is-hit' : ''}`}
            transform={`translate(${p.x},${p.y})`}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(n.id)}
          >
            <circle r={r} />
            <text y={r + 14}>{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
