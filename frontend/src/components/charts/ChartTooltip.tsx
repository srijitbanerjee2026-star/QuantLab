import React from 'react';
import { fmtPct, fmtPrice, fmtNumber } from '@/lib/format';

export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatValue?: (val: number, name: string) => string;
  unit?: string;
  sortDescending?: boolean;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  formatValue,
  unit = '',
  sortDescending = true,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  // Filter out hidden or undefined series
  const validItems = payload.filter((p) => p && p.value !== undefined && p.value !== null);

  const sorted = sortDescending
    ? [...validItems].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    : validItems;

  return (
    <div className="bg-[#0d1322] border border-slate-700/80 rounded-md p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.7)] text-xs font-mono min-w-[160px] pointer-events-none select-none z-50">
      {label && (
        <div className="text-[10px] text-slate-400 font-bold uppercase pb-1.5 mb-1.5 border-b border-slate-800/80 tracking-wider">
          {label}
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((item, idx) => {
          const valNum = Number(item.value);
          const color = item.color || item.fill || item.stroke || '#3b82f6';
          const name = item.name || item.dataKey || `Series ${idx + 1}`;

          let displayVal = `${valNum}${unit}`;
          if (formatValue) {
            displayVal = formatValue(valNum, name);
          } else if (unit === '%') {
            displayVal = fmtPct(valNum);
          } else if (unit === '$') {
            displayVal = fmtPrice(valNum);
          } else {
            displayVal = `${fmtNumber(valNum, 2)}${unit ? ` ${unit}` : ''}`;
          }

          return (
            <div key={idx} className="flex items-center justify-between space-x-3 text-[11px]">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-slate-300 truncate max-w-[110px]">{name}</span>
              </div>
              <span className="font-bold text-white tabular-nums shrink-0">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
