'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { RollingSharpePoint } from '@/types';
import { getTickerColor } from '@/lib/tokens';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { useChartRange } from '@/stores/useChartRange';
import { LayoutGrid, Layers, EyeOff } from 'lucide-react';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

export interface RollingSharpe2Props {
  symbols: string[];
  data: RollingSharpePoint[];
}

export const RollingSharpe2: React.FC<RollingSharpe2Props> = ({ symbols, data }) => {
  const { setHoveredTicker, getActiveTicker, isDimmed } = useFocusTicker();
  const { zoomDomain } = useChartRange();

  const [windowDays, setWindowDays] = useState<30 | 60 | 90 | 180>(90);
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [hiddenSymbols, setHiddenSymbols] = useState<Record<string, boolean>>({});

  const activeFocus = getActiveTicker();

  // Sliced data based on brush zoom domain from ReturnsChart
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!zoomDomain) return data;
    const start = Math.max(0, zoomDomain.startIndex);
    const end = Math.min(data.length, zoomDomain.endIndex + 1);
    return data.slice(start, end);
  }, [data, zoomDomain]);

  // Find min/max values to ensure auto-fit y-axis ALWAYS includes 1.0 and 0.0
  const yDomain = useMemo(() => {
    if (!displayData || displayData.length === 0) return [-0.5, 2.5];
    let min = 0;
    let max = 1.0;

    displayData.forEach((pt) => {
      symbols.forEach((s) => {
        const val = typeof pt[s] === 'number' ? (pt[s] as number) : null;
        if (val !== null) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      });
    });

    return [
      Math.min(-0.2, Math.floor(min * 10) / 10),
      Math.max(1.5, Math.ceil(max * 10) / 10),
    ];
  }, [displayData, symbols]);

  return (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-xs font-mono">
        {/* Rolling Window Switcher */}
        <div className="inline-flex rounded-md p-0.5 bg-white/[0.04] border border-white/[0.08]">
          {([30, 60, 90, 180] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                windowDays === w
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(96,165,250,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>

        {/* Small Multiples (Split Mode) Toggle */}
        <button
          type="button"
          onClick={() => setIsSplit(!isSplit)}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 border transition ${
            isSplit
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(192,132,252,0.25)]'
              : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200'
          }`}
          title="Toggle Small Multiples (Split View)"
        >
          {isSplit ? <Layers className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
          <span>{isSplit ? 'Unified View' : 'Split View'}</span>
        </button>
      </div>

      {/* Main Chart Body: Unified OR Split Mode */}
      {!isSplit ? (
        /* Unified Spaghetti Chart with Shaded Quality Zones */
        <div className="flex-1 w-full min-h-[260px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayData}
              margin={{ top: 12, right: 35, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" opacity={0.4} />

              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                fontFamily="monospace"
                tickLine={false}
                minTickGap={45}
                tickFormatter={(val: string) => {
                  try {
                    const d = new Date(val);
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  } catch {
                    return val;
                  }
                }}
              />

              <YAxis
                domain={yDomain}
                stroke="#64748b"
                fontSize={10}
                fontFamily="monospace"
                tickLine={false}
                tickFormatter={(val: number) => val.toFixed(1)}
              />

              {/* Green Tinted Zone above 1.0 (Quality Zone) */}
              <ReferenceArea
                y1={1.0}
                y2={yDomain[1]}
                fill="rgba(52, 211, 153, 0.04)"
                strokeOpacity={0}
              />

              {/* Red Tinted Zone below 0 (Sub-Zero Return Decay) */}
              <ReferenceArea
                y1={yDomain[0]}
                y2={0}
                fill="rgba(251, 113, 133, 0.04)"
                strokeOpacity={0}
              />

              {/* 1.0 Benchmark "QUALITY LINE" */}
              <ReferenceLine
                y={1.0}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'QUALITY LINE (1.0)',
                  fill: '#fbbf24',
                  fontSize: 9,
                  position: 'right',
                  fontFamily: 'monospace',
                }}
              />

              {/* Zero Line */}
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />

              <Tooltip
                content={
                  <ChartTooltip
                    formatValue={(val, name) => `${val.toFixed(2)} Sharpe`}
                  />
                }
              />

              {/* Render Lines */}
              {symbols.map((sym) => {
                if (hiddenSymbols[sym]) return null;

                const color = getTickerColor(sym);
                const isFocused = activeFocus === sym;
                const dimmed = isDimmed(sym);

                return (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    name={sym}
                    stroke={color}
                    strokeWidth={isFocused ? 2.5 : 1.5}
                    strokeOpacity={dimmed ? 0.15 : 1.0}
                    dot={false}
                    activeDot={{
                      r: 4.5,
                      fill: color,
                      stroke: '#0b101f',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={displayData.length < 500}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Small Multiples Mode: Stack of Mini Charts */
        <div className="flex-1 w-full min-h-[260px] overflow-y-auto pr-1 space-y-2">
          {symbols.map((sym) => {
            const color = getTickerColor(sym);
            const isFocused = activeFocus === sym;
            const dimmed = isDimmed(sym);

            return (
              <div
                key={sym}
                onMouseEnter={() => setHoveredTicker(sym)}
                onMouseLeave={() => setHoveredTicker(null)}
                className={`p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] transition ${
                  isFocused ? 'ring-1 ring-white/40 bg-white/[0.05]' : ''
                } ${dimmed ? 'opacity-25' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-bold text-white">${sym}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Latest:{' '}
                    <strong className="text-emerald-400">
                      {Number(displayData[displayData.length - 1]?.[sym] || 1.2).toFixed(2)}
                    </strong>
                  </span>
                </div>

                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayData} margin={{ top: 2, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" opacity={0.3} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={yDomain} hide />
                      <ReferenceLine y={1.0} stroke="#fbbf24" strokeDasharray="3 3" opacity={0.7} />
                      <Line
                        type="monotone"
                        dataKey={sym}
                        stroke={color}
                        strokeWidth={1.75}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend Footer */}
      <div className="pt-2 mt-1 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          {symbols.map((sym) => {
            const color = getTickerColor(sym);
            const isHidden = hiddenSymbols[sym];
            const isFocused = activeFocus === sym;
            const dimmed = isDimmed(sym);

            return (
              <button
                key={sym}
                type="button"
                onMouseEnter={() => setHoveredTicker(sym)}
                onMouseLeave={() => setHoveredTicker(null)}
                onClick={() =>
                  setHiddenSymbols((prev) => ({ ...prev, [sym]: !prev[sym] }))
                }
                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border transition select-none ${
                  isHidden
                    ? 'opacity-35 bg-white/[0.02] border-white/[0.04] text-slate-500'
                    : dimmed
                    ? 'opacity-25 bg-white/[0.02] border-white/[0.04]'
                    : isFocused
                    ? 'bg-white/[0.12] border-white/30 text-white'
                    : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-bold">${sym}</span>
                {isHidden && <EyeOff className="h-2.5 w-2.5 text-slate-500" />}
              </button>
            );
          })}
        </div>

        <span className="text-[9px] text-slate-500 hidden sm:inline">
          1.0 Quality line dashed in amber
        </span>
      </div>
    </div>
  );
};
