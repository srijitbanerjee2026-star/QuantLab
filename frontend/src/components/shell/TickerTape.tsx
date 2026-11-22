'use client';

import React, { useEffect, useState } from 'react';
import { MarketAPI, Quote } from '@/lib/api/market';
import { useWatchlist } from '@/stores/useWatchlist';

const BASE = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX', 'GLD', 'TLT'];

/** Scrolling quote tape (delayed Yahoo Finance data). Pauses on hover. */
export const TickerTape: React.FC<{ onSelect: (s: string) => void }> = ({ onSelect }) => {
  const watch = useWatchlist((s) => s.symbols);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const key = watch.join(',');

  useEffect(() => {
    const syms = Array.from(new Set([...BASE, ...watch]));
    let alive = true;
    const load = () =>
      MarketAPI.quotes(syms)
        .then((q) => alive && setQuotes(q.filter((x) => x.price !== undefined)))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (quotes.length === 0) {
    return <div className="h-6 border-b border-slate-700 bg-black text-[10px] text-slate-600 flex items-center px-3">LOADING QUOTES…</div>;
  }
  const row = quotes.map((q) => (
    <button
      key={q.symbol}
      onClick={() => onSelect(q.symbol.replace('^', ''))}
      className="flex items-center gap-1.5 px-4 text-[11px] whitespace-nowrap hover:bg-white/5"
    >
      <span className="font-bold text-blue-400">{q.symbol}</span>
      <span className="tabular-nums text-slate-200">{q.price!.toFixed(2)}</span>
      <span className={`tabular-nums ${(q.change_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {(q.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(q.change_pct ?? 0).toFixed(2)}%
      </span>
    </button>
  ));
  return (
    <div className="h-6 border-b border-slate-700 bg-black overflow-hidden flex items-center" aria-label="Market ticker tape (delayed)">
      <div className="tape-track">
        {row}
        {row}
      </div>
    </div>
  );
};
