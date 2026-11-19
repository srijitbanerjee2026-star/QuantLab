'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { getTickerColor } from '@/lib/tokens';
import { fmtPct, fmtPrice } from '@/lib/format';
import { Pin } from 'lucide-react';

export interface FloatingTickerCardProps {
  statsMap?: Record<
    string,
    {
      price: number;
      returnPct: number;
      sharpe: number;
      volatility: number;
    }
  >;
}

export const FloatingTickerCard: React.FC<FloatingTickerCardProps> = ({ statsMap = {} }) => {
  const { hoveredTicker, pinnedTicker, cursorPos } = useFocusTicker();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Smooth mouse position tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const active = hoveredTicker;
  if (!active || !pos) return null;

  const color = getTickerColor(active);
  const stats = statsMap[active] || {
    price: 185.4,
    returnPct: 14.8,
    sharpe: 1.42,
    volatility: 18.5,
  };
  const isPos = stats.returnPct >= 0;
  const isPinned = pinnedTicker === active;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          left: `${pos.x + 14}px`,
          top: `${pos.y + 14}px`,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
        className="rounded-lg p-2.5 bg-[#0b101e]/95 border border-slate-700/80 shadow-[0_12px_32px_rgba(0,0,0,0.7)] backdrop-blur-md min-w-[170px]"
      >
        {/* Header: Dot + Ticker + Pin */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.08]">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              ${active}
            </span>
          </div>
          {isPinned && (
            <span className="flex items-center space-x-1 text-[9px] font-mono text-blue-400">
              <Pin className="h-2.5 w-2.5 fill-blue-400" />
              <span>PINNED</span>
            </span>
          )}
        </div>

        {/* Price & Period Return */}
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-mono text-xs font-bold text-slate-100 tabular-nums">
            {fmtPrice(stats.price)}
          </span>
          <span
            className={`font-mono text-[10px] font-bold tabular-nums ${
              isPos ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {fmtPct(stats.returnPct)}
          </span>
        </div>

        {/* Sharpe & Volatility */}
        <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[9px] font-mono">
          <div>
            <span className="text-slate-500 uppercase tracking-wider block">Sharpe</span>
            <span className="text-slate-300 font-semibold">{stats.sharpe.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 uppercase tracking-wider block">Vol (ann.)</span>
            <span className="text-slate-300 font-semibold">{stats.volatility.toFixed(1)}%</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
