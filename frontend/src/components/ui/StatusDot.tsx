import React from 'react';

export type StatusDotState = 'hit' | 'fetching' | 'offline' | 'warning';

export interface StatusDotProps {
  state: StatusDotState;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  state,
  size = 'sm',
  pulse = true,
  className = '',
}) => {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  let color = 'bg-emerald-400';
  if (state === 'fetching' || state === 'warning') color = 'bg-amber-400';
  if (state === 'offline') color = 'bg-rose-500';

  const shouldPulse = pulse && (state === 'fetching' || state === 'hit');

  return (
    <span className={`relative inline-flex rounded-full ${sizeClass} ${color} ${className}`}>
      {shouldPulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
    </span>
  );
};
