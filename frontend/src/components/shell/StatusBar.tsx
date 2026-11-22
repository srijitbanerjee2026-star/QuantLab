import React from 'react';
import { CacheMetadata } from '@/types';
import { Database, Activity, Server, Cpu } from 'lucide-react';

export interface StatusBarProps {
  cacheMeta: CacheMetadata;
  activeTicker: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ cacheMeta, activeTicker }) => {
  return (
    <footer className="h-6 bg-[#050505] border-t border-slate-700 px-4 flex items-center justify-between text-[10px] font-mono text-slate-500 select-none z-30">
      <div className="flex items-center space-x-4">
        <span className="flex items-center space-x-1.5 text-slate-400">
          <Server className="h-3 w-3 text-blue-400" />
          <span>DATA: {cacheMeta.source}</span>
        </span>
        <span className="hidden sm:inline border-l border-slate-800 pl-4">
          API LATENCY: <span className="text-slate-300 font-bold">{cacheMeta.latencyMs}ms</span>
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <span className="hidden sm:inline">
          CHECKED: <span className="text-slate-400">{cacheMeta.lastSync}</span>
        </span>
        <span className="border-l border-slate-800 pl-4 flex items-center space-x-1 text-slate-400">
          <Activity className="h-3 w-3 text-emerald-400" />
          <span>FOCUS: ${activeTicker}</span>
        </span>
      </div>
    </footer>
  );
};
