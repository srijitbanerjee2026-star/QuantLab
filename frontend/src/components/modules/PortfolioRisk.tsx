import React, { useState } from 'react';
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
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  BacktestData,
  RiskAnalysisData,
  PortfolioOptimizerData,
} from '@/types';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { Stat } from '@/components/ui/Stat';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { fmtPct, fmtPrice, fmtRatio } from '@/lib/format';
import { Play } from 'lucide-react';

export interface PortfolioRiskProps {
  symbol: string;
  subView: 'backtest' | 'risk_var' | 'optimizer';
  backtestData: BacktestData | null;
  backtestLoading: boolean;
  onRunBacktest: (params: { shortWindow: number; longWindow: number; capital: number }) => void;
  riskData: RiskAnalysisData | null;
  riskLoading: boolean;
  onRunRisk: () => void;
  optimizerData: PortfolioOptimizerData | null;
  optimizerLoading: boolean;
  onRunOptimizer: (symbols: string[]) => void;
}

export const PortfolioRisk: React.FC<PortfolioRiskProps> = ({
  symbol,
  subView,
  backtestData,
  backtestLoading,
  onRunBacktest,
  riskData,
  riskLoading,
  onRunRisk,
  optimizerData,
  optimizerLoading,
  onRunOptimizer,
}) => {
  // Backtest controls
  const [shortWindow, setShortWindow] = useState<number>(20);
  const [longWindow, setLongWindow] = useState<number>(50);
  const [initialCapital, setInitialCapital] = useState<number>(10000);

  // Risk confidence selector
  const [confidence, setConfidence] = useState<'90' | '95' | '99'>('95');

  // Optimizer inputs
  const [optSymbols, setOptSymbols] = useState<string>('AAPL, MSFT, NVDA, SPY, GLD');

  // ---------------- Sub-View 1: Strategy Backtesting ----------------
  if (subView === 'backtest') {
    const metrics = backtestData?.metrics;

    return (
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="bg-[#0c111d] border border-slate-800/80 p-3 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto flex-1">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Fast Window</span>
              <input
                type="number"
                value={shortWindow}
                onChange={(e) => setShortWindow(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 w-full focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Slow Window</span>
              <input
                type="number"
                value={longWindow}
                onChange={(e) => setLongWindow(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 w-full focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block mb-1">Initial Capital</span>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 w-full focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRunBacktest({ shortWindow, longWindow, capital: initialCapital })}
            disabled={backtestLoading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded transition w-full md:w-auto justify-center shrink-0"
          >
            <Play className={`h-3.5 w-3.5 fill-white ${backtestLoading ? 'animate-spin' : ''}`} />
            <span>{backtestLoading ? 'SIMULATING TRADES...' : 'EXECUTE BACKTEST'}</span>
          </button>
        </div>

        {/* Institutional Metrics Grid (CAGR, Vol, Sharpe, Sortino, Max DD, Calmar, Win Rate) */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <Stat label="Total Return" value={fmtPct(metrics.totalReturnPct)} valueColor={metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <Stat label="CAGR" value={fmtPct(metrics.cagr)} valueColor="text-blue-400" />
            <Stat label="Annual Vol" value={fmtPct(metrics.annualizedVol)} valueColor="text-amber-400" />
            <Stat label="Sharpe" value={fmtRatio(metrics.sharpeRatio, 2)} valueColor="text-purple-400" />
            <Stat label="Sortino" value={fmtRatio(metrics.sortinoRatio, 2)} valueColor="text-cyan-400" />
            <Stat label="Max Drawdown" value={fmtPct(metrics.maxDrawdown)} valueColor="text-rose-400" />
            <Stat label="Win Rate" value={fmtPct(metrics.winRate)} valueColor="text-emerald-400" />
          </div>
        )}

        {/* Equity Curve vs SPY Benchmark */}
        <ChartFrame
          title={`${symbol} Strategy Equity Curve vs Benchmark`}
          badge="Capital Growth ($)"
          subtitle="Portfolio Value vs Buy & Hold Benchmark"
          heightClass="h-[340px]"
          loading={backtestLoading}
          exportData={backtestData?.equityCurve}
          exportFilename={`${symbol}_equity_curve.csv`}
        >
          {backtestData && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={backtestData.equityCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                  dataKey="portfolio"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Strategy Equity ($)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Benchmark Buy & Hold ($)"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Underwater Drawdown Chart (Crimson Area) */}
        <ChartFrame
          title="Underwater Drawdown Profile"
          badge="Drawdown %"
          subtitle="Peak-to-Trough Portfolio Retracement"
          heightClass="h-[220px]"
          loading={backtestLoading}
          exportData={backtestData?.drawdownCurve}
          exportFilename={`${symbol}_drawdown.csv`}
        >
          {backtestData && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={backtestData.drawdownCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                <ReferenceLine y={0} stroke="#475569" />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.25}
                  name="Drawdown %"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    );
  }

  // ---------------- Sub-View 2: Risk & VaR Analysis ----------------
  if (subView === 'risk_var') {
    return (
      <div className="space-y-4">
        {/* Risk KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat
            label="Annual Volatility"
            value={riskData ? fmtPct(riskData.annualizedVolatility) : '—'}
            subtext="Realized 252D &sigma;"
            valueColor="text-amber-400"
          />
          <Stat
            label="Parametric VaR 95%"
            value={riskData ? fmtPct(riskData.var95) : '—'}
            subtext="1-Day Value at Risk"
            valueColor="text-rose-400"
          />
          <Stat
            label="Parametric VaR 99%"
            value={riskData ? fmtPct(riskData.var99) : '—'}
            subtext="Extreme 99% Tail Risk"
            valueColor="text-rose-400"
          />
          <Stat
            label="Conditional VaR (CVaR)"
            value={riskData ? fmtPct(riskData.cvar95) : '—'}
            subtext="Expected Shortfall"
            valueColor="text-rose-500"
          />
          <Stat
            label="Sortino Ratio"
            value={riskData ? fmtRatio(riskData.sortinoRatio, 2) : '—'}
            subtext="Downside Deviation Basis"
            valueColor="text-purple-400"
          />
        </div>

        {/* VaR Return Distribution Histogram */}
        <ChartFrame
          title={`${symbol} Daily Return Distribution & Value at Risk (VaR)`}
          badge={`VaR ${confidence}%`}
          subtitle="Historical Daily Return Frequency with VaR Cutoff Markers"
          heightClass="h-[360px]"
          loading={riskLoading}
          actions={
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">Confidence:</span>
              <SegmentedControl
                options={[
                  { id: '90', label: '90%' },
                  { id: '95', label: '95%' },
                  { id: '99', label: '99%' },
                ]}
                value={confidence}
                onChange={(c) => setConfidence(c as any)}
                size="xs"
              />
            </div>
          }
        >
          {riskData && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData.histogram} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" vertical={false} />
                <XAxis
                  dataKey="bin"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <YAxis
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Frequency Count" radius={[2, 2, 0, 0]}>
                  {riskData.histogram.map((entry, index) => {
                    const isVaR =
                      confidence === '99'
                        ? entry.isVaR99
                        : confidence === '95'
                        ? entry.isVaR95
                        : entry.returnVal < -1.35;
                    const fill = isVaR ? '#ef4444' : '#3b82f6';
                    return <Cell key={`bin-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </div>
    );
  }

  // ---------------- Sub-View 3: Markowitz Optimizer ----------------
  const frontier = optimizerData?.frontier || [];

  return (
    <div className="space-y-4">
      {/* Control Input */}
      <div className="bg-[#0c111d] border border-slate-800/80 p-3 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2 w-full md:w-auto flex-1">
          <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0">Portfolio Assets:</span>
          <input
            type="text"
            value={optSymbols}
            onChange={(e) => setOptSymbols(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white flex-1 uppercase focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const symList = optSymbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
            onRunOptimizer(symList);
          }}
          disabled={optimizerLoading}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded transition shrink-0"
        >
          <Play className={`h-3.5 w-3.5 fill-white ${optimizerLoading ? 'animate-spin' : ''}`} />
          <span>{optimizerLoading ? 'OPTIMIZING SLSQP...' : 'COMPUTE EFFICIENT FRONTIER'}</span>
        </button>
      </div>

      {/* Efficient Frontier Scatter & Allocation Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Efficient Frontier Scatter */}
        <ChartFrame
          title="Markowitz Efficient Frontier"
          badge="Risk vs Return"
          subtitle="Monte Carlo Simulation & SLSQP Tangency Point"
          heightClass="h-[360px]"
          loading={optimizerLoading}
        >
          {optimizerData && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.35)" />
                <XAxis
                  type="number"
                  dataKey="volatility"
                  name="Volatility"
                  unit="%"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <YAxis
                  type="number"
                  dataKey="returnPct"
                  name="Expected Return"
                  unit="%"
                  stroke="#64748b"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                />
                <ZAxis dataKey="sharpe" range={[20, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={
                    <ChartTooltip
                      formatValue={(v, name) => `${v}%`}
                    />
                  }
                />
                <Scatter name="Portfolios" data={frontier} fill="#3b82f6" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>

        {/* Optimal Allocation Cards */}
        {optimizerData && (
          <div className="space-y-4">
            {/* Max Sharpe Tangency Portfolio */}
            <Card noPadding className="border-emerald-600/40">
              <CardHeader
                title="Tangency Portfolio (Max Sharpe)"
                badge={`Sharpe: ${optimizerData.maxSharpe.sharpe.toFixed(2)}`}
                subtitle={`Exp Ret: ${optimizerData.maxSharpe.expectedReturn}% · Vol: ${optimizerData.maxSharpe.volatility}%`}
              />
              <div className="p-3 space-y-2 text-xs font-mono">
                {optimizerData.maxSharpe.weights.map((w) => (
                  <div key={w.symbol} className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">${w.symbol}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-28 bg-slate-800 h-2 rounded overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded"
                          style={{ width: `${w.weight * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-bold text-emerald-400">
                        {(w.weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Min Volatility Portfolio */}
            <Card noPadding className="border-purple-600/40">
              <CardHeader
                title="Minimum Variance Portfolio"
                badge={`Sharpe: ${optimizerData.minVol.sharpe.toFixed(2)}`}
                subtitle={`Exp Ret: ${optimizerData.minVol.expectedReturn}% · Vol: ${optimizerData.minVol.volatility}%`}
              />
              <div className="p-3 space-y-2 text-xs font-mono">
                {optimizerData.minVol.weights.map((w) => (
                  <div key={w.symbol} className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">${w.symbol}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-28 bg-slate-800 h-2 rounded overflow-hidden">
                        <div
                          className="bg-purple-400 h-full rounded"
                          style={{ width: `${w.weight * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-bold text-purple-400">
                        {(w.weight * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
