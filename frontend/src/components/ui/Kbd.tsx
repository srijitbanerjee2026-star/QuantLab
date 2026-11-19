import React from 'react';

export interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export const Kbd: React.FC<KbdProps> = ({ children, className = '' }) => {
  return (
    <kbd
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-400 bg-slate-900 border border-slate-700/60 rounded shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ${className}`}
    >
      {children}
    </kbd>
  );
};
