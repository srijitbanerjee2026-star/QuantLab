'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
  Brush,
} from 'recharts';
import { CumulativeReturnPoint } from '@/types';
import { getTickerColor } from '@/lib/tokens';
import { fmtPct, fmtPrice } from '@/lib/format';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { useChartRange } from '@/stores/useChartRange';
import { Flag, Eye, EyeOff, ZoomIn, RotateCcw } from 'lucide-react';

export type ReturnsDisplayMode = 'linear' | 'log' | 'alpha' | 'indexed';

export interface ReturnsChart2Props {
  symbols: string[];
  data: CumulativeReturnPoint[];
}

interface EventMarker {
  date: string;
  label: string;
  detail: string;
}

const HISTORICAL_EVENTS: EventMarker[] = [
  { date: '2024-03-20', label: 'FOMC', detail: 'Fed pauses rates at 5.25-5.50%' },
  { date: '2024-06-12', label: 'CPI', detail: 'Core CPI cools to 3.4% YoY' },
  { date: '2024-09-18', label: 'RATE CUT', detail: 'Fed cuts 50bps to 4.75-5.00%' },
  { date: '2024-11-05', label: 'ELECTION', detail: 'US Presidential Election' },
];

export const ReturnsChart2: React.FC<ReturnsChart2Props> = ({ symbols, data }) => {
  const { setHoveredTicker, togglePin, getActiveTicker, isDimmed } = useFocusTicker();
  const { zoomDomain, setZoomDomain, resetZoom } = useChartRange();

  // Mode: Indexed 100 default as specified in prompt
  const [mode, setMode] = useState<ReturnsDisplayMode>('indexed');
  const [showEvents, setShowEvents] = useState<boolean>(true);
  const [showDrawdown, setShowDrawdown] = useState<boolean>(false);
  const [hiddenSymbols, setHiddenSymbols] = useState<Record<string, boolean>>({});

  const activeFocus = getActiveTicker();

  // Transform Data based on Mode:
  // - 'linear': raw cumulative return % (starting 0%)
  // - 'log': log scale ln(1 + r/100) * 100
  // - 'alpha': excess return vs SPY (r_asset - r_spy)
  // - 'indexed': base 100 index (100 * (1 + r/100))
  const transformedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((pt) => {
      const newPt: Record<string, any> = { date: pt.date };
      const spyVal = typeof pt['SPY'] === 'number' ? (pt['SPY'] as number) : 0;

      symbols.forEach((s) => {
        const raw = typeof pt[s] === 'number' ? (pt[s] as number) : 0;
        if (mode === 'indexed') {
          newPt[s] = Math.round((100 + raw) * 100) / 100;
        } else if (mode === 'log') {
          const val = raw >= -99 ? Math.log(1 + raw / 100) * 100 : -100;
          newPt[s] = Math.round(val * 100) / 100;
        } else if (mode === 'alpha') {
          newPt[s] = Math.round((raw - spyVal) * 100) / 100;
        } else {
          newPt[s] = Math.round(raw * 100) / 100;
        }
      });
      return newPt;
    });
  }, [data, symbols, mode]);

  // Sliced Data if zoom is active
  const displayData = useMemo(() => {
    if (!zoomDomain || !transformedData.length) return transformedData;
    const start = Math.max(0, zoomDomain.startIndex);
    const end = Math.min(transformedData.length, zoomDomain.endIndex + 1);
    return transformedData.slice(start, end);
  }, [transformedData, zoomDomain]);

  // Latest point values for end-of-line collision avoidance & glow pulse
  const latestPoint = displayData.length > 0 ? displayData[displayData.length - 1] : null;

  // Toggle legend series visibility
  const toggleSymbolVisibility = (sym: string) => {
    setHiddenSymbols((prev) => ({ ...prev, [sym]: !prev[sym] }));
  };

  // Custom Leaderboard Crosshair Tooltip
  const renderLeaderboardTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    // Sort items by descending value at this point
    const sorted = [...payload]
      .filter((item: any) => !hiddenSymbols[item.dataKey])
      .sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));

    const spyItem = payload.find((p: any) => p.dataKey === 'SPY');
    const spyVal = spyItem ? Number(spyItem.value) : 0;

    return (
      <div className="rounded-lg p-2.5 bg-[#0b101f]/95 border border-slate-700/80 shadow-[0_12px_32px_rgba(0,0,0,0.8)] backdrop-blur-md min-w-[210px] select-none font-mono">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08] text-[10px] text-slate-400">
          <span className="font-bold text-slate-200">{label}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Leaderboard</span>
        </div>

        <div className="mt-1.5 space-y-1">
          {sorted.map((item: any, idx: number) => {
            const sym = item.dataKey;
            const val = Number(item.value);
            const deltaSpy = val - spyVal;
            const isPos = val >= (mode === 'indexed' ? 100 : 0);
            const isItemDimmed = isDimmed(sym);

            return (
              <div
                key={sym}
                className={`flex items-center justify-between text-xs py-0.5 px-1 rounded transition ${
                  isItemDimmed ? 'opacity-30' : 'opacity-100'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-[9px] text-slate-500 font-bold w-3">#{idx + 1}</span>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-bold text-slate-200">${sym}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`font-bold tabular-nums ${
                      isPos ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {mode === 'indexed' ? val.toFixed(1) : fmtPct(val)}
                  </span>
                  {mode !== 'alpha' && sym !== 'SPY' && (
                    <span
                      className={`text-[9px] tabular-nums ${
                        deltaSpy >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                      title="Alpha vs SPY"
                    >
                      {deltaSpy >= 0 ? '▲' : '▼'}{Math.abs(deltaSpy).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-xs font-mono">
        {/* Mode Selector */}
        <div className="inline-flex rounded-md p-0.5 bg-white/[0.04] border border-white/[0.08]">
          {(['indexed', 'linear', 'log', 'alpha'] as ReturnsDisplayMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                mode === m
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(96,165,250,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'indexed'
                ? 'Indexed 100'
                : m === 'alpha'
                ? 'vs SPY (Alpha)'
                : m}
            </button>
          ))}
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center space-x-2">
          {/* Events Flag Toggle */}
          <button
            type="button"
            onClick={() => setShowEvents(!showEvents)}
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center space-x-1 border transition ${
              showEvents
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-white/[0.02] text-slate-500 border-white/[0.06]'
            }`}
            title="Toggle Key Macro & Earnings Events"
          >
            <Flag className="h-3 w-3" />
            <span className="hidden sm:inline">Events</span>
          </button>

          {/* Reset Zoom Button */}
          {zoomDomain && (
            <button
              type="button"
              onClick={resetZoom}
              className="px-2 py-0.5 rounded text-[10px] flex items-center space-x-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 transition"
              title="Reset Zoom Domain"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Zoom</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chart Area with Recharts */}
      <div
        className="flex-1 w-full min-h-[260px] relative"
        onDoubleClick={resetZoom}
        title="Double-click to reset zoom"
      >
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
                // Smart date formatting: 'Jan 25'
                try {
                  const d = new Date(val);
                  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                } catch {
                  return val;
                }
              }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={10}
              fontFamily="monospace"
              tickLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(val: number) => {
                if (mode === 'indexed') return `${val.toFixed(0)}`;
                return `${val > 0 ? '+' : ''}${val.toFixed(0)}%`;
              }}
            />

            {/* Zero Baseline / 100 Index Baseline */}
            <ReferenceLine
              y={mode === 'indexed' ? 100 : 0}
              stroke="#475569"
              strokeDasharray="3 3"
            />

            {/* Event Markers Flags */}
            {showEvents &&
              HISTORICAL_EVENTS.map((ev, i) => (
                <ReferenceLine
                  key={i}
                  x={ev.date}
                  stroke="#fbbf24"
                  strokeDasharray="2 2"
                  opacity={0.6}
                  label={{
                    value: `⚑ ${ev.label}`,
                    fill: '#fbbf24',
                    fontSize: 9,
                    position: 'top',
                    fontFamily: 'monospace',
                  }}
                />
              ))}

            <Tooltip content={renderLeaderboardTooltip} />

            {/* Render lines for each symbol */}
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
                    className: 'shadow-[0_0_12px_currentColor]',
                  }}
                  isAnimationActive={displayData.length < 500}
                />
              );
            })}

            {/* Minimap Brush Navigator beneath */}
            <Brush
              dataKey="date"
              height={22}
              stroke="#334155"
              fill="#0b1020"
              startIndex={zoomDomain ? zoomDomain.startIndex : 0}
              endIndex={zoomDomain ? zoomDomain.endIndex : displayData.length - 1}
              onChange={(range: any) => {
                if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
                  setZoomDomain({ startIndex: range.startIndex, endIndex: range.endIndex });
                }
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend Pills with live endpoint values */}
      <div className="pt-2 mt-1 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          {symbols.map((sym) => {
            const color = getTickerColor(sym);
            const isHidden = hiddenSymbols[sym];
            const isFocused = activeFocus === sym;
            const dimmed = isDimmed(sym);
            const latestVal = latestPoint ? Number(latestPoint[sym]) : 0;

            return (
              <button
                key={sym}
                type="button"
                onMouseEnter={() => setHoveredTicker(sym)}
                onMouseLeave={() => setHoveredTicker(null)}
                onClick={() => toggleSymbolVisibility(sym)}
                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full border transition-all duration-150 select-none ${
                  isHidden
                    ? 'opacity-35 bg-white/[0.02] border-white/[0.04] text-slate-500'
                    : dimmed
                    ? 'opacity-25 bg-white/[0.02] border-white/[0.04]'
                    : isFocused
                    ? 'bg-white/[0.12] border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.15)] text-white'
                    : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-bold">${sym}</span>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {mode === 'indexed' ? latestVal.toFixed(1) : fmtPct(latestVal)}
                </span>
                {isHidden && <EyeOff className="h-2.5 w-2.5 text-slate-500" />}
              </button>
            );
          })}
        </div>

        <div className="text-[9px] text-slate-500 hidden xl:flex items-center space-x-2">
          <span>Click pill to toggle line</span>
          <span>·</span>
          <span>Brush / Drag to Zoom</span>
        </div>
      </div>
    </div>
  );
};
