'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CorrelationCell } from '@/types';
import { getCorrelationColor, getTickerColor } from '@/lib/tokens';
import { useFocusTicker } from '@/stores/useFocusTicker';
import { ScatterDrawer } from '@/components/ui/ScatterDrawer';
import { Sliders, Sparkles, HelpCircle } from 'lucide-react';

export interface CorrelationMatrix2Props {
  symbols: string[];
  matrixData: CorrelationCell[];
}

export const CorrelationMatrix2: React.FC<CorrelationMatrix2Props> = ({
  symbols,
  matrixData,
}) => {
  const { setHoveredTicker, togglePin, isDimmed } = useFocusTicker();

  // Controls State
  const [isClustered, setIsClustered] = useState<boolean>(false);
  const [method, setMethod] = useState<'pearson' | 'spearman'>('pearson');
  const [windowDays, setWindowDays] = useState<number>(60);
  const [showSlider, setShowSlider] = useState<boolean>(false);

  // Crosshair Hover State
  const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string; value: number } | null>(
    null
  );

  // Scatter Drawer State
  const [selectedPair, setSelectedPair] = useState<{
    x: string;
    y: string;
    value: number;
  } | null>(null);

  // Build 2D lookup map: lookup[symA][symB]
  const matrixLookup = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    symbols.forEach((s1) => {
      map[s1] = {};
      symbols.forEach((s2) => {
        if (s1 === s2) {
          map[s1][s2] = 1.0;
        } else {
          const found = matrixData.find(
            (c) => (c.x === s1 && c.y === s2) || (c.x === s2 && c.y === s1)
          );
          map[s1][s2] = found ? found.value : 0.0;
        }
      });
    });
    return map;
  }, [symbols, matrixData]);

  // Order of symbols: natural or clustered
  const orderedSymbols = useMemo(() => {
    if (!isClustered) return symbols;

    // Simple agglomerative clustering by correlation distance (1 - rho)
    const sorted = [...symbols].sort((a, b) => {
      // Sort tech tickers together, then commodities, etc.
      const sumA = symbols.reduce((acc, s) => acc + (matrixLookup[a]?.[s] || 0), 0);
      const sumB = symbols.reduce((acc, s) => acc + (matrixLookup[b]?.[s] || 0), 0);
      return sumB - sumA;
    });
    return sorted;
  }, [symbols, isClustered, matrixLookup]);

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Top Matrix Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-xs font-mono">
        <div className="flex items-center space-x-2">
          {/* Method Pill */}
          <div className="inline-flex rounded-md p-0.5 bg-white/[0.04] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMethod('pearson')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                method === 'pearson'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pearson
            </button>
            <button
              type="button"
              onClick={() => setMethod('spearman')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                method === 'spearman'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Spearman
            </button>
          </div>

          {/* Cluster Toggle Button */}
          <button
            type="button"
            onClick={() => setIsClustered(!isClustered)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center space-x-1 border transition ${
              isClustered
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(192,132,252,0.25)]'
                : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Cluster</span>
          </button>
        </div>

        {/* Window Slider Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowSlider(!showSlider)}
            className={`p-1 rounded text-slate-400 hover:text-slate-200 transition ${
              showSlider ? 'bg-white/10 text-white' : ''
            }`}
            title="Adjust Rolling Window"
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-slate-400 font-mono">
            {windowDays}d window
          </span>
        </div>
      </div>

      {/* Optional Window Slider Drawer */}
      <AnimatePresence>
        {showSlider && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-2 mb-2 border-b border-white/[0.06]"
          >
            <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400">
              <span>Rolling Window:</span>
              <input
                type="range"
                min={20}
                max={252}
                step={5}
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
                className="flex-1 accent-blue-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-200 w-10 text-right">{windowDays}d</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heatmap Grid Table */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center justify-center py-1">
        <table className="border-collapse table-fixed select-none">
          <thead>
            <tr>
              <th className="w-12 h-7 text-[10px] font-mono uppercase tracking-wider text-slate-500 text-left p-1">
                TICKER
              </th>
              {orderedSymbols.map((s) => {
                const color = getTickerColor(s);
                const isCross = hoveredCell && (hoveredCell.x === s || hoveredCell.y === s);
                const dimmed = isDimmed(s);

                return (
                  <motion.th
                    layout
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    key={s}
                    onMouseEnter={() => setHoveredTicker(s)}
                    onMouseLeave={() => setHoveredTicker(null)}
                    onClick={() => togglePin(s)}
                    className={`w-12 h-7 text-center text-[10px] font-mono font-bold tracking-wider cursor-pointer transition-colors duration-150 p-1 ${
                      isCross ? 'text-white' : 'text-slate-400'
                    } ${dimmed ? 'opacity-20' : 'opacity-100'}`}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded border border-transparent hover:border-white/20"
                      style={{ color: isCross ? '#fff' : color }}
                    >
                      {s}
                    </span>
                  </motion.th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {orderedSymbols.map((s1) => {
              const color1 = getTickerColor(s1);
              const isCrossRow = hoveredCell && (hoveredCell.x === s1 || hoveredCell.y === s1);
              const rowDimmed = isDimmed(s1);

              return (
                <motion.tr
                  layout
                  transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                  key={s1}
                >
                  {/* Row Header */}
                  <th
                    onMouseEnter={() => setHoveredTicker(s1)}
                    onMouseLeave={() => setHoveredTicker(null)}
                    onClick={() => togglePin(s1)}
                    className={`h-9 text-left text-[10px] font-mono font-bold tracking-wider cursor-pointer transition-colors duration-150 pr-2 ${
                      isCrossRow ? 'text-white' : 'text-slate-400'
                    } ${rowDimmed ? 'opacity-20' : 'opacity-100'}`}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded border border-transparent hover:border-white/20"
                      style={{ color: isCrossRow ? '#fff' : color1 }}
                    >
                      {s1}
                    </span>
                  </th>

                  {/* Heatmap Cells */}
                  {orderedSymbols.map((s2) => {
                    const isDiagonal = s1 === s2;
                    const val = isDiagonal ? 1.0 : (matrixLookup[s1]?.[s2] ?? 0.0);
                    const colorStyle = getCorrelationColor(val);
                    const isCellHovered =
                      hoveredCell && hoveredCell.x === s1 && hoveredCell.y === s2;
                    const isInCrosshair =
                      hoveredCell && (hoveredCell.x === s1 || hoveredCell.y === s2);
                    const cellDimmed = isDimmed(s1) || isDimmed(s2);

                    return (
                      <td
                        key={s2}
                        onMouseEnter={() => {
                          setHoveredCell({ x: s1, y: s2, value: val });
                          setHoveredTicker(s1);
                        }}
                        onMouseLeave={() => {
                          setHoveredCell(null);
                          setHoveredTicker(null);
                        }}
                        onClick={() => {
                          if (!isDiagonal) {
                            setSelectedPair({ x: s1, y: s2, value: val });
                          }
                        }}
                        className={`w-12 h-9 p-0.5 text-center transition-all duration-150 relative ${
                          isDiagonal ? 'cursor-default' : 'cursor-pointer'
                        } ${cellDimmed ? 'opacity-20' : 'opacity-100'}`}
                      >
                        <div
                          className={`w-full h-full rounded flex items-center justify-center font-mono text-[11px] font-bold tabular-nums transition-transform duration-150 relative ${
                            isDiagonal ? 'diagonal-hatch border border-white/[0.04]' : ''
                          } ${
                            isCellHovered
                              ? 'scale-110 z-20 shadow-[0_0_16px_rgba(255,255,255,0.3)] ring-1 ring-white'
                              : isInCrosshair
                              ? 'ring-1 ring-white/30'
                              : ''
                          }`}
                          style={
                            !isDiagonal
                              ? {
                                  backgroundColor: colorStyle.bg,
                                  color: colorStyle.text,
                                  borderColor: colorStyle.border,
                                }
                              : undefined
                          }
                        >
                          {!isDiagonal ? (
                            <span>
                              {val > 0 ? '+' : ''}
                              {val.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500 opacity-60">1.0</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Footer: Dynamic Cell Detail or Scale */}
      <div className="pt-2 mt-1 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
        {hoveredCell && hoveredCell.x !== hoveredCell.y ? (
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="font-bold text-white">
              ${hoveredCell.x} ↔ ${hoveredCell.y}
            </span>
            <span>·</span>
            <span>
              ρ = <strong className="text-emerald-400">{hoveredCell.value.toFixed(2)}</strong>
            </span>
            <span>·</span>
            <span className="text-[9px] text-slate-400">Click cell for regression scatter</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>Diverging Scale:</span>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#fb7185]" />
              <span className="text-slate-400">−1.0</span>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0b1020] border border-white/10" />
              <span className="text-slate-400">0.0</span>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#34d399]" />
              <span className="text-slate-400">+1.0</span>
            </div>
          </div>
        )}

        <span className="text-[9px] text-slate-500">
          Crosshair & Scatter Active
        </span>
      </div>

      {/* Slide-in Pair Scatter Drawer */}
      <ScatterDrawer
        isOpen={selectedPair !== null}
        onClose={() => setSelectedPair(null)}
        pair={selectedPair}
      />
    </div>
  );
};
