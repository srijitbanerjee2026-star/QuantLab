import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import { MacroData } from '@/types';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Stat } from '@/components/ui/Stat';
import { fmtPct } from '@/lib/format';

export interface MacroeconomicsProps {
  data: MacroData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const Macroeconomics: React.FC<MacroeconomicsProps> = ({
  data,
  loading,
  error,
  onRefresh,
}) => {
  const isInverted = data ? data.currentSpread < 0 : false;
  const isSahmTriggered = data ? data.sahmTriggered : false;

  return (
    <div className="space-y-4">
      {/* 1. Macro KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="10Y Treasury Yield"
          value={data ? `${data.tenYearYield.toFixed(2)}%` : '—'}
          subtext="^TNX Benchmark"
          valueColor="text-white"
        />
        <Stat
          label="2Y Treasury Yield"
          value={data ? `${data.twoYearYield.toFixed(2)}%` : '—'}
          subtext="Short-End Rate"
          valueColor="text-white"
        />
        <Stat
          label="10Y-2Y Curve Spread"
          value={data ? `${data.currentSpread > 0 ? '+' : ''}${data.currentSpread.toFixed(2)}%` : '—'}
          subtext={isInverted ? 'INVERTED CURVE (ALERT)' : 'NORMALIZED SLOPE'}
          valueColor={isInverted ? 'text-rose-400' : 'text-emerald-400'}
        />
        <Stat
          label="Sahm Rule Status"
          value={data ? `${data.currentSahm.toFixed(2)}%` : '—'}
          subtext={isSahmTriggered ? 'TRIGGERED (RECESSION)' : 'CLEAR (SAFE < 0.50%)'}
          valueColor={isSahmTriggered ? 'text-rose-400' : 'text-emerald-400'}
        />
        <Stat
          label="Recession Probability"
          value={data ? `${data.currentRecessionProb.toFixed(1)}%` : '—'}
          subtext="12-Month Forward Model"
          valueColor={
            data && data.currentRecessionProb > 40
              ? 'text-rose-400'
              : data && data.currentRecessionProb > 25
              ? 'text-amber-400'
              : 'text-emerald-400'
          }
        />
      </div>

      {/* 2. Yield Curve Overlay (Current vs 1M vs 1Y ago) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartFrame
          title="US Treasury Yield Curve Term Structure"
          badge={isInverted ? 'INVERTED' : 'NORMAL'}
          subtitle="Current vs. 1 Month Ago vs. 1 Year Ago"
          heightClass="h-[340px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={data?.yieldCurve}
          exportFilename="yield_curve.csv"
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.yieldCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="maturity"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#cbd5e1', fontFamily: 'monospace', fontWeight: 'bold' }}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      unit="%"
                      formatValue={(v) => `${v}%`}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#06b6d4' }}
                  name="Current Yield %"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="monthAgo"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2 }}
                  name="1M Ago"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="yearAgo"
                  stroke="#475569"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                  name="1Y Ago"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* 10Y-2Y Spread History with Recession Zones */}
        <ChartFrame
          title="10Y - 2Y Spread Historical Trajectory"
          badge="Inversion Zero Line"
          subtitle="Shaded Danger Regime below 0.0%"
          heightClass="h-[340px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={data?.spreadHistory}
          exportFilename="spread_history.csv"
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.spreadHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(d) => (typeof d === 'string' && d.length >= 5 ? d.substring(5) : d)}
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
                      formatValue={(v) => fmtPct(v)}
                    />
                  }
                />
                <ReferenceLine
                  y={0}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: 'Inversion (0.0%)', fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }}
                />
                <Area
                  type="monotone"
                  dataKey="spread10y2y"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#spreadGrad)"
                  name="10Y-2Y Spread"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>

      {/* 3. Sahm Rule Indicator & Recession Probability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sahm Rule Indicator */}
        <ChartFrame
          title="Sahm Rule Recession Indicator"
          badge="Trigger &ge; 0.50%"
          subtitle="3M Unemployment Average vs 12M Low"
          heightClass="h-[320px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={data?.sahmSeries}
          exportFilename="sahm_rule.csv"
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sahmSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(d) => (typeof d === 'string' && d.length >= 5 ? d.substring(5) : d)}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  domain={[0, 'auto']}
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
                  y={0.50}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: 'Recession Trigger 0.50%', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  name="Sahm Value %"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Recession Probability Forecast Timeline */}
        <ChartFrame
          title="Forward Recession Risk Probability"
          badge="12M Forecast [0-100%]"
          subtitle="Composite: Yield Spread + Sahm Momentum"
          heightClass="h-[320px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
          exportData={data?.recessionSeries}
          exportFilename="recession_probability.csv"
        >
          {data && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.recessionSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                  tickFormatter={(d) => (typeof d === 'string' && d.length >= 5 ? d.substring(5) : d)}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                  domain={[0, 100]}
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
                  y={40}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: 'High Risk (40%)', fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }}
                />
                <Area
                  type="monotone"
                  dataKey="probability"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  name="Recession Prob %"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    </div>
  );
};
