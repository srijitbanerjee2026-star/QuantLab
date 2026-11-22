'use client';

import React, { useMemo, useState } from 'react';
import { Play, Loader2, AlertTriangle, X } from 'lucide-react';
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { fetchFrontier, apiErrorMessage, FrontierResult, PortfolioResult } from '@/lib/api/risk';

type PortfolioKey = 'max_sharpe' | 'min_volatility' | 'equal_weight';

const PORTFOLIOS: { key: PortfolioKey; label: string; color: string; blurb: string }[] = [
  { key: 'max_sharpe', label: 'Max Sharpe', color: '#ff9f1a', blurb: 'Highest return per unit of risk in-sample' },
  { key: 'min_volatility', label: 'Min Volatility', color: '#4fc3f7', blurb: 'Lowest-risk long-only mix' },
  { key: 'equal_weight', label: 'Equal Weight', color: '#9a9a9a', blurb: '1/N baseline' },
];

const LOOKBACKS = [
  { id: '1Y', years: 1 },
  { id: '3Y', years: 3 },
  { id: '5Y', years: 5 },
];

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const inputCls = 'w-full h-8 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-100 tabular-nums outline-none focus:border-blue-400/70 select-text';

export const Optimisation: React.FC = () => {
  const [basket, setBasket] = useState<string[]>(['AAPL', 'MSFT', 'NVDA', 'SPY', 'TLT', 'GLD']);
  const [years, setYears] = useState(3);
  const [rf, setRf] = useState(2);
  const [maxW, setMaxW] = useState(50);
  const [result, setResult] = useState<FrontierResult | null>(null);
  const [selected, setSelected] = useState<PortfolioKey>('max_sharpe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => {
    if (basket.length < 2) return 'Add at least 2 instruments.';
    if (maxW <= 0 || maxW > 100) return 'Max weight must be between 1 and 100%.';
    if (maxW / 100 * basket.length < 1) return `With ${basket.length} assets the max weight must be at least ${Math.ceil(100 / basket.length)}%.`;
    return null;
  }, [basket, maxW]);

  const run = async () => {
    if (validation) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchFrontier({ symbols: basket, years, risk_free_rate: rf / 100, max_weight: maxW / 100 }));
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const chart = useMemo(() => {
    if (!result) return null;
    return {
      frontier: result.frontier.map((p) => ({ x: p.volatility * 100, y: p.return * 100, name: 'Frontier' })),
      assets: result.assets.map((a) => ({ x: a.volatility * 100, y: a.expected_return * 100, name: a.symbol })),
      points: PORTFOLIOS.map((p) => ({ x: result[p.key].volatility * 100, y: result[p.key].expected_return * 100, name: p.label, color: p.color })),
    };
  }, [result]);

  const sel: PortfolioResult | null = result ? result[selected] : null;
  const selMeta = PORTFOLIOS.find((p) => p.key === selected)!;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Portfolio Optimisation</h1>
        <p className="text-xs text-slate-500">
          Long-only mean–variance optimisation for any basket of tickers. Inputs are historical estimates, so results describe the past
          sample, not expected future performance.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card noPadding className="col-span-12 lg:col-span-3 self-start">
          <CardHeader title="Configuration" badge={`${basket.length} assets`} />
          <div className="p-3 space-y-3">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Basket</span>
              <div className="flex flex-wrap gap-1 mb-2">
                {basket.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 border border-slate-700 text-[11px] text-slate-200">
                    {s}
                    <button onClick={() => setBasket(basket.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="text-slate-500 hover:text-rose-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {basket.length < 20 && <SymbolSearch onPick={(s) => !basket.includes(s) && setBasket([...basket, s])} placeholder="Add any ticker…" />}
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
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Risk-free (%)</span>
                <input type="number" step={0.1} min={0} value={rf} onChange={(e) => setRf(Number(e.target.value))} className={inputCls} />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Max weight (%)</span>
                <input type="number" min={1} max={100} value={maxW} onChange={(e) => setMaxW(Number(e.target.value))} className={inputCls} />
              </label>
            </div>

            {validation && <p className="text-[11px] text-amber-400">{validation}</p>}

            <button
              onClick={run}
              disabled={loading || !!validation}
              className="w-full h-9 flex items-center justify-center gap-2 bg-blue-400 text-black font-bold text-xs tracking-wider uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-300"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
              {loading ? 'Optimising…' : 'Optimise'}
            </button>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Long-only, fully invested. Only days when every asset traded are used, so mixing assets with different calendars (e.g. crypto
              and equities) shortens the sample.
            </p>
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-9 space-y-3 min-w-0">
          {!result && !loading && !error && (
            <Card className="!p-10 text-center">
              <p className="text-sm text-slate-300">No optimisation yet</p>
              <p className="text-xs text-slate-500 mt-1">Build a basket and press Optimise.</p>
            </Card>
          )}
          {loading && (
            <Card className="!p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Loading prices and solving for {basket.length} assets…
            </Card>
          )}
          {error && (
            <Card className="!p-4 border-rose-500/40">
              <div className="flex items-start gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Optimisation failed</div>
                  <div className="text-xs text-slate-400 mt-0.5">{error}</div>
                </div>
              </div>
            </Card>
          )}

          {result && chart && sel && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PORTFOLIOS.map((p) => {
                  const r = result[p.key];
                  return (
                    <button
                      key={p.key}
                      onClick={() => setSelected(p.key)}
                      className={`text-left p-3 border bg-[#0b0b0b] ${selected === p.key ? 'border-blue-400' : 'border-slate-700 hover:border-slate-600'}`}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: p.color }}>
                        <span className="h-2 w-2" style={{ background: p.color }} /> {p.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2">{p.blurb}</div>
                      <div className="grid grid-cols-3 text-xs tabular-nums">
                        <div><div className="text-[10px] text-slate-500">Return</div><div className="text-slate-100 font-semibold">{pct(r.expected_return)}</div></div>
                        <div><div className="text-[10px] text-slate-500">Vol</div><div className="text-slate-100 font-semibold">{pct(r.volatility)}</div></div>
                        <div><div className="text-[10px] text-slate-500">Sharpe</div><div className="text-slate-100 font-semibold">{r.sharpe_ratio.toFixed(2)}</div></div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <Card noPadding>
                  <CardHeader title="Efficient frontier" subtitle={`${result.start} → ${result.end}`} />
                  <div className="p-2">
                    <ResponsiveContainer width="100%" height={340}>
                      <ScatterChart margin={{ top: 12, right: 24, left: 4, bottom: 16 }}>
                        <CartesianGrid stroke="#161616" />
                        <XAxis type="number" dataKey="x" name="Volatility" unit="%" tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} tickFormatter={(v: number) => v.toFixed(0)} label={{ value: 'Volatility (%)', position: 'insideBottom', offset: -8, fill: '#6e6e6e', fontSize: 10 }} domain={['auto', 'auto']} />
                        <YAxis type="number" dataKey="y" name="Return" unit="%" tick={{ fontSize: 10, fill: '#9a9a9a' }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} tickFormatter={(v: number) => v.toFixed(0)} domain={['auto', 'auto']} width={40} />
                        <ZAxis range={[60, 60]} />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3', stroke: '#474747' }}
                          contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', fontSize: 11 }}
                          formatter={(v, n) => [`${Number(v).toFixed(2)}%`, String(n)]}
                        />
                        <Scatter data={chart.frontier} fill="#ff9f1a" line={{ stroke: '#ff9f1a', strokeWidth: 1.5 }} shape={() => <g />} isAnimationActive={false} />
                        <Scatter data={chart.assets} fill="#6e6e6e" isAnimationActive={false}>
                          <LabelList dataKey="name" position="top" style={{ fontSize: 10, fill: '#9a9a9a' }} />
                        </Scatter>
                        {chart.points.map((p) => (
                          <Scatter key={p.name} data={[p]} fill={p.color} shape="diamond" isAnimationActive={false} />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-4 px-2 pb-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-blue-400" />Frontier</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-slate-500" />Single assets</span>
                      {PORTFOLIOS.map((p) => (
                        <span key={p.key} className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rotate-45" style={{ background: p.color }} />{p.label}</span>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card noPadding>
                  <CardHeader title={`${selMeta.label} allocation`} badge={`cap ${(result.max_weight * 100).toFixed(0)}%`} />
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#111] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Asset</th>
                          <th className="text-left font-medium px-3 py-2 w-[40%]">Weight</th>
                          <th className="text-right font-medium px-3 py-2">Risk share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(sel.weights)
                          .sort((a, b) => b[1] - a[1])
                          .map(([s, w]) => (
                            <tr key={s} className="border-t border-slate-800">
                              <td className="px-3 py-1.5 font-bold text-slate-100">{s}</td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 bg-slate-800"><div className="h-2" style={{ width: `${w * 100}%`, background: selMeta.color }} /></div>
                                  <span className="tabular-nums text-slate-200 w-12 text-right">{pct(w)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{pct(sel.risk_contribution[s] ?? 0)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-3 py-2 text-[10px] text-slate-600 border-t border-slate-800">
                    “Risk share” is each asset&apos;s contribution to total portfolio variance. A small weight can still carry most of the risk.
                  </p>
                </Card>
              </div>

              <Card noPadding>
                <CardHeader title="Correlation matrix" subtitle={`${result.observations} overlapping days`} />
                <div className="p-3"><CorrelationHeatmap data={result.correlation} /></div>
              </Card>

              <p className="text-[10px] text-slate-600">
                Data: {result.data_source}. Optimised weights fit the historical sample and tend to concentrate in recent winners
                (estimation error). Treat them as a starting point for analysis, not as advice.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
