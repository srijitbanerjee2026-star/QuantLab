'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { useKeyed } from '@/hooks/useKeyed';
import { AnalysisAPI } from '@/lib/api/analysis';
import { TechChart, Overlays } from './TechChart';

const PERIODS = [
  { id: '6M', years: 0.5 },
  { id: '1Y', years: 1 },
  { id: '2Y', years: 2 },
  { id: '5Y', years: 5 },
];

const OVERLAY_LABELS: { key: keyof Overlays; label: string; color: string }[] = [
  { key: 'sma20', label: 'SMA 20', color: '#ffd24a' },
  { key: 'sma50', label: 'SMA 50', color: '#4fc3f7' },
  { key: 'sma200', label: 'SMA 200', color: '#c792ea' },
  { key: 'bollinger', label: 'Bollinger', color: '#6e6e6e' },
  { key: 'volume', label: 'Volume', color: '#9a9a9a' },
];

const Row: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-800 last:border-0 text-xs">
    <span className="text-slate-500" title={hint}>{label}</span>
    <span className="text-right text-slate-200 tabular-nums">{value}</span>
  </div>
);

export const TechnicalAnalysis: React.FC<{ focusTicker: string; onSelectTicker: (s: string) => void }> = ({ focusTicker, onSelectTicker }) => {
  const [period, setPeriod] = useState('1Y');
  const [overlays, setOverlays] = useState<Overlays>({ sma20: true, sma50: true, sma200: true, bollinger: false, volume: true });
  const years = PERIODS.find((p) => p.id === period)!.years;
  const q = useKeyed(`t|${focusTicker}|${years}`, () => AnalysisAPI.technicals(focusTicker, years));
  const s = q.data?.summary;
  const pos = (v: string | null) => (v === 'above' ? 'text-emerald-400' : v === 'below' ? 'text-rose-400' : 'text-slate-400');

  return (
    <div className="space-y-3 max-w-[1700px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Technical Analysis</h1>
          <p className="text-xs text-slate-500">Trend, momentum and volatility indicators for any ticker. Indicators describe past prices; they do not predict the future.</p>
        </div>
        <SymbolSearch onPick={(x) => onSelectTicker(x.replace('^', ''))} placeholder="Open any ticker…" className="w-64" />
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card noPadding className="col-span-12 xl:col-span-9 min-w-0">
          <div className="px-4 py-2.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-100">{focusTicker}</span>
              {q.data && <span className="text-[9px] uppercase px-1.5 py-0.5 border border-slate-600 text-slate-400">{q.data.freshness ?? 'historical'}</span>}
              {s && <span className="tabular-nums text-sm text-slate-300">{s.last_close.toFixed(2)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1">
                {OVERLAY_LABELS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setOverlays({ ...overlays, [o.key]: !overlays[o.key] })}
                    aria-pressed={overlays[o.key]}
                    className={`h-7 px-2 flex items-center gap-1.5 text-[11px] border ${overlays[o.key] ? 'border-slate-500 text-slate-100' : 'border-slate-800 text-slate-600 hover:text-slate-400'}`}
                  >
                    <span className="inline-block w-2 h-0.5" style={{ background: overlays[o.key] ? o.color : '#2a2a2a' }} />
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex border border-slate-700">
                {PERIODS.map((p) => (
                  <button key={p.id} onClick={() => setPeriod(p.id)} className={`px-2.5 h-7 text-[11px] ${period === p.id ? 'bg-blue-400/15 text-blue-300' : 'text-slate-400 hover:bg-white/5'}`}>
                    {p.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-[640px] p-2">
            {q.loading ? <Skeleton variant="chart" height="h-full" /> : q.err ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center px-6">{q.err}</div>
            ) : q.data ? (
              <TechChart data={q.data} overlays={overlays} />
            ) : null}
          </div>
        </Card>

        <div className="col-span-12 xl:col-span-3 space-y-3">
          <Card noPadding>
            <CardHeader title="Indicator read-out" subtitle="Latest bar" />
            <div className="px-3 py-1">
              {q.loading && <div className="py-3"><Skeleton variant="text" /></div>}
              {s && (
                <>
                  <Row label="vs SMA 50" value={<span className={pos(s.trend_vs_sma50)}>{s.trend_vs_sma50 ?? '—'}</span>} />
                  <Row label="vs SMA 200" value={<span className={pos(s.trend_vs_sma200)}>{s.trend_vs_sma200 ?? '—'}</span>} />
                  <Row label="Moving averages" value={s.golden_cross_state ?? '—'} hint="Whether the 50-day average sits above the 200-day" />
                  <Row label="RSI (14)" value={s.rsi_14 === null ? '—' : `${s.rsi_14} · ${s.rsi_state}`} hint="Wilder RSI. Above 70 is conventionally overbought, below 30 oversold" />
                  <Row label="MACD" value={s.macd_state ?? '—'} />
                  <Row
                    label="Last MACD cross"
                    value={s.last_macd_cross ? <span className={s.last_macd_cross.direction === 'bullish' ? 'text-emerald-400' : 'text-rose-400'}>{s.last_macd_cross.direction}, {s.last_macd_cross.bars_ago}d ago</span> : '—'}
                  />
                  <Row label="Bollinger %B" value={s.bollinger_pct_b ?? '—'} hint="0 = lower band, 1 = upper band" />
                  <Row label="ATR (14)" value={s.atr_14 === null ? '—' : `${s.atr_14} (${s.atr_pct}%)`} hint="Average true range: typical daily movement" />
                  <Row label="Volume vs 20d avg" value={s.volume_vs_20d_avg === null ? '—' : `${s.volume_vs_20d_avg}×`} />
                  <Row label="52w range" value={`${s.low_52w.toFixed(2)} – ${s.high_52w.toFixed(2)}`} />
                </>
              )}
            </div>
          </Card>
          <Card className="!p-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Prices are split- and dividend-adjusted daily closes (Yahoo Finance). SMA 200 and the other indicators are computed with a
              warm-up year so they are valid from the first bar shown. This panel states conditions, not recommendations.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
