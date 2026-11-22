'use client';

import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SeriesChart, ChartSeries } from '@/components/backtest/SeriesChart';
import { useKeyed } from '@/hooks/useKeyed';
import { AnalysisAPI, DatedValue } from '@/lib/api/analysis';

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: string }> = ({ label, value, sub, tone }) => (
  <div className="px-3 py-2.5 border-r border-b border-slate-800" >
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone ?? 'text-slate-100'}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

const toSeries = (name: string, color: string, pts: DatedValue[], extra: Partial<ChartSeries> = {}): ChartSeries => ({
  name,
  color,
  data: pts.map((p) => ({ time: p.date, value: p.value })),
  ...extra,
});

export const MacroRates: React.FC = () => {
  const q = useKeyed('macro', () => AnalysisAPI.macro());
  const d = q.data;

  const curve = useMemo(
    () => (d ? d.curve.points.map((p) => ({ maturity: p.maturity, Now: p.yield_pct, '1M ago': p.month_ago_pct, '1Y ago': p.year_ago_pct })) : []),
    [d]
  );
  const spreads = useMemo<ChartSeries[]>(() => (d ? [toSeries('10Y–2Y', '#ff9f1a', d.spread_2s10s), toSeries('10Y–3M', '#4fc3f7', d.spread_3m10y)] : []), [d]);
  const sahm = useMemo<ChartSeries[]>(
    () =>
      d
        ? [
            toSeries('Sahm rule', '#ff9f1a', d.sahm.series),
            toSeries('Trigger (0.50)', '#ff4d4d', d.sahm.series.map((p) => ({ date: p.date, value: d.sahm.threshold })), { dashed: true }),
          ]
        : [],
    [d]
  );
  const rec = useMemo<ChartSeries[]>(() => (d && d.recession_probability.series.length ? [toSeries('Recession probability (%)', '#c792ea', d.recession_probability.series)] : []), [d]);

  const y = (m: string) => d?.curve.points.find((p) => p.maturity === m)?.yield_pct;
  const inv = d?.spread_2s10s_now.state === 'inverted';

  return (
    <div className="space-y-3 max-w-[1500px] mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Macro &amp; Rates</h1>
        <p className="text-xs text-slate-500">US Treasury yields, curve spreads, labour-market recession signals and inflation, from the St. Louis Fed (FRED).</p>
      </div>

      {q.loading && <Card className="!p-10"><Skeleton variant="chart" height="h-64" /></Card>}
      {q.err && (
        <Card className="!p-8 text-center">
          <p className="text-sm text-rose-300">{q.err}</p>
          <p className="text-xs text-slate-500 mt-1">No substitute data is shown. Check your internet connection and try again.</p>
        </Card>
      )}

      {d && (
        <>
          <Card noPadding>
            <CardHeader title="Snapshot" badge="FRED" subtitle={`Yields as of ${d.curve.as_of}`} />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
              <Tile label="2Y Treasury" value={`${y('2Y')?.toFixed(2)}%`} />
              <Tile label="10Y Treasury" value={`${y('10Y')?.toFixed(2)}%`} />
              <Tile label="10Y–2Y spread" value={`${d.spread_2s10s_now.value >= 0 ? '+' : ''}${d.spread_2s10s_now.value.toFixed(2)}`} tone={inv ? 'text-rose-400' : 'text-emerald-400'} sub={`${d.spread_2s10s_now.state} · ${d.spread_2s10s_now.date}`} />
              <Tile label="Fed funds" value={d.fed_funds ? `${d.fed_funds.value.toFixed(2)}%` : '—'} sub={d.fed_funds?.date.slice(0, 7)} />
              <Tile label="CPI inflation (YoY)" value={d.inflation_yoy ? `${d.inflation_yoy.value.toFixed(1)}%` : '—'} sub={d.inflation_yoy?.date.slice(0, 7)} />
              <Tile label="Unemployment" value={d.unemployment.latest ? `${d.unemployment.latest.value.toFixed(1)}%` : '—'} sub={d.unemployment.latest?.date.slice(0, 7)} />
              <Tile label="Sahm rule" value={d.sahm.latest ? d.sahm.latest.value.toFixed(2) : '—'} tone={d.sahm.triggered ? 'text-rose-400' : 'text-emerald-400'} sub={d.sahm.triggered ? 'TRIGGERED (≥ 0.50)' : 'not triggered'} />
              <Tile label="Recession prob." value={d.recession_probability.latest ? `${d.recession_probability.latest.value.toFixed(1)}%` : '—'} sub={d.recession_probability.latest ? `model, ${d.recession_probability.latest.date.slice(0, 7)}` : undefined} />
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <Card noPadding>
              <CardHeader title="Treasury yield curve" subtitle="Constant-maturity yields" />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={curve} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#161616" />
                    <XAxis dataKey="maturity" tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={false} tickLine={false} width={46} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', fontSize: 11 }} formatter={(v) => `${Number(v).toFixed(2)}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="1Y ago" stroke="#6e6e6e" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="1M ago" stroke="#4fc3f7" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Now" stroke="#ff9f1a" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="Curve spreads" subtitle="Below zero = inverted" />
              <div className="h-[320px] p-2"><SeriesChart series={spreads} /></div>
              <div className="px-3 pb-2 flex gap-4 text-[11px] text-slate-400">
                {spreads.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: s.color }} />{s.name}</span>)}
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="Sahm rule" subtitle="3-mo avg unemployment minus its 12-month low" />
              <div className="h-[260px] p-2"><SeriesChart series={sahm} /></div>
              <p className="px-3 py-2 text-[10px] text-slate-600 border-t border-slate-800">
                Computed here from FRED UNRATE. A reading of 0.50 or more has coincided with the start of every US recession since 1970; it is a
                real-time indicator, not a forecast.
              </p>
            </Card>

            <Card noPadding>
              <CardHeader title="Recession probability" subtitle="Smoothed model estimate (%)" />
              <div className="h-[260px] p-2">
                {rec.length ? <SeriesChart series={rec} /> : <p className="h-full flex items-center justify-center text-xs text-slate-500">Series unavailable.</p>}
              </div>
              <p className="px-3 py-2 text-[10px] text-slate-600 border-t border-slate-800">{d.recession_probability.note}</p>
            </Card>
          </div>

          <p className="text-[10px] text-slate-600">Source: {d.sources}. Data is published with different lags; each tile shows its own date.</p>
        </>
      )}
    </div>
  );
};
