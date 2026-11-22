'use client';

import React, { useState, useEffect } from 'react';
import { Search, Clock, RefreshCw, ChevronRight, Palette } from 'lucide-react';
import { ModuleId, CacheMetadata } from '@/types';
import { DOMAIN_NAV } from './Sidebar';
import { StatusDot } from '@/components/ui/StatusDot';
import { Kbd } from '@/components/ui/Kbd';
import { useThemeAccent, AccentTheme } from '@/stores/useThemeAccent';

export interface HeaderProps {
  activeModule: ModuleId;
  focusTicker: string;
  onOpenCommandPalette: () => void;
  cacheMeta: CacheMetadata;
  onRefreshCache?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  focusTicker,
  onOpenCommandPalette,
  cacheMeta,
  onRefreshCache,
}) => {
  const [etTime, setEtTime] = useState<string>('');
  const [showCachePopover, setShowCachePopover] = useState<boolean>(false);
  const [showAccentPicker, setShowAccentPicker] = useState<boolean>(false);

  const { accent, setAccent } = useThemeAccent();

  // Live ET Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      setEtTime(new Intl.DateTimeFormat('en-US', options).format(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine current breadcrumb
  let groupLabel = 'CORE RESEARCH';
  let moduleLabel = 'Multi-Asset Explorer';

  for (const group of DOMAIN_NAV) {
    const item = group.items.find((i) => i.id === activeModule);
    if (item) {
      groupLabel = group.label;
      moduleLabel = item.label;
      break;
    }
  }

  // Cache pill styling
  let statusText = `API ONLINE · ${cacheMeta.latencyMs}ms`;
  let pillBorder = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  if (cacheMeta.state === 'fetching') {
    statusText = 'CHECKING…';
    pillBorder = 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse';
  } else if (cacheMeta.state === 'offline') {
    statusText = 'OFFLINE';
    pillBorder = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
  }

  const ACCENTS: { id: AccentTheme; label: string; color: string }[] = [
    { id: 'aurora', label: 'Aurora', color: '#60a5fa' },
    { id: 'matrix', label: 'Matrix', color: '#22c55e' },
    { id: 'amber', label: 'Amber', color: '#f59e0b' },
    { id: 'ice', label: 'Ice', color: '#38bdf8' },
  ];

  return (
    <header className="h-14 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs min-w-0">
        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 truncate">{groupLabel}</span>
        <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
        <span className="text-white font-semibold truncate text-sm">{moduleLabel}</span>
      </div>

      {/* Center: Focus Ticker Command Palette Trigger */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center space-x-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-teal-400/40 rounded-xl px-4 py-2 min-w-[260px] justify-between transition text-xs font-mono shadow-sm group"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-300 transition" />
          <span className="text-slate-400 text-[11px]">Focus:</span>
          <span className="text-teal-300 font-semibold font-mono tracking-wide">${focusTicker}</span>
          <div className="hidden sm:flex items-center space-x-1 pl-2 border-l border-white/[0.08]">
            <Kbd>⌘K</Kbd>
          </div>
        </button>
      </div>

      {/* Right: Accent Switcher, Cache Status Pill & Market Clock */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        {/* Accent Theme Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAccentPicker(!showAccentPicker)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition flex items-center space-x-1"
            title="Switch Obsidian Accent Theme"
          >
            <Palette className="h-3.5 w-3.5" />
          </button>

          {showAccentPicker && (
            <div
              className="absolute right-0 top-8 z-50 w-36 bg-[#0d1322] border border-slate-700/80 rounded-lg shadow-2xl p-1.5 space-y-1 text-xs"
              onMouseLeave={() => setShowAccentPicker(false)}
            >
              <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                Theme Glow
              </div>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAccent(a.id);
                    setShowAccentPicker(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded text-left transition ${
                    accent === a.id
                      ? 'bg-white/[0.1] text-white font-bold'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="capitalize">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cache status pill with popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCachePopover(!showCachePopover)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border transition ${pillBorder}`}
            title="Click to view connection status"
          >
            <StatusDot state={cacheMeta.state} size="sm" />
            <span className="font-semibold">{statusText}</span>
          </button>

          {showCachePopover && (
            <div
              className="absolute right-0 top-8 z-50 w-64 bg-[#0d1322] border border-slate-700/80 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.7)] p-3 text-xs space-y-2.5"
              onMouseLeave={() => setShowCachePopover(false)}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider">
                  Connection
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">OK</span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                <div className="flex justify-between">
                  <span>Data:</span>
                  <span className="text-slate-200">{cacheMeta.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span className="text-slate-200">{cacheMeta.latencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Last checked:</span>
                  <span className="text-slate-200">{cacheMeta.lastSync}</span>
                </div>
              </div>

              {onRefreshCache && (
                <button
                  type="button"
                  onClick={() => {
                    onRefreshCache();
                    setShowCachePopover(false);
                  }}
                  className="w-full mt-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded flex items-center justify-center space-x-1 transition"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Re-check connection</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live ET Clock */}
        <div className="hidden sm:flex items-center space-x-1.5 text-slate-400 bg-white/[0.03] px-2 py-1 rounded border border-white/[0.08]">
          <Clock className="h-3 w-3 text-slate-500" />
          <span className="tabular-nums font-mono text-[11px] font-bold text-slate-300">
            {etTime || '09:30:00'} ET
          </span>
        </div>
      </div>
    </header>
  );
};
