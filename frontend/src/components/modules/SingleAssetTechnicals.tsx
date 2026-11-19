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
} from 'recharts';
import { FeaturePoint } from '@/types';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Stat } from '@/components/ui/Stat';
import { fmtPrice, fmtPct } from '@/lib/format';

export interface SingleAssetTechnicalsProps {
  symbol: string;
  data: FeaturePoint[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const SingleAssetTechnicals: React.FC<SingleAssetTechnicalsProps> = ({
  symbol,
  data,
  loading,
  error,
  onRefresh,
}) => {
  const points = data || [];
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const prev = points.length > 1 ? points[points.length - 2] : null;

  const priceDelta = latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Top Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Last Close"
          value={latest ? fmtPrice(latest.close) : '—'}
          delta={priceDelta}
          subtext={`Ticker: $${symbol}`}
          sparkline={points.slice(-15).map((p) => p.close)}
        />
        <Stat
          label="SMA-20 vs SMA-50"
          value={latest ? fmtPrice(latest.sma_20) : '—'}
          subtext={latest ? `SMA-50: ${fmtPrice(latest.sma_50)}` : '—'}
          valueColor={
            latest && latest.sma_20 >= latest.sma_50 ? 'text-emerald-400' : 'text-rose-400'
          }
        />
        <Stat
          label="RSI-14 (Momentum)"
          value={latest ? latest.rsi_14.toFixed(1) : '—'}
          subtext={
            latest
              ? latest.rsi_14 > 70
                ? 'Overbought Zone'
                : latest.rsi_14 < 30
                ? 'Oversold Zone'
                : 'Neutral Regime'
              : '—'
          }
          valueColor={
            latest
              ? latest.rsi_14 > 70
                ? 'text-rose-400'
                : latest.rsi_14 < 30
                ? 'text-emerald-400'
                : 'text-purple-400'
              : undefined
          }
        />
        <Stat
          label="Annualized 20D Vol"
          value={latest ? fmtPct(latest.volatility_20d * 100) : '—'}
          subtext="252-Day Annualized"
          valueColor="text-amber-400"
        />
      </div>

      {/* Main Chart: Price + Moving Averages */}
      <ChartFrame
        title={`${symbol} Primary Technical Engine`}
        badge="SMA 20 & 50"
        subtitle="Daily Close with 20D and 50D Simple Moving Averages"
        heightClass="h-[360px]"
        loading={loading}
        error={error}
        onRetry={onRefresh}
        exportData={points}
        exportFilename={`${symbol}_technicals.csv`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
              tickFormatter={(d) => (typeof d === 'string' && d.length >= 5 ? d.substring(5) : d)}
            />
            <YAxis
              stroke="#64748b"
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              content={
                <ChartTooltip
                  unit="$"
                  formatValue={(v) => fmtPrice(v)}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '8px' }} />
            <Line
              type="monotone"
              dataKey="adj_close"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
              name="Price (Close)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sma_20"
              stroke="#10b981"
              dot={false}
              strokeWidth={1.5}
              name="SMA 20"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sma_50"
              stroke="#f59e0b"
              dot={false}
              strokeWidth={1.5}
              name="SMA 50"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Sub-Panels: RSI-14 & 20-Day Volatility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartFrame
          title="Relative Strength Index (RSI-14)"
          badge="Oscillator"
          subtitle="70 Overbought / 30 Oversold Thresholds"
          heightClass="h-[240px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                domain={[0, 100]}
                ticks={[0, 30, 50, 70, 100]}
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="rsi_14"
                stroke="#a855f7"
                dot={false}
                strokeWidth={1.5}
                name="RSI 14"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame
          title="Annualized 20-Day Volatility"
          badge="&sigma; 252D"
          subtitle="Daily Returns Rolling Standard Deviation"
          heightClass="h-[240px]"
          loading={loading}
          error={error}
          onRetry={onRefresh}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    unit="%"
                    formatValue={(v) => fmtPct(v * 100)}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="volatility_20d"
                stroke="#f59e0b"
                dot={false}
                strokeWidth={1.5}
                name="20D Volatility"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </div>
  );
};
