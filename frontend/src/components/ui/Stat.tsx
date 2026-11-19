import React from 'react';
import { DeltaBadge } from './DeltaBadge';

export interface StatProps {
  label: string;
  value: string | number;
  delta?: number;
  subtext?: string;
  sparkline?: number[];
  className?: string;
  valueColor?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  delta,
  subtext,
  sparkline,
  className = '',
  valueColor,
}) => {
  // Simple SVG sparkline renderer
  const renderSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const h = 20;
    const w = 48;

    const coords = points
      .map((p, idx) => {
        const x = (idx / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const isUp = points[points.length - 1] >= points[0];
    const stroke = isUp ? '#10b981' : '#ef4444';

    return (
      <svg width={w} height={h} className="overflow-visible shrink-0">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
  };

  return (
    <div className={`p-3 bg-slate-900/60 border border-slate-800/60 rounded-lg flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between space-x-2">
        <span className="text-[10px] uppercase font-bold tracking-[0.08em] text-slate-400 font-mono truncate">
          {label}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>

      <div className="flex items-end justify-between mt-1.5">
        <div className="min-w-0">
          <div
            className={`text-lg font-bold font-mono tabular-nums tracking-tight leading-none ${
              valueColor || 'text-white'
            }`}
          >
            {value}
          </div>
          {subtext && <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{subtext}</p>}
        </div>

        {sparkline && <div className="ml-2">{renderSparkline(sparkline)}</div>}
      </div>
    </div>
  );
};
