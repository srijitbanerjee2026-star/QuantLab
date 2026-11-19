import React from 'react';
import { X } from 'lucide-react';

export interface TickerChipProps {
  symbol: string;
  onRemove?: (symbol: string) => void;
  active?: boolean;
  onClick?: (symbol: string) => void;
  color?: string;
  className?: string;
}

export const TickerChip: React.FC<TickerChipProps> = ({
  symbol,
  onRemove,
  active = false,
  onClick,
  color,
  className = '',
}) => {
  return (
    <span
      onClick={() => onClick && onClick(symbol)}
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold tracking-wide border transition-all duration-120 ${
        onClick ? 'cursor-pointer' : ''
      } ${
        active
          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
          : 'bg-slate-900 border-slate-700/60 text-slate-300 hover:border-slate-600'
      } ${className}`}
    >
      {color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span>{symbol}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(symbol);
          }}
          className="text-slate-500 hover:text-slate-200 p-0.5 rounded transition"
          aria-label={`Remove ${symbol}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
