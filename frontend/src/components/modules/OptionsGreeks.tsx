import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import { OptionsData } from '@/types';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Stat } from '@/components/ui/Stat';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { fmtPrice, fmtCompact, fmtRatio } from '@/lib/format';

export interface OptionsGreeksProps {
  symbol: string;
  data: OptionsData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const OptionsGreeks: React.FC<OptionsGreeksProps> = ({
  symbol,
  data,
  loading,
  error,
  onRefresh,
}) => {
  const [selectedExpiry, setSelectedExpiry] = useState<string>(
    data?.selectedExpiration || '2026-11-21'
  );

  const strikes = data?.strikes || [];

  return (
    <div className="space-y-4">
      {/* 1. KPI Strip on Top with Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat
          label="Net Market GEX"
          value={data ? `${data.netGex > 0 ? '+' : ''}${data.netGex.toFixed(1)}M` : '—'}
          subtext={data && data.netGex >= 0 ? 'Long Gamma (Buffer)' : 'Short Gamma (Accel)'}
          valueColor={data && data.netGex >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          sparkline={data?.sparklines.gex}
        />
        <Stat
          label="Gamma Flip Strike"
          value={data ? fmtPrice(data.gammaFlip) : '—'}
          subtext="Regime Boundary"
          valueColor="text-amber-400"
        />
        <Stat
          label="Call Wall"
          value={data ? fmtPrice(data.callWall) : '—'}
          subtext="Resistance Barrier"
          valueColor="text-emerald-400"
        />
        <Stat
          label="Put Wall"
          value={data ? fmtPrice(data.putWall) : '—'}
          subtext="Support Level"
          valueColor="text-rose-400"
        />
        <Stat
          label="Put / Call Ratio"
          value={data ? fmtRatio(data.putCallRatio, 2) : '—'}
          subtext="Open Interest Basis"
          valueColor="text-purple-400"
          sparkline={data?.sparklines.oi}
        />
        <Stat
          label="ATM Implied Vol"
          value={data ? `${data.atmIv.toFixed(1)}%` : '—'}
          subtext="Front Expiry &sigma;"
          valueColor="text-blue-400"
          sparkline={data?.sparklines.iv}
        />
      </div>

      {/* Expiry Selector Bar */}
      {data?.expirations && data.expirations.length > 0 && (
        <div className="flex items-center justify-between bg-[#0c111d] border border-slate-800/80 px-4 py-2 rounded-lg text-xs font-mono">
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Selected Expiry Cycle:
          </span>
          <SegmentedControl
            options={data.expirations.map((exp) => ({ id: exp, label: exp }))}
            value={selectedExpiry}
            onChange={(exp) => setSelectedExpiry(exp)}
            size="xs"
          />
        </div>
      )}

      {/* 2. GEX & DEX Strike Profile Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Net GEX Profile */}
        <ChartFrame
          title="Net Gamma Exposure (GEX) by Strike"
          badge="Dealer Gamma $M"
          subtitle="Calls Positive (+) / Puts Negative (−)"
          heightClass="h-[360px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={strikes}
          exportFilename={`${symbol}_gex.csv`}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strikes} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(s) => `$${s}`}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="M"
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      unit="M"
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v}M`}
                    />
                  }
                />
                <ReferenceLine y={0} stroke="#475569" />
                <ReferenceLine
                  x={data.spotPrice}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  label={{ value: 'Spot', fill: '#3b82f6', fontSize: 10, fontFamily: 'monospace', position: 'top' }}
                />
                <ReferenceLine
                  x={data.gammaFlip}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{ value: 'Flip', fill: '#f59e0b', fontSize: 10, fontFamily: 'monospace', position: 'top' }}
                />
                <Bar dataKey="gex" name="Net GEX ($M)" radius={[2, 2, 0, 0]}>
                  {strikes.map((entry, index) => (
                    <Cell
                      key={`gex-${index}`}
                      fill={entry.gex >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* DEX Profile */}
        <ChartFrame
          title="Net Delta Exposure (DEX) by Strike"
          badge="Dollar Delta $M"
          subtitle="Directional Sensitivity across Strikes"
          heightClass="h-[360px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={strikes}
          exportFilename={`${symbol}_dex.csv`}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strikes} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(s) => `$${s}`}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="M"
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      unit="M"
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v}M`}
                    />
                  }
                />
                <ReferenceLine y={0} stroke="#475569" />
                <ReferenceLine
                  x={data.spotPrice}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="dex"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.2}
                  name="DEX ($M)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>

      {/* 3. Call vs Put Open Interest & IV Skew Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open Interest Distribution */}
        <ChartFrame
          title="Open Interest Distribution (Calls vs Puts)"
          badge="Contract Volume"
          subtitle="Call Wall & Put Wall Density"
          heightClass="h-[320px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strikes} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(s) => `$${s}`}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine x={data.callWall} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine x={data.putWall} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="call_oi" fill="#10b981" name="Call OI" radius={[2, 2, 0, 0]} />
                <Bar dataKey="put_oi" fill="#ef4444" name="Put OI" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* IV Skew Curve */}
        <ChartFrame
          title="Implied Volatility (IV) Skew Smile"
          badge="&sigma; %"
          subtitle="Calls vs Puts Volatility Smile"
          heightClass="h-[320px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={strikes} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(s) => `$${s}`}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      unit="%"
                      formatValue={(v) => `${v}%`}
                    />
                  }
                />
                <ReferenceLine
                  x={data.spotPrice}
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  label={{ value: 'ATM', fill: '#3b82f6', fontSize: 10, fontFamily: 'monospace', position: 'top' }}
                />
                <Line
                  type="monotone"
                  dataKey="call_iv"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name="Call IV %"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="put_iv"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  name="Put IV %"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    </div>
  );
};
