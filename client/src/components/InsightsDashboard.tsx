import { useState } from 'react';
import { formatCompact, type SeriesPoint } from '../api';
import { useUsageReport } from '../useUsageReport';

/**
 * The new Insights dashboard - the feature behind the `insights-dashboard`
 * flag. KPI tiles with month-over-month deltas, a 30-day trend for each
 * measure (small multiples, one axis each), and usage by team.
 */
export function InsightsDashboard() {
  // Like any live dashboard, this one refreshes itself. That is also how a
  // bad upstream deploy reaches users: the next refresh pulls the bad payload.
  const { data, error, updatedAt, refresh } = useUsageReport('new', { refreshMs: 10_000 });

  // The "v2 regression": this dashboard assumes `series` is always an array.
  // When the Admin drawer injects bad report data, the API returns `series: null`
  // and the TrendChart below throws while rendering - a real crash on real
  // data, caught by the error boundary around <InsightsDashboard>.

  return (
    <section className="panel report insights" aria-labelledby="report-title">
      <div className="panel-head">
        <div>
          <p className="crumbs muted small">Reports › Insights</p>
          <h2 id="report-title">Usage insights</h2>
          <p className="muted">
            {data ? `${formatDate(data.period.from)} – ${formatDate(data.period.to)} · compared with the previous 30 days` : 'Last 30 days'}
          </p>
        </div>
        <div className="head-actions">
          {updatedAt && (
            <span className="muted small">
              Updated {updatedAt.toLocaleTimeString()} · auto-refreshes every 10s
            </span>
          )}
          <button className="btn btn-outline" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="error">Could not load insights: {error}</p>}
      {!data && !error && <p className="muted">Loading insights…</p>}

      {data && (
        <>
          <div className="kpis">
            {data.kpis.map((k) => {
              const up = k.deltaPct >= 0;
              // For latency, lower is better: flip the status colour.
              const good = k.id === 'p95' ? !up : up;
              return (
                <div className="kpi" key={k.id}>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value">
                    {formatCompact(k.value)}
                    {k.unit && <span className="kpi-unit"> {k.unit}</span>}
                  </div>
                  <div className={`delta ${good ? 'good' : 'bad'}`}>
                    <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(k.deltaPct).toFixed(1)}%{' '}
                    <span className="muted">vs prev. 30d</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="charts">
            <TrendChart title="Daily active users" series={data.series} metric="activeUsers" />
            <TrendChart title="Daily API calls" series={data.series} metric="apiCalls" />
          </div>

          <div className="breakdown">
            <h3>API calls by team</h3>
            <ul className="bars" aria-label="API calls by team">
              {data.byTeam.map((t) => (
                <li key={t.team}>
                  <span className="bar-label">{t.team}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${t.sharePct}%` }} />
                  </span>
                  <span className="bar-value">
                    {formatCompact(t.apiCalls)} <span className="muted">({t.sharePct}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * A small dependency-free line chart (one series, one axis) with a hover
 * crosshair + tooltip. Follows the house chart rules: 2px line, ~10% area
 * wash, hairline gridlines, >= 8px markers with a surface ring, text in text
 * colours (never the series colour).
 * ------------------------------------------------------------------------- */
const W = 520;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 44 };

function TrendChart({ title, series, metric }: { title: string; series: SeriesPoint[]; metric: 'activeUsers' | 'apiCalls' }) {
  const [hover, setHover] = useState<number | null>(null);

  const values = series.map((p) => p[metric]);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(values.length - 1).toFixed(1)},${H - PAD.bottom} L${x(0).toFixed(1)},${H - PAD.bottom} Z`;
  const ticks = [min, (min + max) / 2, max];
  const last = values.length - 1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };

  const h = hover ?? last;

  return (
    <figure className="chart">
      <figcaption>
        <span>{title}</span>
        <span className="chart-reading">
          <strong>{formatCompact(values[h])}</strong> <span className="muted small">{formatDate(series[h].date)}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, last ${series.length} days`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {formatCompact(Math.round(t))}
            </text>
          </g>
        ))}
        <text className="tick" x={x(0)} y={H - 8} textAnchor="start">
          {formatDate(series[0].date)}
        </text>
        <text className="tick" x={x(last)} y={H - 8} textAnchor="end">
          {formatDate(series[last].date)}
        </text>
        <path className="area" d={area} />
        <path className="line" d={path} />
        {hover !== null && <line className="crosshair" x1={x(h)} x2={x(h)} y1={PAD.top} y2={H - PAD.bottom} />}
        <circle className="marker" cx={x(h)} cy={y(values[h])} r={4.5} />
      </svg>
    </figure>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
