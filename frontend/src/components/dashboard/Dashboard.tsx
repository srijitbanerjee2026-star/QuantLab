'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarketAPI, Candle, HistoryResponse, Quote, Freshness } from '@/lib/api/market';
import { listExperiments, ExperimentRecord } from '@/lib/api/ml';
import { useWatchlist } from '@/stores/useWatchlist';
import { PriceChart, ChartType } from './PriceChart';
import { SymbolSearch } from './SymbolSearch';

const INDICES: { symbol: string; label: string }[] = [
  { symbol: 'SPY', label: 'S&P 500 (SPY)' },
  { symbol: 'QQQ', label: 'Nasdaq 100 (QQQ)' },
  { symbol: 'DIA', label: 'Dow Jones (DIA)' },
  { symbol: 'IWM', label: 'Russell 2000 (IWM)' },
  { symbol: '^VIX', label: 'VIX' },
  { symbol: 'GLD', label: 'Gold (GLD)' },
];

const TIMEFRAMES: { id: string; label: string; period: string; interval: string }[] = [
  { id: '1D', label: '1D', period: '1d', interval: '5m' },
  { id: '5D', label: '5D', period: '5d', interval: '30m' },
  { id: '1M', label: '1M', period: '1mo', interval: '1d' },
  { id: '6M', label: '6M', period: '6mo', interval: '1d' },
  { id: '1Y', label: '1Y', period: '1y', interval: '1d' },
  { id: '5Y', label: '5Y', period: '5y', interval: '1wk' },
];

const FRESH_STYLE: Record<Freshness, string> = {
  live: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  delayed: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  historical: 'text-slate-400 border-slate-600 bg-white/5',
  demo: 'text-blue-300 border-blue-400/30 bg-blue-400/10',
};

const FreshnessBadge: React.FC<{ kind: Freshness }> = ({ kind }) => (
  <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${FRESH_STYLE[kind]}`}>
    {kind}
  </span>
);

const fmtNum = (n?: number, d = 2) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtVol = (n?: number) =>
  n === undefined ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${(n / 1e3).toFixed(0)}K`;
const tone = (n?: number) => (n === undefined ? 'text-slate-400' : n >= 0 ? 'text-emerald-400' : 'text-rose-400');

const Spark: React.FC<{ points?: number[]; w?: number; h?: number }> = ({ points, w = 64, h = 22 }) => {
  if (!points || points.length < 2) return <span className="inline-block" style={{ width: w, height: h }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const r = max - min || 1;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / r) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke={points[points.length - 1] >= points[0] ? '#00d26a' : '#ff4d4d'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

export const Dashboard: React.FC<{ focusTicker: string; onSelectTicker: (s: string) => void }> = ({
  focusTicker,
  onSelectTicker,
}) => {
  const [tf, setTf] = useState('6M');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [nonce, setNonce] = useState(0);
  const chartKey = `${focusTicker}|${tf}|${nonce}`;
  const [histState, setHistState] = useState<{ key: string; data: HistoryResponse | null; err: string | null } | null>(null);
  const histLoading = histState?.key !== chartKey;
  const hist = histLoading ? null : histState.data;
  const histErr = histLoading ? null : histState.err;

  const [indexQuotes, setIndexQuotes] = useState<Quote[] | null>(null);
  const [watchQuotes, setWatchQuotes] = useState<Record<string, Quote>>({});
  const { symbols, add, remove } = useWatchlist();

  const [health, setHealth] = useState<{ api: boolean; db: boolean } | null>(null);
  const [syncedAt, setSyncedAt] = useState<string>('—');
  // Server snapshot is empty so the prerender never reads the clock.
  const today = useSyncExternalStore(
    () => () => undefined,
    () => new Date().toISOString().slice(0, 10),
    () => ''
  );
  const [experiments, setExperiments] = useState<ExperimentRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
    MarketAPI.history(focusTicker, tfDef.period, tfDef.interval)
      .then((data) => {
        if (cancelled) return;
        setHistState({ key: chartKey, data, err: null });
        setSyncedAt(new Date().toLocaleTimeString());
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        setHistState({ key: chartKey, data: null, err: msg ?? 'Could not load market data. Is the backend running?' });
      });
    return () => {
      cancelled = true;
    };
  }, [focusTicker, tf, chartKey]);

  useEffect(() => {
    MarketAPI.quotes(INDICES.map((i) => i.symbol)).then(setIndexQuotes).catch(() => setIndexQuotes([]));
    MarketAPI.health().then(setHealth);
    listExperiments().then(setExperiments).catch(() => setExperiments([]));
  }, []);

  useEffect(() => {
    if (symbols.length === 0) return;
    MarketAPI.quotes(symbols)
      .then((qs) => setWatchQuotes(Object.fromEntries(qs.map((q) => [q.symbol, q]))))
      .catch(() => undefined);
  }, [symbols]);

  const last: Candle | undefined = hist?.candles[hist.candles.length - 1];
  const first: Candle | undefined = hist?.candles[0];
  const periodChg = last && first ? (last.close / first.close - 1) * 100 : undefined;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Overview</h1>
          <p className="text-xs text-slate-500">Your quantitative research environment.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="uppercase tracking-wider">Universe</span>
          <span className="px-2 py-1 rounded border border-slate-700 text-slate-300">Global equities &amp; ETFs</span>
          <span className="px-2 py-1 rounded border border-slate-700 font-mono text-slate-300">
            {today || '—'}
          </span>
        </div>
      </div>

      {/* Market overview strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {INDICES.map((idx) => {
          const q = indexQuotes?.find((x) => x.symbol === idx.symbol);
          return (
            <Card key={idx.symbol} className="!p-3">
              {indexQuotes === null ? (
                <Skeleton variant="text" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate">{idx.label}</span>
                    <FreshnessBadge kind="delayed" />
                  </div>
                  <div className="mt-1.5 flex items-end justify-between gap-2">
                    <div>
                      <div className="font-mono tabular-nums text-base font-semibold text-slate-100">{fmtNum(q?.price)}</div>
                      <div className={`font-mono tabular-nums text-[11px] ${tone(q?.change_pct)}`}>
                        {q?.change !== undefined ? `${q.change >= 0 ? '+' : ''}${fmtNum(q.change)}` : '—'}{' '}
                        {q?.change_pct !== undefined ? `(${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(2)}%)` : ''}
                      </div>
                    </div>
                    <Spark points={q?.spark} />
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main chart */}
        <Card noPadding className="col-span-12 xl:col-span-8 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold text-slate-100">{focusTicker}</span>
                  {hist && <FreshnessBadge kind={hist.freshness} />}
                </div>
                <div className="font-mono tabular-nums text-xs text-slate-400">
                  {last ? fmtNum(last.close) : '—'}{' '}
                  <span className={tone(periodChg)}>
                    {periodChg !== undefined ? `${periodChg >= 0 ? '+' : ''}${periodChg.toFixed(2)}% over ${tf}` : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SymbolSearch onPick={onSelectTicker} className="w-56" />
              <div className="flex rounded-md border border-slate-700 overflow-hidden">
                {(['candles', 'line'] as ChartType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={`px-2.5 h-8 text-[11px] capitalize ${chartType === t ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md border border-slate-700 overflow-hidden">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTf(t.id)}
                    className={`px-2.5 h-8 text-[11px] font-mono ${tf === t.id ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-[420px] p-2 relative">
            {histLoading ? (
              <Skeleton variant="chart" height="h-full" />
            ) : histErr ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-slate-300">{histErr}</p>
                <button
                  onClick={() => setNonce((n) => n + 1)}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-white/5"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            ) : hist ? (
              <PriceChart candles={hist.candles} type={chartType} />
            ) : null}
          </div>
        </Card>

        {/* Watchlist */}
        <Card noPadding className="col-span-12 xl:col-span-4 flex flex-col overflow-hidden">
          <CardHeader title="Watchlist" badge="Local" actions={<FreshnessBadge kind="delayed" />} />
          <div className="p-3 border-b border-slate-700">
            <SymbolSearch onPick={add} placeholder="Add ticker to watchlist…" />
          </div>
          <div className="overflow-auto max-h-[372px]">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 bg-[#0b0b0b]">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Symbol</th>
                  <th className="text-right font-medium px-2 py-2">Last</th>
                  <th className="text-right font-medium px-2 py-2">Chg %</th>
                  <th className="text-right font-medium px-2 py-2 hidden md:table-cell">Vol</th>
                  <th className="px-2 py-2 hidden lg:table-cell" />
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {symbols.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Your watchlist is empty. Search above to add any ticker.
                    </td>
                  </tr>
                )}
                {symbols.map((s) => {
                  const q = watchQuotes[s];
                  return (
                    <tr
                      key={s}
                      onClick={() => onSelectTicker(s)}
                      className={`cursor-pointer border-t border-slate-800 hover:bg-white/[0.04] ${s === focusTicker ? 'bg-blue-400/[0.07]' : ''}`}
                    >
                      <td className="px-4 py-2 font-mono font-semibold text-slate-100">{s}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-200">{q?.error ? 'n/a' : fmtNum(q?.price)}</td>
                      <td className={`px-2 py-2 text-right font-mono tabular-nums ${tone(q?.change_pct)}`}>
                        {q?.change_pct !== undefined ? `${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400 hidden md:table-cell">{fmtVol(q?.volume)}</td>
                      <td className="px-2 py-2 hidden lg:table-cell"><Spark points={q?.spark} w={56} h={18} /></td>
                      <td className="pr-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(s);
                          }}
                          className="p-1 text-slate-600 hover:text-rose-400"
                          aria-label={`Remove ${s}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Portfolio snapshot */}
        <Card noPadding className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardHeader title="Portfolio snapshot" />
          <div className="p-6 text-center space-y-2">
            <Plus className="h-5 w-5 mx-auto text-slate-600" />
            <p className="text-sm text-slate-300">No portfolio connected</p>
            <p className="text-xs text-slate-500">
              QuantLab has no holdings data yet, so no value or return is shown. Use Portfolio → Optimisation to
              explore allocations for any basket of tickers.
            </p>
          </div>
        </Card>

        {/* Research activity */}
        <Card noPadding className="col-span-12 md:col-span-6 xl:col-span-5">
          <CardHeader title="Research activity" badge="Experiments" />
          <div className="divide-y divide-slate-800">
            {experiments === null && <div className="p-4"><Skeleton variant="text" /></div>}
            {experiments?.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                No logged experiments yet. Train a model in Research → ML Models to log your first one.
              </div>
            )}
            {experiments?.slice(0, 5).map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="text-slate-200 truncate">{e.name}</div>
                  <div className="text-slate-500 truncate">{e.experiment_type.replace('_', ' ')} · {String(e.parameters.symbol ?? '')}</div>
                </div>
                <span className="font-mono tabular-nums text-slate-300">
                  {typeof e.metrics.accuracy === 'number'
                    ? `Acc ${(e.metrics.accuracy * 100).toFixed(1)}%`
                    : typeof e.metrics.sharpe_ratio === 'number'
                      ? `Sharpe ${e.metrics.sharpe_ratio.toFixed(2)}`
                      : ''}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* System health */}
        <Card noPadding className="col-span-12 xl:col-span-3">
          <CardHeader title="System health" />
          <ul className="p-4 space-y-2.5 text-xs">
            {[
              { label: 'Backend API', ok: health?.api },
              { label: 'Database', ok: health?.db },
              { label: 'Market data (Yahoo Finance)', ok: histErr ? false : hist ? true : undefined },
            ].map((r) => (
              <li key={r.label} className="flex items-center justify-between">
                <span className="text-slate-400">{r.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${r.ok === undefined ? 'bg-slate-600' : r.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="text-slate-300">{r.ok === undefined ? 'Checking' : r.ok ? 'Operational' : 'Unavailable'}</span>
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-slate-400">Last sync</span>
              <span className="font-mono text-slate-300">{syncedAt}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
