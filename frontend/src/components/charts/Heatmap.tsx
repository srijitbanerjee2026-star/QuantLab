import React, { useState } from 'react';
import { CorrelationCell } from '@/types';
import { fmtRatio } from '@/lib/format';

export interface HeatmapProps {
  symbols: string[];
  data: CorrelationCell[];
  onCellClick?: (cell: CorrelationCell) => void;
  className?: string;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  symbols,
  data,
  onCellClick,
  className = '',
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string } | null>(null);

  // Map data for instant O(1) lookups: `x:y` -> value
  const valueMap = new Map<string, number>();
  data.forEach((d) => {
    valueMap.set(`${d.x}:${d.y}`, d.value);
  });

  // Diverging color scale
  const getCellColor = (val: number, isDiag: boolean) => {
    if (isDiag) return 'bg-slate-800/40 text-slate-500 font-normal';

    if (val >= 0.85) return 'bg-blue-600/80 text-blue-100 font-bold';
    if (val >= 0.6) return 'bg-emerald-600/70 text-emerald-100 font-bold';
    if (val >= 0.3) return 'bg-emerald-800/50 text-emerald-200';
    if (val >= 0.05) return 'bg-emerald-950/40 text-emerald-300';
    if (val <= -0.6) return 'bg-rose-700/80 text-rose-100 font-bold';
    if (val <= -0.3) return 'bg-rose-800/60 text-rose-200';
    if (val <= -0.05) return 'bg-rose-950/40 text-rose-300';
    return 'bg-slate-900/60 text-slate-400';
  };

  return (
    <div className={`overflow-x-auto w-full select-none ${className}`}>
      <table className="w-full border-collapse text-xs font-mono">
        <thead>
          <tr>
            <th className="p-2 border border-slate-800/80 bg-slate-950/60 text-left text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky left-0 z-10">
              Ticker
            </th>
            {symbols.map((sym) => {
              const isColHovered = hoveredCell?.x === sym;
              return (
                <th
                  key={sym}
                  className={`p-2 border border-slate-800/80 font-bold text-center transition-colors text-[11px] ${
                    isColHovered ? 'bg-blue-900/40 text-blue-300' : 'bg-slate-950/40 text-slate-300'
                  }`}
                >
                  {sym}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {symbols.map((rowSym) => {
            const isRowHovered = hoveredCell?.y === rowSym;
            return (
              <tr key={rowSym}>
                <td
                  className={`p-2 border border-slate-800/80 font-bold text-left transition-colors text-[11px] sticky left-0 z-10 ${
                    isRowHovered ? 'bg-blue-900/40 text-blue-300' : 'bg-slate-950/80 text-slate-300'
                  }`}
                >
                  {rowSym}
                </td>
                {symbols.map((colSym) => {
                  const val = valueMap.get(`${colSym}:${rowSym}`) ?? valueMap.get(`${rowSym}:${colSym}`) ?? 1.0;
                  const isDiag = rowSym === colSym;
                  const isCrosshair = hoveredCell && (hoveredCell.x === colSym || hoveredCell.y === rowSym);
                  const isDirectHover = hoveredCell?.x === colSym && hoveredCell?.y === rowSym;

                  const colorClass = getCellColor(val, isDiag);

                  return (
                    <td
                      key={colSym}
                      onMouseEnter={() => setHoveredCell({ x: colSym, y: rowSym })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => onCellClick && onCellClick({ x: colSym, y: rowSym, value: val })}
                      className={`p-2 border border-slate-800/80 text-center tabular-nums transition-all duration-100 cursor-default relative ${colorClass} ${
                        isDirectHover
                          ? 'ring-2 ring-blue-400 z-20 shadow-lg'
                          : isCrosshair
                          ? 'brightness-125'
                          : ''
                      }`}
                      title={`${rowSym} × ${colSym}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}`}
                    >
                      {val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Heatmap Legend Footprint */}
      <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
        <div className="flex items-center space-x-2">
          <span>Scale:</span>
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded bg-rose-600" />
            <span>−1.0 (Neg)</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded bg-slate-800" />
            <span>0.0</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded bg-emerald-500" />
            <span>+0.5</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded bg-blue-500" />
            <span>+1.0 (Pos)</span>
          </span>
        </div>
        <span>Hover for crosshair highlight</span>
      </div>
    </div>
  );
};
