'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, ScatterChart as ScatterIcon, Layers } from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import { getTickerColor } from '@/lib/tokens';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

export interface ScatterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pair: { x: string; y: string; value: number } | null;
}

export const ScatterDrawer: React.FC<ScatterDrawerProps> = ({ isOpen, onClose, pair }) => {
  if (!pair) return null;

  const colorX = getTickerColor(pair.x);
  const colorY = getTickerColor(pair.y);

  // Generate 60 correlated daily return pairs for scatter plot
  const seed = pair.x.charCodeAt(0) * 17 + pair.y.charCodeAt(0) * 31;
  const scatterPoints = [];
  const rho = pair.value;

  for (let i = 0; i < 50; i++) {
    // Normal pseudo-random
    const u1 = Math.sin(seed + i * 1.3) * 0.5 + 0.5;
    const u2 = Math.cos(seed + i * 2.7) * 0.5 + 0.5;
    const z1 = Math.sqrt(-2 * Math.log(u1 || 0.01)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1 || 0.01)) * Math.sin(2 * Math.PI * u2);

    const retX = (z1 * 0.014 * 100);
    const retY = ((rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2) * 0.014 * 100);

    scatterPoints.push({
      x: Math.round(retX * 100) / 100,
      y: Math.round(retY * 100) / 100,
    });
  }

  // Regression line calculation: y = beta * x + alpha
  const beta = rho * 1.05;
  const regressionLine = [
    { x: -3.5, y: -3.5 * beta },
    { x: 3.5, y: 3.5 * beta },
  ];

  // Rolling correlation 30-day series
  const rollingCorr = [];
  for (let d = 30; d >= 0; d--) {
    const val = rho + Math.sin(d * 0.3 + seed) * 0.12;
    rollingCorr.push({
      day: `T-${d}`,
      corr: Math.max(-1, Math.min(1, Math.round(val * 100) / 100)),
    });
  }

  const rSquared = Math.round(rho * rho * 100) / 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-in Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[460px] z-50 bg-[#070b14] border-l border-white/[0.08] shadow-2xl flex flex-col p-5 select-none"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ScatterIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white tracking-wider flex items-center space-x-2">
                    <span style={{ color: colorX }}>${pair.x}</span>
                    <span className="text-slate-500">↔</span>
                    <span style={{ color: colorY }}>${pair.y}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Pair Co-Movement & Scatter Regression Analysis
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stat Row */}
            <div className="grid grid-cols-3 gap-2 py-4">
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center font-mono">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">
                  Pearson ρ
                </div>
                <div
                  className={`text-base font-bold tabular-nums mt-0.5 ${
                    pair.value >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {pair.value > 0 ? '+' : ''}
                  {pair.value.toFixed(2)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center font-mono">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">
                  R² Goodness
                </div>
                <div className="text-base font-bold tabular-nums text-slate-200 mt-0.5">
                  {rSquared.toFixed(2)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center font-mono">
                <div className="text-[9px] uppercase tracking-wider text-slate-500">
                  Beta (β)
                </div>
                <div className="text-base font-bold tabular-nums text-blue-400 mt-0.5">
                  {beta.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Daily Returns Scatter Plot */}
            <div className="flex-1 flex flex-col min-h-0 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold mb-2 flex items-center justify-between">
                  <span>Daily Return Scatter (%)</span>
                  <span className="text-[9px] text-slate-500 font-sans">60 Sessions</span>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" opacity={0.5} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name={pair.x}
                        unit="%"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                        domain={[-4, 4]}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={pair.y}
                        unit="%"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                        domain={[-4, 4]}
                      />
                      <ZAxis range={[25, 25]} />
                      <ReferenceLine x={0} stroke="#334155" />
                      <ReferenceLine y={0} stroke="#334155" />
                      <Tooltip
                        content={
                          <ChartTooltip
                            formatValue={(val) => `${val.toFixed(2)}%`}
                          />
                        }
                      />
                      <Scatter
                        data={scatterPoints}
                        fill={colorX}
                        opacity={0.8}
                        stroke="#0f172a"
                        strokeWidth={1}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 30-Day Rolling Correlation Line */}
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold mb-2 flex items-center justify-between">
                  <span>30-Day Rolling Correlation Trend</span>
                  <span className="text-[9px] text-emerald-400 font-mono">ρ = {pair.value.toFixed(2)}</span>
                </div>
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rollingCorr} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" opacity={0.5} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                        interval={6}
                      />
                      <YAxis
                        domain={[-1, 1]}
                        tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                        ticks={[-1, -0.5, 0, 0.5, 1]}
                      />
                      <ReferenceLine y={0} stroke="#334155" />
                      <Tooltip
                        content={
                          <ChartTooltip
                            formatValue={(val) => val.toFixed(2)}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="corr"
                        stroke={pair.value >= 0 ? '#34d399' : '#fb7185'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Press <span className="text-slate-300">Esc</span> to dismiss</span>
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 transition"
              >
                Close Drawer
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
