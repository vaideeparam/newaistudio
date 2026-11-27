import { useMemo } from 'react';

/**
 * Rich elements an answer can carry as fenced blocks, so any agent can
 * produce them from plain text:
 *
 *   ```kpi                         ```chart
 *   [{"label":"MAPE","value":"3.3%",  {"type":"bar"|"line","title":"…",
 *     "delta":"-1.2 pts","good":true}]  "labels":[…],"series":[{"name":"…","data":[…]}]}
 *
 * Bad JSON falls back to showing the block as code, never an error.
 */
export const isRichFence = (lang?: string) => lang === 'kpi' || lang === 'chart' || lang === 'kpis';

interface Kpi {
  label: string;
  value: string | number;
  delta?: string;
  good?: boolean;
  note?: string;
}
interface Chart {
  type?: 'bar' | 'line';
  title?: string;
  labels: (string | number)[];
  series: { name?: string; data: number[] }[];
  unit?: string;
}

export function RichBlock({ lang, body }: { lang: string; body: string }) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }, [body]);
  if (parsed == null)
    return (
      <pre className="md-code__pre">
        <code>{body}</code>
      </pre>
    );
  if (lang === 'kpi' || lang === 'kpis') {
    const items = (Array.isArray(parsed) ? parsed : ((parsed as { items?: Kpi[] }).items ?? [parsed])) as Kpi[];
    return <KpiRow items={items} />;
  }
  return <ChartView c={parsed as Chart} />;
}

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div key={i} className="kpi">
          <div className="kpi__label">{k.label}</div>
          <div className="kpi__value">{String(k.value)}</div>
          {k.delta && <div className={`kpi__delta${k.good === true ? ' is-good' : k.good === false ? ' is-bad' : ''}`}>{k.delta}</div>}
          {k.note && <div className="kpi__note">{k.note}</div>}
        </div>
      ))}
    </div>
  );
}

const W = 560;
const H = 220;
const PAD = { l: 44, r: 12, t: 12, b: 36 };
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

/** A small, dependency-free SVG chart: bars or lines, up to four series, readable in both themes. */
export function ChartView({ c }: { c: Chart }) {
  const labels = c.labels ?? [];
  const series = (c.series ?? []).filter((s) => Array.isArray(s.data)).slice(0, 4);
  const all = series.flatMap((s) => s.data.filter((v) => Number.isFinite(v)));
  if (!labels.length || !all.length) return null;
  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const y = (v: number) => PAD.t + ih - ((v - min) / span) * ih;
  const band = iw / labels.length;
  const ticks = [min, min + span / 2, max];
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Number.isInteger(v) ? String(v) : v.toFixed(1));
  const every = Math.ceil(labels.length / 8);

  return (
    <figure className="chart">
      {c.title && <figcaption className="chart__title">{c.title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={c.title ?? 'Chart'} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={PAD.l - 6} y={y(t)} className="chart__tick" textAnchor="end" dominantBaseline="middle">
              {fmt(t)}
              {c.unit ?? ''}
            </text>
          </g>
        ))}
        {(c.type ?? 'bar') === 'bar'
          ? series.map((s, si) => {
              const bw = (band * 0.72) / series.length;
              return s.data.map((v, i) => (
                <rect
                  key={`${si}-${i}`}
                  x={PAD.l + i * band + band * 0.14 + si * bw}
                  y={Math.min(y(v), y(0))}
                  width={Math.max(bw - 1, 1)}
                  height={Math.abs(y(v) - y(0))}
                  rx={2}
                  fill={COLORS[si]}
                >
                  <title>{`${labels[i]} · ${s.name ?? ''} ${v}`}</title>
                </rect>
              ));
            })
          : series.map((s, si) => (
              <g key={si}>
                <polyline
                  fill="none"
                  stroke={COLORS[si]}
                  strokeWidth={2}
                  points={s.data.map((v, i) => `${PAD.l + i * band + band / 2},${y(v)}`).join(' ')}
                />
                {s.data.map((v, i) => (
                  <circle key={i} cx={PAD.l + i * band + band / 2} cy={y(v)} r={2.5} fill={COLORS[si]}>
                    <title>{`${labels[i]} · ${s.name ?? ''} ${v}`}</title>
                  </circle>
                ))}
              </g>
            ))}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={i} x={PAD.l + i * band + band / 2} y={H - PAD.b + 16} className="chart__tick" textAnchor="middle">
              {String(l).length > 10 ? String(l).slice(0, 9) + '…' : String(l)}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 && (
        <div className="chart__legend">
          {series.map((s, i) => (
            <span key={i}>
              <i style={{ background: COLORS[i] }} /> {s.name}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
