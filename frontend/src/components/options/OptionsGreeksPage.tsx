'use client';

import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { SymbolSearch } from '@/components/dashboard/SymbolSearch';
import { useKeyed } from '@/hooks/useKeyed';
import { AnalysisAPI } from '@/lib/api/analysis';

const money = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(0)}K` : a.toFixed(0);
  return `${n < 0 ? '−' : ''}$${s}`;
};
const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(d)}%`);

const Tile: React.FC<{ label: string; value: string; sub?: string; tone?: string; hint?: string }> = ({ label, value, sub, tone, hint }) => (
  <div className="px-3 py-2.5 border-r border-b border-slate-800" title={hint}>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-base font-semibold tabular-nums mt-0.5 ${tone ?? 'text-slate-100'}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

const tip = { background: '#141414', border: '1px solid #2a2a2a', fontSize: 11 };
const axis = { fontSize: 10, fill: '#9a9a9a' };

export const OptionsGreeksPage: React.FC<{ focusTicker: string; onSelectTicker: (s: string) => void }> = ({ focusTicker, onSelectTicker }) => {
  const [exp, setExp] = useState<string | undefined>(undefined);
  const [forSymbol, setForSymbol] = useState(focusTicker);
  // An expiration only applies to the symbol it was chosen for
  const expiration = forSymbol === focusTicker ? exp : undefined;
  const q = useKeyed(`o|${focusTicker}|${expiration ?? 'auto'}`, () => AnalysisAPI.options(focusTicker, expiration));
  const d = q.data;

  // Window strikes around spot so the charts stay readable
  const strikes = d ? d.strikes.filter((s) => s.strike >= d.spot * 0.8 && s.strike <= d.spot * 1.2) : [];
  const smile = strikes.map((s) => ({ strike: s.strike, Call: s.call_iv === null ? null : s.call_iv * 100, Put: s.put_iv === null ? null : s.put_iv * 100 }));

  return (
    <div className="space-y-3 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Options &amp; Greeks</h1>
          <p className="text-xs text-slate-500">Live (delayed) option chain analytics. Available for symbols with listed options, mainly US stocks and ETFs.</p>
        </div>
        <div className="flex items-center gap-2">
          {d && (
            <select
              value={d.expiration}
              onChange={(e) => { setForSymbol(focusTicker); setExp(e.target.value); }}
              className="h-8 px-2 bg-[#050505] border border-slate-700 text-xs text-slate-100 outline-none focus:border-blue-400/70"
              aria-label="Expiration"
            >
              {d.expirations.map((e) => <option key={e.date} value={e.date}>{e.date} ({e.days}d)</option>)}
            </select>
          )}
          <SymbolSearch onPick={(x) => { setExp(undefined); setForSymbol(x); onSelectTicker(x); }} placeholder="Open any ticker…" className="w-60" />
        </div>
      </div>

      {q.loading && <Card className="!p-10"><Skeleton variant="chart" height="h-64" /></Card>}
      {q.err && (
        <Card className="!p-8 text-center">
          <p className="text-sm text-slate-300">{q.err}</p>
          <p className="text-xs text-slate-500 mt-1">Try SPY, QQQ, AAPL or another optionable symbol.</p>
        </Card>
      )}

      {d && (
        <>
          <Card noPadding>
            <CardHeader title={`${d.symbol} · ${d.expiration}`} badge={`${d.days_to_expiry}d`} subtitle={`Spot ${d.spot.toFixed(2)} · ${d.freshness}`} />
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
              <Tile label="ATM implied vol" value={pct(d.atm_iv)} />
              <Tile label="Expected move (1σ)" value={d.expected_move_1sd === null ? '—' : `±${d.expected_move_1sd.toFixed(2)}`} sub={d.expected_move_pct === null ? undefined : `±${d.expected_move_pct}% to expiry`} hint="Spot × ATM IV × √T. About 68% of outcomes fall within this range if IV is accurate." />
              <Tile label="Put/call (OI)" value={d.put_call_oi_ratio?.toFixed(2) ?? '—'} sub={`${d.total_put_oi.toLocaleString()} / ${d.total_call_oi.toLocaleString()}`} />
              <Tile label="Put/call (volume)" value={d.put_call_volume_ratio?.toFixed(2) ?? '—'} />
              <Tile label="Net GEX (est.)" value={money(d.net_gex)} tone={d.net_gex >= 0 ? 'text-emerald-400' : 'text-rose-400'} sub="per 1% move" hint="Estimate under the assumption that dealers are long calls and short puts" />
              <Tile label="Gamma flip (est.)" value={d.gamma_flip?.toFixed(2) ?? '—'} sub={d.gamma_flip ? `${(((d.gamma_flip / d.spot) - 1) * 100).toFixed(1)}% from spot` : 'no crossing in range'} />
              <Tile label="Call / put wall" value={`${d.call_wall ?? '—'} / ${d.put_wall ?? '—'}`} sub="max open interest" />
              <Tile label="Max pain" value={d.max_pain?.toFixed(2) ?? '—'} sub={d.skew_put90_minus_call110 === null ? undefined : `skew ${(d.skew_put90_minus_call110 * 100).toFixed(1)} vol pts`} hint="Strike minimising total option value at expiry. Skew = put IV at 90% minus call IV at 110% of spot." />
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <Card noPadding>
              <CardHeader title="Open interest by strike" subtitle="Calls vs puts" />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={strikes} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#161616" vertical={false} />
                    <XAxis dataKey="strike" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))} />
                    <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={strikes.reduce((a, s) => (Math.abs(s.strike - d.spot) < Math.abs(a - d.spot) ? s.strike : a), strikes[0]?.strike ?? 0)} stroke="#ff9f1a" strokeDasharray="4 3" label={{ value: 'spot', fill: '#ff9f1a', fontSize: 10, position: 'top' }} />
                    <Bar dataKey="call_oi" name="Calls" fill="#00d26a" isAnimationActive={false} />
                    <Bar dataKey="put_oi" name="Puts" fill="#ff4d4d" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="Gamma exposure by strike" badge="estimate" subtitle="$ per 1% move" />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={strikes} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#161616" vertical={false} />
                    <XAxis dataKey="strike" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => money(v)} />
                    <ReferenceLine y={0} stroke="#474747" />
                    <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(v) => [money(Number(v)), 'GEX']} />
                    <Bar dataKey="gex" name="Net GEX" isAnimationActive={false}>
                      {strikes.map((s) => <Cell key={s.strike} fill={s.gex >= 0 ? '#00d26a' : '#ff4d4d'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="Implied volatility smile" subtitle="IV (%) by strike" />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={smile} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#161616" />
                    <XAxis dataKey="strike" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(0)}`} />
                    <Tooltip contentStyle={tip} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Put" stroke="#ff4d4d" dot={false} connectNulls isAnimationActive={false} />
                    <Line type="monotone" dataKey="Call" stroke="#00d26a" dot={false} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card noPadding>
              <CardHeader title="ATM implied vol term structure" subtitle="Nearest expirations" />
              <div className="p-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={d.term_structure.filter((t) => t.atm_iv !== null).map((t) => ({ label: `${t.days}d`, 'ATM IV': (t.atm_iv as number) * 100 }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#161616" />
                    <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} tickFormatter={(v: number) => `${v.toFixed(0)}`} />
                    <Tooltip contentStyle={tip} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Line type="monotone" dataKey="ATM IV" stroke="#ff9f1a" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="!p-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <b className="text-slate-400">How to read this.</b> {d.assumptions} Risk-free rate {pct(d.risk_free_rate, 2)} ({d.risk_free_source}). Contracts with no usable
              implied volatility (zero-bid or stale quotes) are excluded from greeks rather than filled with a guess. Source: {d.source}.
            </p>
          </Card>
        </>
      )}
    </div>
  );
};
