'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { getTickerColor } from '@/lib/tokens';
import { fmtPct, fmtPrice } from '@/lib/format';
import { Pin } from 'lucide-react';

export interface KpiCardProps {
  symbol: string;
  rank: number;
  price: number;
  returnPct: number;
  sharpe: number;
  volatility: number;
  sparkline: number[];
  isPinned: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onHoverStart: (e: React.MouseEvent) => void;
  onHoverEnd: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  symbol,
  rank,
  price,
  returnPct,
  sharpe,
  volatility,
  sparkline,
  isPinned,
  isDimmed,
  onClick,
  onHoverStart,
  onHoverEnd,
}) => {
  const color = getTickerColor(symbol);
  const isPos = returnPct >= 0;

  // Generate SVG Sparkline Path
  const minVal = Math.min(...sparkline, 0);
  const maxVal = Math.max(...sparkline, 1);
  const range = maxVal - minVal || 1;
  const width = 84;
  const height = 24;

  const points = sparkline.map((val, idx) => {
    const x = (idx / (sparkline.length - 1 || 1)) * width;
    const y = height - ((val - minVal) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const sparklinePath = points.length > 0 ? `M ${points.join(' L ')}` : '';

  return (
    <motion.div
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={onClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={`relative min-w-[200px] h-[72px] px-3 py-2 rounded-lg obsidian-panel cursor-pointer flex flex-col justify-between transition-all duration-200 select-none ${
        isPinned
          ? 'ring-1 ring-blue-400 bg-blue-500/[0.08] border-blue-400/40 shadow-[0_0_20px_rgba(96,165,250,0.2)]'
          : ''
      } ${isDimmed ? 'opacity-20 grayscale-[40%]' : 'opacity-100'}`}
      style={{
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Top Row: Symbol, Rank, Price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08]">
            #{rank}
          </span>
          <span className="font-mono text-xs font-bold tracking-wider text-white">
            ${symbol}
          </span>
          {isPinned && <Pin className="h-3 w-3 text-blue-400 fill-blue-400" />}
        </div>

        <span className="font-mono text-xs text-slate-200 font-semibold tabular-nums">
          {fmtPrice(price)}
        </span>
      </div>

      {/* Bottom Row: Return Chip, Sparkline, Metrics */}
      <div className="flex items-center justify-between mt-1">
        {/* Return Chip */}
        <span
          className={`inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border tabular-nums ${
            isPos
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          {fmtPct(returnPct)}
        </span>

        {/* 30d Mini Sparkline */}
        <div className="w-[84px] h-[24px] overflow-hidden flex items-center justify-center">
          <svg width={width} height={height} className="overflow-visible">
            <path
              d={sparklinePath}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Sharpe Badge */}
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-wider text-slate-500 font-mono">
            SHARPE
          </div>
          <div className="text-[10px] font-mono font-bold tabular-nums text-slate-300">
            {sharpe.toFixed(2)}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
