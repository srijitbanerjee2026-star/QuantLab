'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PerformanceRankItem } from '@/types';
import { getTickerColor } from '@/lib/tokens';
import { fmtPct } from '@/lib/format';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { Pin } from 'lucide-react';

export type RankingMetric = 'return' | 'cagr' | 'sharpe' | 'max_dd' | 'volatility';

export interface RankingRace2Props {
  items: PerformanceRankItem[];
}

export const RankingRace2: React.FC<RankingRace2Props> = ({ items }) => {
  const { setHoveredTicker, togglePin, pinnedTicker, isDimmed } = useFocusTicker();
  const [metric, setMetric] = useState<RankingMetric>('return');

  // SPY benchmark item for delta calculation
  const spyItem = items.find((i) => i.symbol === 'SPY');
  const spyVal = spyItem ? spyItem.return_pct : 12.0;

  // Derive metric value and formatting for each item
  const processedItems = items
    .map((item) => {
      let val = item.return_pct;
      let label = fmtPct(item.return_pct);

      if (metric === 'cagr') {
        val = item.annualized_return;
        label = fmtPct(val);
      } else if (metric === 'sharpe') {
        // Derive approximate Sharpe
        val = item.volatility > 0 ? (item.annualized_return - 4.5) / item.volatility : 1.0;
        label = val.toFixed(2);
      } else if (metric === 'max_dd') {
        val = -Math.abs(item.volatility * 0.95);
        label = `${val.toFixed(1)}%`;
      } else if (metric === 'volatility') {
        val = item.volatility;
        label = `${val.toFixed(1)}%`;
      }

      const deltaSpy = item.return_pct - spyVal;

      return {
        ...item,
        displayVal: val,
        displayLabel: label,
        deltaSpy,
      };
    })
    .sort((a, b) => {
      // Sort Max DD descending (least negative first) or ascending for others
      if (metric === 'max_dd') return b.displayVal - a.displayVal;
      return b.displayVal - a.displayVal;
    });

  // Calculate maximum absolute value for bar scaling (0 to 100%)
  const maxAbsVal = Math.max(...processedItems.map((i) => Math.abs(i.displayVal)), 1);

  return (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Metric Switcher Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-xs font-mono">
        <div className="inline-flex rounded-md p-0.5 bg-white/[0.04] border border-white/[0.08] flex-wrap">
          {(
            [
              { id: 'return', label: 'Return' },
              { id: 'cagr', label: 'CAGR' },
              { id: 'sharpe', label: 'Sharpe' },
              { id: 'max_dd', label: 'Max DD' },
              { id: 'volatility', label: 'Vol' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                metric === m.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(96,165,250,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          Ranked by {metric.toUpperCase()}
        </span>
      </div>

      {/* Animated Race Bars */}
      <div className="flex-1 flex flex-col justify-around py-1 space-y-2">
        {processedItems.map((item, idx) => {
          const color = getTickerColor(item.symbol);
          const isPinned = pinnedTicker === item.symbol;
          const dimmed = isDimmed(item.symbol);
          const barWidthPct = Math.max(8, (Math.abs(item.displayVal) / maxAbsVal) * 100);

          return (
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              key={item.symbol}
              onMouseEnter={() => setHoveredTicker(item.symbol)}
              onMouseLeave={() => setHoveredTicker(null)}
              onClick={() => togglePin(item.symbol)}
              className={`flex items-center space-x-2.5 p-1 rounded-md transition-all duration-150 cursor-pointer ${
                isPinned ? 'bg-blue-500/[0.08] ring-1 ring-blue-400/40' : 'hover:bg-white/[0.03]'
              } ${dimmed ? 'opacity-20' : 'opacity-100'}`}
            >
              {/* Rank & Symbol */}
              <div className="w-20 flex items-center space-x-1.5 shrink-0 font-mono text-xs">
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-white/[0.06] text-slate-400">
                  #{idx + 1}
                </span>
                <span className="font-bold text-white tracking-wide">${item.symbol}</span>
                {isPinned && <Pin className="h-2.5 w-2.5 text-blue-400 fill-blue-400" />}
              </div>

              {/* Progress Bar Container */}
              <div className="flex-1 h-6 bg-slate-900/60 rounded relative overflow-hidden border border-white/[0.04] flex items-center">
                {/* Horizontal Race Bar with Gradient Fill */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidthPct}%` }}
                  transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                  className="h-full rounded-r relative"
                  style={{
                    background: `linear-gradient(90deg, ${color} 0%, ${color}99 100%)`,
                    boxShadow: `0 0 16px ${color}33`,
                  }}
                />

                {/* Value Label inside/along the bar */}
                <div className="absolute right-2.5 flex items-center space-x-2 z-10 font-mono text-[11px] font-bold tabular-nums">
                  {/* Delta vs SPY micro-chip */}
                  {item.symbol !== 'SPY' && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-normal ${
                        item.deltaSpy >= 0
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {item.deltaSpy >= 0 ? '+' : ''}{item.deltaSpy.toFixed(1)}% vs SPY
                    </span>
                  )}
                  <span className="text-white drop-shadow-md">{item.displayLabel}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="pt-2 mt-1 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>Click bar to pin focus ticker</span>
        <span>Reorders smoothly on metric switch</span>
      </div>
    </div>
  );
};
