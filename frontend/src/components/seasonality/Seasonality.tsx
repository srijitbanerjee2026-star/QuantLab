'use client';

import React from 'react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { useKeyed } from '@/hooks/useKeyed';
import { AnalysisAPI } from '@/lib/api/analysis';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const heat = (v: number | null): React.CSSProperties => {
  if (v === null) return { background: '#0b0b0b' };
  const a = Math.min(Math.abs(v) / 10, 1) * 0.8;
  return { background: v >= 0 ? `rgba(0,210,106,${a})` : `rgba(255,77,77,${a})` };
};
const tone = (v: number) => (v >= 0 ? 'text-emerald-400' : 'text-rose-400');

export const Seasonality: React.FC<{ focusTicker: string; onSelectTicker: (s: string) => void }> = ({ focusTicker, onSelectTicker }) => {
  const q = useKeyed(`s|${focusTicker}`, () => AnalysisAPI.seasonality(focusTicker));
  const d = q.data;

  return (
    <div className="space-y-3 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Seasonality</h1>
          <p className="text-xs text-slate-500">Average calendar-month returns for any ticker, from real price history. Treat patterns with caution: most are statistical noise.</p>
        </div>
        <SymbolSearch onPick={(x) => onSelectTicker(x.replace('^', ''))} placeholder="Open any ticker…" className="w-64" />
      </div>

      {q.loading && <Card className="!p-10"><Skeleton variant="chart" height="h-64" /></Card>}
      {q.err && <Card className="!p-8 text-center text-sm text-rose-300">{q.err}</Card>}

      {d && (
        <>
          <Card className="!p-3 border-amber-400/30">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-amber-400">{d.n_significant} of 12 months</span> are statistically different from zero at the 5% level
              (|t| &gt; 2). With 12 months tested, about 0.6 would show up by chance alone, so a handful of &quot;significant&quot; months is
              not evidence of a tradable calendar effect. Best month on average: <b className="text-slate-200">{d.best_month}</b>; worst:{' '}
              <b className="text-slate-200">{d.worst_month}</b>.
            </p>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <Card noPadding>
              <CardHeader title={`${d.symbol} average monthly return`} subtitle={`${d.first_month} → ${d.last_month} · ${d.n_months} months`} />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={d.months} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={false} tickLine={false} width={40} />
                    <ReferenceLine y={0} stroke="#474747" />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', fontSize: 11 }}
                      formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Average return']}
                    />
                    <Bar dataKey="avg_return_pct" isAnimationActive={false}>
                      {d.months.map((m) => (
                        <Cell key={m.month} fill={m.avg_return_pct >= 0 ? '#00d26a' : '#ff4d4d'} fillOpacity={m.significant_5pct ? 1 : 0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="px-2 pb-1 text-[10px] text-slate-600">Solid bars are significant at 5%; faded bars are not.</p>
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="Month statistics" badge={`${d.overall_win_rate_pct}% up months`} />
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#111] text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Month</th>
                      <th className="text-right font-medium px-2 py-2">Avg</th>
                      <th className="text-right font-medium px-2 py-2">Median</th>
                      <th className="text-right font-medium px-2 py-2">Win %</th>
                      <th className="text-right font-medium px-2 py-2">Best</th>
                      <th className="text-right font-medium px-2 py-2">Worst</th>
                      <th className="text-right font-medium px-2 py-2" title="Mean divided by its standard error">t-stat</th>
                      <th className="text-right font-medium px-3 py-2">n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.months.map((m) => (
                      <tr key={m.month} className="border-t border-slate-800">
                        <td className="px-3 py-1.5 font-bold text-slate-100">{m.month}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${tone(m.avg_return_pct)}`}>{m.avg_return_pct.toFixed(2)}%</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${tone(m.median_return_pct)}`}>{m.median_return_pct.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{m.win_rate_pct.toFixed(0)}%</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{m.best_pct.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{m.worst_pct.toFixed(1)}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${m.significant_5pct ? 'text-amber-400 font-semibold' : 'text-slate-500'}`}>{m.t_stat ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{m.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card noPadding>
            <CardHeader title="Year × month returns" subtitle="Calendar-month return (%), adjusted close" />
            <div className="overflow-auto p-3">
              <table className="text-[11px] border-separate border-spacing-0.5 mx-auto">
                <thead>
                  <tr>
                    <th />
                    {MONTHS.map((m) => <th key={m} className="px-2 py-1 text-slate-500 font-medium">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...d.heatmap].reverse().map((row) => (
                    <tr key={row.year}>
                      <th className="px-2 py-1 text-right text-slate-500 font-medium">{row.year}</th>
                      {row.months.map((v, i) => (
                        <td key={i} style={heat(v)} className="w-12 h-7 text-center tabular-nums text-slate-100" title={v === null ? 'no data' : `${v}%`}>
                          {v === null ? '' : v.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-[10px] text-slate-600">
            Data: {d.source}. Monthly returns use month-end adjusted closes; an unfinished current month is excluded. Past seasonal patterns do not
            predict future returns.
          </p>
        </>
      )}
    </div>
  );
};
