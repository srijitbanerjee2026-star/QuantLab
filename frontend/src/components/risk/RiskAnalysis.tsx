'use client';

import React, { useMemo, useState } from 'react';
import { Play, Loader2, AlertTriangle, X } from 'lucide-react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { SeriesChart, ChartSeries } from '@/components/backtest/SeriesChart';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { fetchRiskReport, apiErrorMessage, RiskReport } from '@/lib/api/risk';

const LOOKBACKS = [
  { id: '1Y', years: 1 },
  { id: '3Y', years: 3 },
  { id: '5Y', years: 5 },
];

const pct = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(d)}%`);
const spct = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : v.toFixed(d));
const tone = (v: number | null | undefined) => (v === null || v === undefined ? 'text-slate-200' : v >= 0 ? 'text-emerald-400' : 'text-rose-400');

const inputCls = 'w-full h-8 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-100 tabular-nums outline-none focus:border-blue-400/70 select-text';

const Metric: React.FC<{ label: string; value: string; tone?: string; sub?: string; hint?: string }> = ({ label, value, tone: t, sub, hint }) => (
  <div className="px-3 py-2.5 border-r border-b border-slate-800" title={hint}>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-base font-semibold tabular-nums mt-0.5 ${t ?? 'text-slate-100'}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

export const RiskAnalysis: React.FC<{ initialSymbol: string }> = ({ initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [benchmark, setBenchmark] = useState('SPY');
  const [years, setYears] = useState(3);
  const [rf, setRf] = useState(2);
  const [peers, setPeers] = useState<string[]>(['AAPL', 'MSFT', 'TLT', 'GLD']);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(
        await fetchRiskReport({
          symbol,
          benchmark: benchmark.trim() || undefined,
          years,
          risk_free_rate: rf / 100,
          peers: peers.filter((p) => p !== symbol),
        })
      );
    } catch (e) {
      setReport(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const ddSeries = useMemo<ChartSeries[]>(
    () => (report ? [{ name: 'Drawdown', color: '#ff4d4d', kind: 'area', data: report.drawdown_curve.map((p) => ({ time: p.date, value: p.value })) }] : []),
    [report]
  );
  const volSeries = useMemo<ChartSeries[]>(
    () => (report ? [{ name: 'Rolling 60d volatility', color: '#ff9f1a', data: report.rolling_volatility.map((p) => ({ time: p.date, value: p.value })) }] : []),
    [report]
  );

  const var95 = report?.var['95'].historical ?? null;
  const var99 = report?.var['99'].historical ?? null;
  const b = report?.benchmark;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Risk Analysis</h1>
        <p className="text-xs text-slate-500">
          Volatility, drawdown, tail risk and benchmark exposure for any ticker, computed from historical daily returns. Historical risk
          does not predict future risk.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card noPadding className="col-span-12 lg:col-span-3 self-start">
          <CardHeader title="Configuration" />
          <div className="p-3 space-y-3">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Instrument</span>
              <div className="flex items-center gap-2">
                <span className="h-8 px-2 flex items-center border border-slate-700 bg-[#111] text-blue-400 font-bold text-xs min-w-[64px] justify-center">{symbol}</span>
                <SymbolSearch onPick={setSymbol} placeholder="Change symbol…" className="flex-1" />
              </div>
            </div>

            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Lookback</span>
              <div className="flex border border-slate-700">
                {LOOKBACKS.map((l) => (
                  <button key={l.id} onClick={() => setYears(l.years)} className={`flex-1 h-7 text-[11px] ${years === l.years ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>
                    {l.id}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Benchmark</span>
                <input value={benchmark} onChange={(e) => setBenchmark(e.target.value.toUpperCase())} className={inputCls} placeholder="SPY" />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Risk-free (%)</span>
                <input type="number" step={0.1} min={0} value={rf} onChange={(e) => setRf(Number(e.target.value))} className={inputCls} />
              </label>
            </div>

            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Correlation peers</span>
              <div className="flex flex-wrap gap-1 mb-2">
                {peers.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 border border-slate-700 text-[11px] text-slate-300">
                    {p}
                    <button onClick={() => setPeers(peers.filter((x) => x !== p))} aria-label={`Remove ${p}`} className="text-slate-500 hover:text-rose-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {peers.length < 9 && <SymbolSearch onPick={(s) => !peers.includes(s) && setPeers([...peers, s])} placeholder="Add peer…" />}
            </div>

            <button
              onClick={run}
              disabled={loading}
              className="w-full h-9 flex items-center justify-center gap-2 bg-blue-400 text-black font-bold text-xs tracking-wider uppercase disabled:opacity-40 hover:bg-blue-300"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
              {loading ? 'Analysing…' : 'Run analysis'}
            </button>
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-9 space-y-3 min-w-0">
          {!report && !loading && !error && (
            <Card className="!p-10 text-center">
              <p className="text-sm text-slate-300">No analysis yet</p>
              <p className="text-xs text-slate-500 mt-1">Choose an instrument and press Run analysis.</p>
            </Card>
          )}
          {loading && (
            <Card className="!p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Loading prices and computing risk for {symbol}…
            </Card>
          )}
          {error && (
            <Card className="!p-4 border-rose-500/40">
              <div className="flex items-start gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Analysis failed</div>
                  <div className="text-xs text-slate-400 mt-0.5">{error}</div>
                </div>
              </div>
            </Card>
          )}

          {report && (
            <>
              <Card noPadding>
                <CardHeader title={`${report.symbol} risk profile`} badge="Computed" subtitle={`${report.start} → ${report.end} · ${report.observations} daily returns`} />
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6">
                  <Metric label="Ann. return" value={spct(report.annualized_return)} tone={tone(report.annualized_return)} hint="Geometric annualised return" />
                  <Metric label="Volatility" value={pct(report.annualized_volatility)} sub="annualised" />
                  <Metric label="Sharpe" value={num(report.sharpe_ratio)} sub={`rf ${rf}%`} />
                  <Metric label="Sortino" value={num(report.sortino_ratio)} sub="downside only" />
                  <Metric label="Max drawdown" value={spct(report.max_drawdown)} tone="text-rose-400" sub={`${report.max_drawdown_peak} → ${report.max_drawdown_trough}`} />
                  <Metric label="Calmar" value={num(report.calmar_ratio)} />
                  <Metric label={`Beta vs ${report.benchmark_symbol ?? 'bench.'}`} value={num(b?.beta)} sub={b ? `R² ${num(b.r_squared)}` : 'no benchmark'} />
                  <Metric label="Alpha (ann.)" value={spct(b?.alpha_annual)} tone={tone(b?.alpha_annual)} sub="Jensen's" />
                  <Metric label="Correlation" value={num(b?.correlation)} sub={b ? `TE ${pct(b.tracking_error, 1)}` : undefined} />
                  <Metric label="VaR 95% (1d)" value={spct(var95)} tone="text-rose-400" sub={`parametric ${spct(report.var['95'].parametric)}`} hint="Historical: loss exceeded on 5% of days" />
                  <Metric label="VaR 99% (1d)" value={spct(var99)} tone="text-rose-400" sub={`parametric ${spct(report.var['99'].parametric)}`} />
                  <Metric label="CVaR 95%" value={spct(report.cvar_95)} tone="text-rose-400" sub="avg. loss beyond VaR" />
                  <Metric label="Skewness" value={num(report.skewness)} />
                  <Metric label="Excess kurtosis" value={num(report.excess_kurtosis)} sub="fat tails if > 0" />
                  <Metric label="Best day" value={spct(report.best_day)} tone="text-emerald-400" />
                  <Metric label="Worst day" value={spct(report.worst_day)} tone="text-rose-400" />
                </div>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <Card noPadding>
                  <CardHeader title="Drawdown" subtitle="From running peak" />
                  <div className="h-[240px] p-2"><SeriesChart series={ddSeries} percent /></div>
                </Card>
                <Card noPadding>
                  <CardHeader title="Rolling volatility" subtitle="60-day, annualised" />
                  <div className="h-[240px] p-2"><SeriesChart series={volSeries} percent /></div>
                </Card>
              </div>

              <Card noPadding>
                <CardHeader title="Daily return distribution" subtitle="Red = beyond 95% historical VaR" />
                <div className="p-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={report.histogram} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <XAxis dataKey="mid" tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={false} tickLine={false} interval={4} />
                      <YAxis tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', fontSize: 11 }}
                        formatter={(v) => [String(v), 'days']}
                        labelFormatter={(l) => `Return ≈ ${(Number(l) * 100).toFixed(2)}%`}
                      />
                      <Bar dataKey="count" isAnimationActive={false}>
                        {report.histogram.map((h, i) => (
                          <Cell key={i} fill={var95 !== null && h.hi <= var95 ? '#ff4d4d' : '#ff9f1a'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                      {var95 !== null && <ReferenceLine x={report.histogram.reduce((a, h) => (Math.abs(h.mid - var95) < Math.abs(a.mid - var95) ? h : a)).mid} stroke="#ff4d4d" strokeDasharray="4 3" />}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {report.correlation && (
                <Card noPadding>
                  <CardHeader title="Correlation matrix" subtitle="Daily returns, overlapping days only" />
                  <div className="p-3"><CorrelationHeatmap data={report.correlation} /></div>
                </Card>
              )}

              <p className="text-[10px] text-slate-600">
                Data: {report.data_source}. VaR is a 1-day figure at the stated confidence. Sharpe and Sortino use the risk-free rate you set;
                beta and alpha are measured against {report.benchmark_symbol ?? 'the chosen benchmark'}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
