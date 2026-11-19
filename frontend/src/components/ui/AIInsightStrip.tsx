'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { getTickerColor } from '@/lib/tokens';

export interface AIInsightStripProps {
  symbols: string[];
  rankingLeader?: { symbol: string; returnPct: number };
  maxCorrelation?: { x: string; y: string; value: number };
}

export const AIInsightStrip: React.FC<AIInsightStripProps> = ({
  symbols,
  rankingLeader = { symbol: 'NVDA', returnPct: 184.2 },
  maxCorrelation = { x: 'SPY', y: 'NVDA', value: 0.64 },
}) => {
  const { setHoveredTicker, togglePin } = useFocusTicker();

  // Full narrative string
  const fullText = `${rankingLeader.symbol} leads the cohort at +${rankingLeader.returnPct.toFixed(
    1
  )}% over the period. ${maxCorrelation.x}–${maxCorrelation.y} correlation (${maxCorrelation.value.toFixed(
    2
  )}) marks the strongest co-movement across the universe.`;

  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('');
    setIndex(0);
  }, [fullText]);

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + fullText[index]);
        setIndex((prev) => prev + 1);
      }, 16);
      return () => clearTimeout(timeout);
    }
  }, [index, fullText]);

  return (
    <div className="h-8 px-3.5 rounded-md bg-[#0b101f]/80 border border-white/[0.07] flex items-center justify-between text-xs font-mono select-none overflow-hidden backdrop-blur-md mb-3">
      <div className="flex items-center space-x-2.5 min-w-0">
        <div className="flex items-center space-x-1 text-blue-400 shrink-0">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider uppercase text-blue-300">
            ALPHA INSIGHT
          </span>
        </div>

        <span className="text-slate-600 hidden sm:inline">|</span>

        {/* Narrative */}
        <p className="text-[11px] text-slate-300 font-sans truncate">
          {displayedText}
          {index < fullText.length && <span className="typewriter-cursor" />}
        </p>
      </div>

      {/* Quick Interactive Ticker Pills */}
      <div className="hidden lg:flex items-center space-x-1.5 shrink-0 pl-2">
        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
          Focus:
        </span>
        {[rankingLeader.symbol, maxCorrelation.x, maxCorrelation.y]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((sym) => {
            const color = getTickerColor(sym);
            return (
              <button
                key={sym}
                type="button"
                onMouseEnter={() => setHoveredTicker(sym)}
                onMouseLeave={() => setHoveredTicker(null)}
                onClick={() => togglePin(sym)}
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/[0.05] hover:bg-white/[0.12] transition border border-white/[0.08]"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-300">${sym}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
};
