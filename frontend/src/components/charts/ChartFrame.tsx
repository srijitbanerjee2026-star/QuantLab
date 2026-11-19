import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { CardHeader } from '@/components/ui/CardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Download, MoreHorizontal, Maximize2 } from 'lucide-react';

export interface ChartFrameProps {
  title: string;
  badge?: string;
  subtitle?: string;
  heightClass?: string; // e.g. "h-[360px]" or "h-[320px]"
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  actions?: React.ReactNode;
  exportData?: any[];
  exportFilename?: string;
  children: React.ReactNode;
  className?: string;
}

export const ChartFrame: React.FC<ChartFrameProps> = ({
  title,
  badge,
  subtitle,
  heightClass = 'h-[360px]',
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyMessage = 'No chart data available for this selection.',
  actions,
  exportData,
  exportFilename = 'quantlab-data.csv',
  children,
  className = '',
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportCsv = () => {
    if (!exportData || exportData.length === 0) return;
    try {
      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map((obj) =>
        Object.values(obj)
          .map((v) => (typeof v === 'string' ? `"${v}"` : v))
          .join(',')
      );
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', exportFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportMenu(false);
    } catch (e) {
      console.error('Failed to export CSV', e);
    }
  };

  return (
    <Card noPadding className={`overflow-hidden flex flex-col ${className}`}>
      <CardHeader
        title={title}
        badge={badge}
        subtitle={subtitle}
        actions={
          <div className="flex items-center space-x-1.5">
            {actions}
            {exportData && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition"
                  title="Export Data"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {showExportMenu && (
                  <div
                    className="absolute right-0 top-6 z-30 w-32 bg-[#0d1322] border border-slate-700/60 rounded shadow-xl p-1 text-[11px] font-mono text-slate-300 animate-in fade-in"
                    onMouseLeave={() => setShowExportMenu(false)}
                  >
                    <button
                      onClick={handleExportCsv}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 hover:text-white transition"
                    >
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      <div className={`p-4 flex-1 w-full relative ${heightClass}`}>
        {loading ? (
          <Skeleton variant="chart" height="h-full" />
        ) : error ? (
          <div className="h-full flex items-center justify-center p-4">
            <AlertBanner message={error} onRetry={onRetry} />
          </div>
        ) : empty ? (
          <div className="h-full flex items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
            {emptyMessage}
          </div>
        ) : (
          <div className="w-full h-full min-h-[240px]">{children}</div>
        )}
      </div>
    </Card>
  );
};
