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
      className={`rounded-[10px] transition-all duration-200 ${
        elevated
          ? 'bg-[#141414] border border-slate-700 shadow-lg'
          : 'bg-[#0b0b0b] border border-slate-700 hover:border-slate-600'
      } ${noPadding ? '' : 'p-4'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
