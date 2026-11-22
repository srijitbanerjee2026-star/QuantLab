'use client';

import React, { useMemo, useState } from 'react';
import { Play, Download, AlertTriangle, Loader2, Save, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import {
  runBacktest,
  backtestErrorMessage,
  BacktestRequest,
  BacktestResult,
  StrategyType,
} from '@/lib/api/backtest';
import { SeriesChart, ChartSeries } from './SeriesChart';
import { saveExperiment } from '@/lib/api/ml';

const STRATEGIES: { id: StrategyType; label: string; blurb: string }[] = [
  { id: 'sma_crossover', label: 'SMA Crossover', blurb: 'Long when the fast average is above the slow average; otherwise flat.' },
  { id: 'rsi_mean_reversion', label: 'RSI Mean Reversion', blurb: 'Buy when RSI(14) falls below the low threshold; sell above the high threshold.' },
];

const RANGES: { id: string; label: string; years: number | null }[] = [
  { id: '1Y', label: '1Y', years: 1 },
  { id: '2Y', label: '2Y', years: 2 },
  { id: '3Y', label: '3Y', years: 3 },
  { id: 'ALL', label: 'All', years: null },
];

const isoYearsAgo = (y: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d.toISOString().slice(0, 10);
};

const num = (v: number | null | undefined, d = 2, suffix = '') =>
  v === null || v === undefined ? '—' : `${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
const signed = (v: number | null | undefined, d = 2, suffix = '%') =>
  v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}${suffix}`;
const tone = (v: number | null | undefined) =>
  v === null || v === undefined ? 'text-slate-300' : v >= 0 ? 'text-emerald-400' : 'text-rose-400';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-600 mt-1">{hint}</span>}
  </label>
);

const inputCls =
  'w-full h-8 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-100 tabular-nums outline-none focus:border-blue-400/70 select-text';

const Metric: React.FC<{ label: string; value: string; tone?: string; sub?: string }> = ({ label, value, tone: t, sub }) => (
  <div className="px-3 py-2.5 border-r border-b border-slate-800 last:border-r-0">
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-base font-semibold tabular-nums mt-0.5 ${t ?? 'text-slate-100'}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

export const Backtesting: React.FC<{ initialSymbol: string }> = ({ initialSymbol }) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [strategy, setStrategy] = useState<StrategyType>('sma_crossover');
  const [shortW, setShortW] = useState(20);
  const [longW, setLongW] = useState(50);
  const [rsiLow, setRsiLow] = useState(30);
  const [rsiHigh, setRsiHigh] = useState(70);
  const [capital, setCapital] = useState(100000);
  const [costBps, setCostBps] = useState(5);
  const [benchmark, setBenchmark] = useState('SPY');
  const [range, setRange] = useState('ALL');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverVals, setHoverVals] = useState<{ t: string | null; v: Record<string, number> }>({ t: null, v: {} });

  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const saveRun = async () => {
    if (!result) return;
    setSaved('saving');
    try {
      await saveExperiment({
        name: `${result.symbol} ${STRATEGIES.find((s) => s.id === result.strategy_type)?.label} backtest`,
        experiment_type: 'backtest',
        parameters: { symbol: result.symbol, strategy_type: result.strategy_type, initial_capital: result.initial_capital, benchmark: result.benchmark_symbol, ...result.params },
        metrics: { ...result.metrics, benchmark_return_pct: result.benchmark_return_pct },
      });
      setSaved('ok');
    } catch {
      setSaved('err');
    }
  };

  const pickRange = (id: string) => {
    setRange(id);
    const r = RANGES.find((x) => x.id === id)!;
    setStart(r.years ? isoYearsAgo(r.years) : '');
    setEnd('');
  };

  const validation = useMemo(() => {
    if (!symbol.trim()) return 'Choose a symbol.';
    if (capital <= 0) return 'Initial capital must be positive.';
    if (strategy === 'sma_crossover' && shortW >= longW) return 'Fast window must be smaller than slow window.';
    if (strategy === 'rsi_mean_reversion' && !(rsiLow > 0 && rsiLow < rsiHigh && rsiHigh < 100))
      return 'RSI thresholds must satisfy 0 < low < high < 100.';
    if (start && end && start >= end) return 'Start date must be before end date.';
    if (costBps < 0) return 'Costs cannot be negative.';
    return null;
  }, [symbol, capital, strategy, shortW, longW, rsiLow, rsiHigh, start, end, costBps]);

  const run = async () => {
    if (validation) return;
    const req: BacktestRequest = {
      symbol: symbol.trim().toUpperCase(),
      strategy_type: strategy,
      initial_capital: capital,
      short_window: shortW,
      long_window: longW,
      cost_bps: costBps,
      benchmark: benchmark.trim().toUpperCase() || undefined,
      rsi_low: rsiLow,
      rsi_high: rsiHigh,
      start_date: start || undefined,
      end_date: end || undefined,
    };
    setLoading(true);
    setError(null);
    try {
      setResult(await runBacktest(req));
      setSaved('idle');
    } catch (e) {
      setResult(null);
      setError(backtestErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const equitySeries = useMemo<ChartSeries[]>(() => {
    if (!result) return [];
    const c = result.equity_curve;
    const out: ChartSeries[] = [
      { name: 'Strategy', color: '#ff9f1a', data: c.map((p) => ({ time: p.date, value: p.portfolio_value })) },
      { name: `Buy & hold ${result.symbol}`, color: '#9a9a9a', dashed: true, data: c.map((p) => ({ time: p.date, value: p.buy_hold_value ?? p.portfolio_value })) },
    ];
    if (result.benchmark_symbol) {
      out.push({
        name: `Benchmark ${result.benchmark_symbol}`,
        color: '#4fc3f7',
        data: c.filter((p) => p.benchmark_value !== null).map((p) => ({ time: p.date, value: p.benchmark_value as number })),
      });
    }
    return out;
  }, [result]);

  const ddSeries = useMemo<ChartSeries[]>(
    () =>
      result
        ? [{ name: 'Drawdown', color: '#ff4d4d', kind: 'area', data: result.equity_curve.map((p) => ({ time: p.date, value: p.drawdown })) }]
        : [],
    [result]
  );

  const exportTrades = () => {
    if (!result) return;
    const rows = [
      'entry_date,exit_date,entry_price,exit_price,return_pct,holding_days,open',
      ...result.trades.map((t) => `${t.entry_date},${t.exit_date},${t.entry_price},${t.exit_price},${t.return_pct},${t.holding_days},${t.open}`),
    ];
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.symbol}_${result.strategy_type}_trades.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const m = result?.metrics;

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Backtesting</h1>
        <p className="text-xs text-slate-500">
          Simulate a rule-based strategy on historical daily prices. Results are computed by the QuantLab engine; they are not
          forecasts or investment advice.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Configuration */}
        <Card noPadding className="col-span-12 lg:col-span-3 self-start">
          <CardHeader title="Configuration" />
          <div className="p-3 space-y-3">
            <Field label="Instrument">
              <div className="flex items-center gap-2">
                <span className="h-8 px-2 flex items-center border border-slate-700 bg-[#111] text-blue-400 font-bold text-xs min-w-[64px] justify-center">
                  {symbol}
                </span>
                <SymbolSearch onPick={setSymbol} placeholder="Change symbol…" className="flex-1" />
              </div>
            </Field>

            <Field label="Strategy" hint={STRATEGIES.find((s) => s.id === strategy)?.blurb}>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyType)} className={inputCls}>
                {STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            {strategy === 'sma_crossover' ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Fast SMA">
                  <input type="number" min={2} value={shortW} onChange={(e) => setShortW(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="Slow SMA">
                  <input type="number" min={3} value={longW} onChange={(e) => setLongW(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="RSI buy below">
                  <input type="number" value={rsiLow} onChange={(e) => setRsiLow(Number(e.target.value))} className={inputCls} />
                </Field>
                <Field label="RSI sell above">
                  <input type="number" value={rsiHigh} onChange={(e) => setRsiHigh(Number(e.target.value))} className={inputCls} />
                </Field>
              </div>
            )}

            <Field label="Date range">
              <div className="flex border border-slate-700 mb-2">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickRange(r.id)}
                    className={`flex-1 h-7 text-[11px] ${range === r.id ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setRange(''); }} className={inputCls} aria-label="Start date" />
                <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setRange(''); }} className={inputCls} aria-label="End date" />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Initial capital ($)">
                <input type="number" min={1} value={capital} onChange={(e) => setCapital(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Costs (bps/side)" hint="Commission + slippage">
                <input type="number" min={0} step={1} value={costBps} onChange={(e) => setCostBps(Number(e.target.value))} className={inputCls} />
              </Field>
            </div>

            <Field label="Benchmark ticker">
              <input value={benchmark} onChange={(e) => setBenchmark(e.target.value.toUpperCase())} className={inputCls} placeholder="SPY" />
            </Field>

            {validation && <p className="text-[11px] text-amber-400">{validation}</p>}

            <button
              onClick={run}
              disabled={loading || !!validation}
              className="w-full h-9 flex items-center justify-center gap-2 bg-blue-400 text-black font-bold text-xs tracking-wider uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-300"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-black" />}
              {loading ? 'Running…' : 'Run backtest'}
            </button>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Long/flat only, signals execute on the next bar (no lookahead). Prices are split/dividend-adjusted closes from Yahoo Finance.
            </p>
          </div>
        </Card>

        {/* Results */}
        <div className="col-span-12 lg:col-span-9 space-y-3 min-w-0">
          {!result && !loading && !error && (
            <Card className="!p-10 text-center">
              <p className="text-sm text-slate-300">No backtest yet</p>
              <p className="text-xs text-slate-500 mt-1">Configure a strategy on the left and press Run backtest. Nothing is shown until a real result exists.</p>
            </Card>
          )}

          {loading && (
            <Card className="!p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Fetching prices and simulating {symbol}…
            </Card>
          )}

          {error && (
            <Card className="!p-4 border-rose-500/40">
              <div className="flex items-start gap-2 text-sm text-rose-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Backtest failed</div>
                  <div className="text-xs text-slate-400 mt-0.5">{error}</div>
                </div>
              </div>
            </Card>
          )}

          {result && m && (
            <>
              <Card noPadding>
                <CardHeader
                  title={`${result.symbol} · ${STRATEGIES.find((s) => s.id === result.strategy_type)?.label}`}
                  badge="Actual backtest"
                  subtitle={`${result.equity_curve[0].date} → ${result.equity_curve[result.equity_curve.length - 1].date} · ${m.trading_days} bars`}
                  actions={
                    <button
                      onClick={saveRun}
                      disabled={saved === 'saving' || saved === 'ok'}
                      className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-blue-300 disabled:opacity-60"
                    >
                      {saved === 'ok' ? <Check className="h-3 w-3 text-emerald-400" /> : saved === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      {saved === 'ok' ? 'Saved' : saved === 'err' ? 'Retry save' : 'Save to experiments'}
                    </button>
                  }
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6">
                  <Metric label="Total return" value={signed(m.total_return_pct)} tone={tone(m.total_return_pct)} sub={`$${num(result.final_portfolio_value, 0)} final`} />
                  <Metric label="CAGR" value={signed(m.cagr_pct)} tone={tone(m.cagr_pct)} />
                  <Metric label="Volatility" value={num(m.annual_volatility_pct, 2, '%')} sub="annualised" />
                  <Metric label="Sharpe" value={num(m.sharpe_ratio)} sub="rf = 0" />
                  <Metric label="Sortino" value={num(m.sortino_ratio)} />
                  <Metric label="Max drawdown" value={signed(m.max_drawdown_pct)} tone="text-rose-400" />
                  <Metric label="Calmar" value={num(m.calmar_ratio)} />
                  <Metric label="Trades" value={String(m.total_trades)} sub={`${num(m.exposure_pct, 0, '%')} exposure`} />
                  <Metric label="Win rate" value={num(m.win_rate_pct, 1, '%')} sub="closed trades" />
                  <Metric label="Profit factor" value={num(m.profit_factor)} />
                  <Metric label={`Buy & hold ${result.symbol}`} value={signed(m.buy_hold_return_pct)} tone={tone(m.buy_hold_return_pct)} />
                  <Metric
                    label={result.benchmark_symbol ? `Benchmark ${result.benchmark_symbol}` : 'Benchmark'}
                    value={result.benchmark_symbol ? signed(result.benchmark_return_pct) : 'n/a'}
                    tone={tone(result.benchmark_return_pct)}
                    sub={result.benchmark_symbol ? undefined : 'unavailable'}
                  />
                </div>
              </Card>

              <Card noPadding>
                <CardHeader
                  title="Equity curve"
                  subtitle={`$${num(result.initial_capital, 0)} initial · costs ${result.params.cost_bps} bps/side`}
                  actions={
                    hoverVals.t ? (
                      <span className="text-[11px] tabular-nums text-slate-400">
                        {hoverVals.t} {Object.entries(hoverVals.v).map(([k, v]) => `· ${k.split(' ')[0]} $${v.toFixed(0)}`).join(' ')}
                      </span>
                    ) : null
                  }
                />
                <div className="h-[340px] p-2">
                  <SeriesChart series={equitySeries} onCrosshair={(t, v) => setHoverVals({ t, v })} />
                </div>
                <div className="px-3 pb-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
                  {equitySeries.map((s) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-0.5" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </Card>

              <Card noPadding>
                <CardHeader title="Drawdown" subtitle="Peak-to-trough decline of the strategy equity" />
                <div className="h-[200px] p-2">
                  <SeriesChart series={ddSeries} percent />
                </div>
              </Card>

              <Card noPadding>
                <CardHeader
                  title="Trade history"
                  badge={`${result.trades.length}`}
                  actions={
                    <button
                      onClick={exportTrades}
                      disabled={result.trades.length === 0}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-300 disabled:opacity-30"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </button>
                  }
                />
                {result.trades.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500">This strategy made no trades in the selected range.</p>
                ) : (
                  <div className="overflow-auto max-h-[320px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#111] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">#</th>
                          <th className="text-left font-medium px-3 py-2">Entry</th>
                          <th className="text-left font-medium px-3 py-2">Exit</th>
                          <th className="text-right font-medium px-3 py-2">Entry px</th>
                          <th className="text-right font-medium px-3 py-2">Exit px</th>
                          <th className="text-right font-medium px-3 py-2">Days</th>
                          <th className="text-right font-medium px-3 py-2">Return</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.trades].reverse().map((t, i) => (
                          <tr key={`${t.entry_date}-${i}`} className="border-t border-slate-800 hover:bg-white/[0.03]">
                            <td className="px-3 py-1.5 text-slate-600">{result.trades.length - i}</td>
                            <td className="px-3 py-1.5 tabular-nums text-slate-300">{t.entry_date}</td>
                            <td className="px-3 py-1.5 tabular-nums text-slate-300">
                              {t.exit_date} {t.open && <span className="text-[9px] text-amber-400 ml-1">OPEN</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{t.entry_price.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{t.exit_price.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{t.holding_days}</td>
                            <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${tone(t.return_pct)}`}>{signed(t.return_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <p className="text-[10px] text-slate-600">
                Data: {result.data_source}. Backtests assume no market impact and perfect fills at the close. Past performance does not
                predict future results.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
