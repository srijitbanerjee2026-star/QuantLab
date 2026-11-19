import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevated = false,
  noPadding = false,
  ...props
}) => {
  return (
    <div
      className={`rounded-lg transition-all duration-150 ${
        elevated
          ? 'bg-[#0d1322] border border-slate-700/60 shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
          : 'bg-slate-900/80 backdrop-blur-sm border border-slate-800/60'
      } ${noPadding ? '' : 'p-4'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
