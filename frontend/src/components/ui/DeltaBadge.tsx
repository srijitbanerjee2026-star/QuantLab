import React from 'react';
import { fmtPct, signGlyph } from '@/lib/format';

export interface DeltaBadgeProps {
  value: number | null | undefined;
  format?: 'pct' | 'raw';
  decimals?: number;
  className?: string;
}

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
  value,
  format = 'pct',
  decimals = 2,
  className = '',
}) => {
  if (value === null || value === undefined || isNaN(value)) {
    return <span className={`text-[10px] font-mono text-slate-500 ${className}`}>—</span>;
  }

  const isPos = value > 0;
  const isNeg = value < 0;

  const glyph = signGlyph(value);
  const text = format === 'pct' ? fmtPct(value, { decimals }) : value.toFixed(decimals);

  let colorClasses = 'text-slate-400 bg-slate-800/40 border-slate-700/30';
  if (isPos) {
    colorClasses = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  } else if (isNeg) {
    colorClasses = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  }

  return (
    <span
      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold border ${colorClasses} ${className}`}
    >
      <span className="text-[8px] leading-none">{glyph}</span>
      <span>{text}</span>
    </span>
  );
};
