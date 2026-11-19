import React from 'react';

export interface PresetPillProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}

export const PresetPill: React.FC<PresetPillProps> = ({
  label,
  active = false,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-all duration-120 whitespace-nowrap ${
        active
          ? 'bg-blue-600/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-semibold'
          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
      } ${className}`}
    >
      {label}
    </button>
  );
};
