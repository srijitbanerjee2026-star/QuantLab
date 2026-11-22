'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Star, Play, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { PriceChart, ChartType } from '@/components/dashboard/PriceChart';
import { MarketAPI, HistoryResponse, Performance, Profile, Quote } from '@/lib/api/market';
import { UNIVERSE } from '@/lib/universe';
import { useWatchlist } from '@/stores/useWatchlist';
import { useExplorerPrefs, SortKey } from '@/stores/useExplorerPrefs';

const TIMEFRAMES = [
  { id: '1M', period: '1mo', interval: '1d' },
  { id: '6M', period: '6mo', interval: '1d' },
  { id: '1Y', period: '1y', interval: '1d' },
  { id: '5Y', period: '5y', interval: '1wk' },
  { id: 'MAX', period: 'max', interval: '1mo' },
];

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBig = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  return a >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n.toLocaleString();
};
const tone = (n: number | null | undefined) => (n === null || n === undefined ? 'text-slate-400' : n >= 0 ? 'text-emerald-400' : 'text-rose-400');
const signed = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`);

const Spark: React.FC<{ points?: number[] }> = ({ points }) => {
  if (!points || points.length < 2) return <span className="inline-block w-14 h-4" />;
  const min = Math.min(...points);
  const r = Math.max(...points) - min || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * 56).toFixed(1)},${(16 - 1 - ((p - min) / r) * 14).toFixed(1)}`).join(' ');
  return (
    <svg width="56" height="16">
      <path d={d} fill="none" stroke={points[points.length - 1] >= points[0] ? '#00d26a' : '#ff4d4d'} strokeWidth="1.4" />
    </svg>
  );
};

const SortHead: React.FC<{
  k: SortKey;
  label: string;
  right?: boolean;
  active: SortKey;
  dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}> = ({ k, label, right, active, dir, onSort }) => (
  <th className={`font-medium px-3 py-2 ${right ? 'text-right' : 'text-left'}`}>
    <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-blue-300 ${active === k ? 'text-blue-400' : ''}`}>
      {label}
      {active === k && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  </th>
);

type Keyed<T> = { key: string; data: T | null; err: string | null };

function useKeyed<T>(key: string, load: () => Promise<T>): { data: T | null; err: string | null; loading: boolean } {
  const [state, setState] = useState<Keyed<T> | null>(null);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ key, data, err: null }))
      .catch((e) => {
        if (cancelled) return;
        const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        setState({ key, data: null, err: msg ?? 'Data provider unavailable.' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = state?.key !== key;
  return { data: loading ? null : state.data, err: loading ? null : state.err, loading };
}

export const MarketExplorer: React.FC<{
  focusTicker: string;
  onSelectTicker: (s: string) => void;
  onOpenBacktest: (s: string) => void;
}> = ({ focusTicker, onSelectTicker, onOpenBacktest }) => {
  const { category, sortKey, sortDir, setCategory, setSort } = useExplorerPrefs();
  const watch = useWatchlist();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(focusTicker);
  const [tf, setTf] = useState('1Y');
  const [chartType, setChartType] = useState<ChartType>('candles');

  const categories = useMemo(
    () => [
      ...UNIVERSE,
      { id: 'watchlist', label: 'My Watchlist', items: watch.symbols.map((s) => ({ symbol: s, name: 'Watchlist' })) },
    ],
    [watch.symbols]
  );
  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const symbolsKey = cat.items.map((i) => i.symbol).join(',');

  const quotesQ = useKeyed<Quote[]>(`q|${symbolsKey}`, () => MarketAPI.quotes(cat.items.map((i) => i.symbol)));
  const tfDef = TIMEFRAMES.find((t) => t.id === tf)!;
  const histQ = useKeyed<HistoryResponse>(`h|${selected}|${tf}`, () => MarketAPI.history(selected, tfDef.period, tfDef.interval));
  const perfQ = useKeyed<Performance>(`p|${selected}`, () => MarketAPI.performance(selected));
  const profQ = useKeyed<Profile>(`f|${selected}`, () => MarketAPI.profile(selected));

  const rows = useMemo(() => {
    const qmap = new Map((quotesQ.data ?? []).map((q) => [q.symbol, q]));
    const f = filter.trim().toLowerCase();
    const list = cat.items
      .filter((i) => !f || i.symbol.toLowerCase().includes(f) || i.name.toLowerCase().includes(f))
      .map((i) => ({ ...i, q: qmap.get(i.symbol) }));
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: (typeof list)[number]) =>
      sortKey === 'symbol' ? r.symbol : sortKey === 'price' ? r.q?.price ?? -Infinity : sortKey === 'volume' ? r.q?.volume ?? -Infinity : r.q?.change_pct ?? -Infinity;
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [cat, filter, quotesQ.data, sortKey, sortDir]);

  const pick = (sym: string) => {
    setSelected(sym);
    onSelectTicker(sym.replace('^', ''));
  };
  const inWatch = watch.symbols.includes(selected);
  const perf = perfQ.data;
  const prof = profQ.data;
  const rangePos = perf && perf.high_52w > perf.low_52w ? ((perf.last - perf.low_52w) / (perf.high_52w - perf.low_52w)) * 100 : null;

  return (
    <div className="space-y-3 max-w-[1700px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Market Explorer</h1>
          <p className="text-xs text-slate-500">Browse asset classes or open any ticker. Prices are delayed Yahoo Finance data.</p>
        </div>
        <SymbolSearch onPick={pick} placeholder="Open any ticker or company…" className="w-72" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-700">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 h-8 text-[11px] uppercase tracking-wider border-b-2 -mb-px ${
              c.id === cat.id ? 'border-blue-400 text-blue-400 font-bold' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Instrument table */}
        <Card noPadding className="col-span-12 xl:col-span-5 flex flex-col overflow-hidden self-start">
          <CardHeader title={cat.label} badge={`${rows.length}`} actions={<span className="text-[9px] uppercase text-amber-400">Delayed</span>} />
          <div className="p-2 border-b border-slate-800">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter this list…"
              className="w-full h-7 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-200 outline-none focus:border-blue-400/70 select-text"
              aria-label="Filter list"
            />
          </div>
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#111] text-[10px] text-slate-500">
                <tr>
                  <SortHead k="symbol" label="Symbol" active={sortKey} dir={sortDir} onSort={setSort} />
                  <SortHead k="price" label="Last" right active={sortKey} dir={sortDir} onSort={setSort} />
                  <SortHead k="change_pct" label="Chg %" right active={sortKey} dir={sortDir} onSort={setSort} />
                  <SortHead k="volume" label="Vol" right active={sortKey} dir={sortDir} onSort={setSort} />
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {quotesQ.loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      <td colSpan={5} className="px-3 py-2"><Skeleton variant="text" /></td>
                    </tr>
                  ))}
                {!quotesQ.loading && quotesQ.err && (
                  <tr><td colSpan={5} className="p-6 text-center text-rose-300">{quotesQ.err}</td></tr>
                )}
                {!quotesQ.loading && !quotesQ.err && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      {cat.items.length === 0 ? 'This list is empty. Star an instrument to add it.' : 'No instruments match your filter.'}
                    </td>
                  </tr>
                )}
                {!quotesQ.loading &&
                  rows.map((r) => (
                    <tr
                      key={r.symbol}
                      onClick={() => pick(r.symbol)}
                      className={`cursor-pointer border-t border-slate-800 hover:bg-white/[0.04] ${r.symbol === selected ? 'bg-blue-400/[0.08]' : ''}`}
                    >
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-slate-100">{r.symbol}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{r.name}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-200">{r.q?.error || !r.q ? 'n/a' : fmt(r.q.price)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${tone(r.q?.change_pct)}`}>{signed(r.q?.change_pct)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{r.q?.volume ? fmtBig(r.q.volume) : '—'}</td>
                      <td className="px-2"><Spark points={r.q?.spark} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Instrument detail */}
        <div className="col-span-12 xl:col-span-7 space-y-3 min-w-0">
          <Card noPadding>
            <div className="px-4 py-3 border-b border-slate-700 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-100">{selected}</span>
                  {prof?.quote_type && <span className="text-[9px] uppercase px-1.5 py-0.5 border border-slate-600 text-slate-400">{prof.quote_type}</span>}
                  {histQ.data && <span className="text-[9px] uppercase px-1.5 py-0.5 border border-slate-600 text-slate-400">{histQ.data.freshness}</span>}
                </div>
                <div className="text-xs text-slate-400 truncate">{prof?.name ?? (profQ.loading ? 'Loading…' : cat.items.find((i) => i.symbol === selected)?.name ?? '')}</div>
                {perf && (
                  <div className="mt-1 tabular-nums">
                    <span className="text-lg font-semibold text-slate-100">{fmt(perf.last)}</span>{' '}
                    <span className="text-xs text-slate-500">{prof?.currency}</span>{' '}
                    <span className={`text-xs ${tone(perf.returns_pct['1D'])}`}>{signed(perf.returns_pct['1D'])} today</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => (inWatch ? watch.remove(selected) : watch.add(selected))}
                  className={`h-8 px-2.5 flex items-center gap-1.5 border text-[11px] ${inWatch ? 'border-blue-400/60 text-blue-300' : 'border-slate-700 text-slate-300 hover:bg-white/5'}`}
                  aria-pressed={inWatch}
                >
                  <Star className={`h-3.5 w-3.5 ${inWatch ? 'fill-blue-400' : ''}`} /> {inWatch ? 'Watching' : 'Watch'}
                </button>
                <button
                  onClick={() => onOpenBacktest(selected)}
                  className="h-8 px-2.5 flex items-center gap-1.5 bg-blue-400 text-black font-bold text-[11px] uppercase tracking-wider hover:bg-blue-300"
                >
                  <Play className="h-3 w-3 fill-black" /> Backtest
                </button>
              </div>
            </div>

            <div className="px-3 pt-2 flex items-center justify-end gap-2">
              <div className="flex border border-slate-700">
                {(['candles', 'line'] as ChartType[]).map((t) => (
                  <button key={t} onClick={() => setChartType(t)} className={`px-2 h-7 text-[11px] capitalize ${chartType === t ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex border border-slate-700">
                {TIMEFRAMES.map((t) => (
                  <button key={t.id} onClick={() => setTf(t.id)} className={`px-2 h-7 text-[11px] ${tf === t.id ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>
                    {t.id}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[340px] p-2">
              {histQ.loading ? (
                <Skeleton variant="chart" height="h-full" />
              ) : histQ.err ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">{histQ.err}</div>
              ) : histQ.data ? (
                <PriceChart candles={histQ.data.candles} type={chartType} />
              ) : null}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card noPadding>
              <CardHeader title="Historical performance" subtitle="Adjusted close" />
              {perfQ.loading ? (
                <div className="p-4"><Skeleton variant="text" /></div>
              ) : perfQ.err ? (
                <p className="p-4 text-xs text-slate-500">{perfQ.err}</p>
              ) : perf ? (
                <>
                  <div className="grid grid-cols-4">
                    {['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y'].map((k) => (
                      <div key={k} className="px-3 py-2 border-r border-b border-slate-800">
                        <div className="text-[10px] text-slate-500">{k}</div>
                        <div className={`text-sm font-semibold tabular-nums ${tone(perf.returns_pct[k])}`}>{signed(perf.returns_pct[k], 1)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>52w low {fmt(perf.low_52w)}</span>
                        <span>52w high {fmt(perf.high_52w)}</span>
                      </div>
                      <div className="relative h-1.5 bg-slate-800">
                        {rangePos !== null && <span className="absolute -top-0.5 h-2.5 w-1 bg-blue-400" style={{ left: `calc(${rangePos}% - 2px)` }} />}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 text-[11px]">
                      <div><div className="text-slate-500">Volatility 1Y</div><div className="tabular-nums text-slate-200">{fmt(perf.volatility_1y_pct, 1)}%</div></div>
                      <div><div className="text-slate-500">Max DD 1Y</div><div className="tabular-nums text-rose-400">{signed(perf.max_drawdown_1y_pct, 1)}</div></div>
                      <div><div className="text-slate-500">From 52w high</div><div className={`tabular-nums ${tone(perf.pct_from_high_52w)}`}>{signed(perf.pct_from_high_52w, 1)}</div></div>
                    </div>
                  </div>
                </>
              ) : null}
            </Card>

            <Card noPadding>
              <CardHeader title="Instrument details" />
              {profQ.loading ? (
                <div className="p-4"><Skeleton variant="text" /></div>
              ) : profQ.err || !prof ? (
                <p className="p-4 text-xs text-slate-500">No profile metadata is available for {selected}. Pricing data above is still valid.</p>
              ) : (
                <div className="p-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    {[
                      ['Exchange', prof.exchange],
                      ['Sector', prof.sector],
                      ['Industry', prof.industry],
                      ['Country', prof.country],
                      ['Market cap', prof.market_cap ? fmtBig(prof.market_cap) : null],
                      ['P/E (TTM)', prof.trailing_pe ? fmt(prof.trailing_pe, 1) : null],
                      ['Forward P/E', prof.forward_pe ? fmt(prof.forward_pe, 1) : null],
                      ['Beta', prof.beta ? fmt(prof.beta) : null],
                      ['Avg volume', prof.avg_volume ? fmtBig(prof.avg_volume) : null],
                      ['Dividend yield', prof.dividend_yield_pct ? `${fmt(prof.dividend_yield_pct)}%` : null],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k as string}>
                          <dt className="text-slate-500">{k}</dt>
                          <dd className="text-slate-200 truncate">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  {prof.website && (
                    <a href={prof.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline">
                      <ExternalLink className="h-3 w-3" /> {prof.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {prof.summary && <p className="mt-3 text-[11px] leading-relaxed text-slate-400 line-clamp-5">{prof.summary}</p>}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
