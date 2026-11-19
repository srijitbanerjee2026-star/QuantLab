import React from 'react';

export interface SkeletonProps {
  variant?: 'chart' | 'stat' | 'table' | 'heatmap' | 'text';
  height?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'chart',
  height,
  className = '',
}) => {
  if (variant === 'stat') {
    return (
      <div className={`p-3 bg-slate-900/60 border border-slate-800/60 rounded-lg space-y-2 ${className}`}>
        <div className="h-2.5 w-16 bg-slate-800 rounded animate-shimmer" />
        <div className="h-6 w-24 bg-slate-800 rounded animate-shimmer" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 p-3 bg-slate-900/40 rounded-lg ${className}`}>
        <div className="h-6 bg-slate-800/60 rounded animate-shimmer w-full" />
        <div className="h-6 bg-slate-800/40 rounded animate-shimmer w-full" />
        <div className="h-6 bg-slate-800/40 rounded animate-shimmer w-full" />
        <div className="h-6 bg-slate-800/40 rounded animate-shimmer w-full" />
      </div>
    );
  }

  if (variant === 'heatmap') {
    return (
      <div className={`grid grid-cols-5 gap-1.5 p-3 ${className}`}>
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-800/60 rounded animate-shimmer" />
        ))}
      </div>
    );
  }

  // Chart skeleton (default)
  return (
    <div
      className={`w-full rounded-lg border border-slate-800/40 bg-slate-950/40 flex flex-col justify-end p-4 space-y-3 ${
        height || 'h-[320px]'
      } ${className}`}
    >
      <div className="flex items-end justify-between space-x-2 h-4/5 w-full">
        {Array.from({ length: 12 }).map((_, i) => {
          const heights = ['h-2/5', 'h-3/5', 'h-4/5', 'h-1/2', 'h-3/4', 'h-2/3', 'h-5/6'];
          return (
            <div
              key={i}
              className={`flex-1 ${heights[i % heights.length]} bg-slate-800/50 rounded-t animate-shimmer`}
            />
          );
        })}
      </div>
      <div className="h-2 w-full bg-slate-800/40 rounded animate-shimmer" />
    </div>
  );
};
