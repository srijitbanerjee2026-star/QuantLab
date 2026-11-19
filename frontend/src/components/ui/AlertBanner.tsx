import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

export interface AlertBannerProps {
  message: string;
  endpoint?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  message,
  endpoint,
  onRetry,
  onDismiss,
  className = '',
}) => {
  return (
    <div
      className={`bg-rose-950/60 border border-rose-800/80 text-rose-200 px-3.5 py-2.5 rounded-lg text-xs flex items-center justify-between shadow-lg backdrop-blur-sm ${className}`}
      role="alert"
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
        <span className="truncate">{message}</span>
        {endpoint && (
          <code className="hidden sm:inline text-[10px] font-mono bg-rose-900/60 px-1.5 py-0.5 rounded text-rose-300">
            {endpoint}
          </code>
        )}
      </div>

      <div className="flex items-center space-x-2 shrink-0 ml-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center space-x-1 text-[11px] font-mono bg-rose-900/80 hover:bg-rose-800 text-rose-100 px-2 py-0.5 rounded transition"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-rose-400 hover:text-white p-0.5 rounded transition"
            aria-label="Dismiss alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
