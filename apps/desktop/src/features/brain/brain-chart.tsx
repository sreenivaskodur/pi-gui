import type { BrainDetailChart, BrainNumberFormat } from "../../../contracts/brain";

/*
 * A compact, theme-aware cartesian chart (grouped bars plus optional dashed
 * lines) for the detail pages, rendered as inline SVG so it tracks the active
 * theme via CSS variables. Blue carries the subject; grey the reference line.
 */

const W = 660;
const H = 240;
const M = { top: 12, right: 10, bottom: 26, left: 48 };
const BAR_COLOR = "#2a78d6";
const LINE_COLOR = "var(--muted-strong)";

const FORMATTERS: Record<BrainNumberFormat, (v: number) => string> = {
  money: (v) => `$${v.toFixed(1)}M`,
  money0: (v) => `$${Math.round(v)}M`,
  pct1: (v) => `${v.toFixed(1)}%`,
  mult: (v) => `${v.toFixed(1)}x`,
  int: (v) => Math.round(v).toLocaleString(),
  plain: (v) => String(v),
};

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function BrainChart({ chart }: { readonly chart: BrainDetailChart }) {
  const fmt = FORMATTERS[chart.format ?? "money0"];
  const bars = chart.series.filter((s) => s.kind === "bar");
  const lines = chart.series.filter((s) => s.kind === "line");
  const values = chart.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (chart.cats.length === 0 || values.length === 0) return null;
  const min = Math.min(0, ...values);
  const max = niceMax(Math.max(...values));
  const span = max - min || 1;
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const n = chart.cats.length;
  const band = pw / n;
  const x = (i: number) => M.left + band * i + band / 2;
  const y = (v: number) => M.top + ph - ((v - min) / span) * ph;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * span);

  const groupW = band * 0.6;
  const barW = bars.length ? Math.min(24, groupW / bars.length) : 0;

  const linePath = (vals: readonly (number | null)[]): string =>
    vals
      .map((v, i) =>
        v === null ? null : `${i === 0 || vals[i - 1] === null ? "M" : "L"}${x(i)},${y(v)}`,
      )
      .filter(Boolean)
      .join(" ");

  return (
    <div className="brain-chart">
      {chart.series.length > 1 ? (
        <div className="brain-chart__legend">
          {chart.series.map((s, i) => (
            <span key={i}>
              <i
                className={s.kind === "line" ? "line" : ""}
                style={{
                  background: s.kind === "line" ? "none" : BAR_COLOR,
                  borderTop:
                    s.kind === "line"
                      ? `2px ${s.dashed ? "dashed" : "solid"} var(--muted-strong)`
                      : undefined,
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={M.left} x2={M.left + pw} y1={y(t)} y2={y(t)} className="brain-chart__grid" />
            <text x={M.left - 8} y={y(t) + 3.5} textAnchor="end" className="brain-chart__lab">
              {fmt(t)}
            </text>
          </g>
        ))}
        {bars.map((series, si) =>
          series.values.map((v, i) => {
            if (v === null) return null;
            const bx = x(i) - groupW / 2 + si * barW;
            const by = y(Math.max(v, 0));
            const height = Math.abs(y(v) - y(0));
            return (
              <rect
                key={`${si}-${i}`}
                x={bx}
                y={by}
                width={Math.max(barW - 2, 1)}
                height={height}
                rx={3}
                fill={BAR_COLOR}
              />
            );
          }),
        )}
        {lines.map((series, si) => (
          <path
            key={si}
            d={linePath(series.values)}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={series.dashed ? "5 4" : undefined}
          />
        ))}
        {chart.cats.map((cat, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="brain-chart__lab">
            {cat}
          </text>
        ))}
      </svg>
    </div>
  );
}
