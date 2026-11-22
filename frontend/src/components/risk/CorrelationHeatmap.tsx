import React from 'react';
import { CorrelationData } from '@/lib/api/risk';

// Diverging scale: negative = blue, zero = neutral, positive = amber.
const cell = (v: number | null): React.CSSProperties => {
  if (v === null) return { background: '#111' };
  const a = Math.min(Math.abs(v), 1) * 0.75;
  return { background: v >= 0 ? `rgba(255,159,26,${a})` : `rgba(79,195,247,${a})` };
};

export const CorrelationHeatmap: React.FC<{ data: CorrelationData }> = ({ data }) => (
  <div className="overflow-auto">
    <table className="text-[11px] border-separate border-spacing-0.5 mx-auto">
      <thead>
        <tr>
          <th />
          {data.symbols.map((s) => (
            <th key={s} className="px-2 py-1 text-slate-400 font-medium">{s}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.symbols.map((rowSym, i) => (
          <tr key={rowSym}>
            <th className="px-2 py-1 text-right text-slate-400 font-medium">{rowSym}</th>
            {data.matrix[i].map((v, j) => (
              <td
                key={j}
                style={cell(v)}
                className={`w-14 h-9 text-center tabular-nums ${i === j ? 'text-black font-semibold' : 'text-slate-100'}`}
                title={`${rowSym} vs ${data.symbols[j]}: ${v ?? 'n/a'}`}
              >
                {v === null ? '—' : v.toFixed(2)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-slate-500">
      <span>−1</span>
      <span className="h-2 w-32" style={{ background: 'linear-gradient(90deg, rgba(79,195,247,.75), #111, rgba(255,159,26,.75))' }} />
      <span>+1</span>
      {data.observations ? <span className="ml-3">{data.observations} overlapping days</span> : null}
    </div>
  </div>
);
