import React from 'react';

export interface CardHeaderProps {
  title: string;
  badge?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  badge,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`h-9 px-4 border-b border-slate-800/60 flex items-center justify-between text-xs select-none ${className}`}
    >
      <div className="flex items-center space-x-2 min-w-0">
        <span className="text-[10px] uppercase font-bold tracking-[0.08em] text-slate-400 font-mono truncate">
          {title}
        </span>
        {badge && (
          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
            {badge}
          </span>
        )}
        {subtitle && (
          <span className="hidden sm:inline text-[10px] text-slate-500 font-mono truncate">
            · {subtitle}
          </span>
        )}
      </div>

      {actions && <div className="flex items-center space-x-2 shrink-0">{actions}</div>}
    </div>
  );
};
