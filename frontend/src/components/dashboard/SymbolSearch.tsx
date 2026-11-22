'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { MarketAPI, SearchResult } from '@/lib/api/market';

const TRADABLE = new Set(['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CRYPTOCURRENCY']);

export const SymbolSearch: React.FC<{
  onPick: (symbol: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ onPick, placeholder = 'Search any ticker or company…', className = '' }) => {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; items: SearchResult[] }>({ q: '', items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const term = q.trim();
  const results = found.q === term ? found.items : [];
  const busy = term.length > 0 && found.q !== term;

  useEffect(() => {
    if (!term) return;
    const t = setTimeout(() => {
      MarketAPI.search(term)
        .then((r) => setFound({ q: term, items: r.filter((x) => !x.type || TRADABLE.has(x.type)) }))
        .catch(() => setFound({ q: term, items: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = (sym: string) => {
    onPick(sym.toUpperCase());
    setQ('');
    setOpen(false);
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-[#050505] border border-slate-700 focus-within:border-blue-400/60">
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) pick(results[0]?.symbol ?? q.trim());
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          className="bg-transparent outline-none text-xs text-slate-200 placeholder:text-slate-500 w-full select-text"
          aria-label="Search symbols"
        />
      </div>
      {open && q.trim() && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-[#141414] border border-slate-700 rounded-md shadow-xl overflow-hidden">
          {busy && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>}
          {!busy && results.length === 0 && (
            <button
              onClick={() => pick(q.trim())}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-white/5"
            >
              No matches. Use <span className="font-mono text-slate-200">{q.trim().toUpperCase()}</span> anyway
            </button>
          )}
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => pick(r.symbol)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-semibold text-slate-100">{r.symbol}</span>
                <span className="text-xs text-slate-400 truncate">{r.name}</span>
              </span>
              <span className="text-[10px] uppercase text-slate-500 shrink-0">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
