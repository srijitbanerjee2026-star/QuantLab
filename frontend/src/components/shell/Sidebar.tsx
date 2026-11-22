'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  TrendingUp,
  Layers,
  ShieldAlert,
  Activity,
  Zap,
  Globe,
  Cpu,
  Calendar,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Terminal,
  LayoutDashboard,
  Search,
} from 'lucide-react';
import { ModuleId, DomainGroupId } from '@/types';
import { Kbd } from '@/components/ui/Kbd';
import { motion } from 'framer-motion';

export interface NavGroupConfig {
  id: DomainGroupId;
  label: string;
  items: {
    id: ModuleId;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const DOMAIN_NAV: NavGroupConfig[] = [
  {
    id: 'overview',
    label: 'OVERVIEW',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'markets',
    label: 'MARKETS',
    items: [
      { id: 'explorer', label: 'Market Explorer', icon: Search },
      { id: 'multi_asset', label: 'Cross-Asset Analysis', icon: BarChart2 },
      { id: 'technicals', label: 'Technical Analysis', icon: TrendingUp },
      { id: 'options_greeks', label: 'Options & Greeks', icon: Zap },
      { id: 'macro', label: 'Macro & Rates', icon: Globe },
    ],
  },
  {
    id: 'research',
    label: 'RESEARCH',
    items: [
      { id: 'seasonality', label: 'Seasonality', icon: Calendar },
      { id: 'ml_predictor', label: 'ML Models', icon: Cpu },
      { id: 'experiments', label: 'Experiments', icon: Database },
    ],
  },
  {
    id: 'portfolio',
    label: 'PORTFOLIO',
    items: [
      { id: 'risk_var', label: 'Risk Analysis', icon: ShieldAlert },
      { id: 'optimizer', label: 'Optimisation', icon: Activity },
    ],
  },
  {
    id: 'strategies',
    label: 'STRATEGIES',
    items: [{ id: 'backtest', label: 'Backtesting', icon: Layers }],
  },
];

export interface SidebarProps {
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Keyboard shortcut: `[` toggles sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCollapse]);

  // Mini market sparkline path for SPY
  const spySparkline = 'M 0,16 L 8,14 L 16,15 L 24,12 L 32,13 L 40,9 L 48,11 L 56,7 L 64,5 L 72,4 L 80,2';

  return (
    <aside
      className={`border-r border-white/[0.08] bg-[#050505] flex flex-col justify-between transition-all duration-200 z-30 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-white/[0.06] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="bg-blue-400 p-1.5 rounded-md text-slate-950 shrink-0">
            <Terminal className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="text-sm font-semibold tracking-[0.18em] text-white uppercase">
                QUANTLAB
              </span>
              <span className="block text-[9px] text-slate-500 tracking-wide -mt-0.5">Quantitative Research</span>

            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition"
          title={collapsed ? 'Expand Sidebar ([)' : 'Collapse Sidebar ([)'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 px-2">
        {DOMAIN_NAV.map((group) => {
          const isGroupCollapsed = collapsedGroups[group.id] && !collapsed;

          return (
            <div key={group.id} className="space-y-0.5">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em] flex items-center justify-between hover:text-slate-300 transition"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 text-slate-600 transition-transform ${
                      isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>
              )}

              {!isGroupCollapsed &&
                group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectModule(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 relative group ${
                        isActive
                          ? 'bg-white/[0.06] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Active Gradient 2px left indicator rail with soft glow */}
                      {isActive && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-teal-400 rounded-r" />
                      )}

                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            isActive ? 'text-teal-300' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                        />
                        {!collapsed && <span className="truncate text-[12.5px]">{item.label}</span>}
                      </div>

                      {!collapsed && item.badge && (
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border uppercase shrink-0 ${
                            isActive
                              ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                              : 'bg-white/[0.04] text-slate-500 border-white/[0.06]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Footer with Market Mini-Sparkline */}
      <div className="p-3 border-t border-white/[0.08] bg-black/40 text-[10px] font-mono text-slate-500 space-y-2">
        {!collapsed ? (
          <>
            {/* SPY Market Mini-Ticker Strip */}
            <div className="flex items-center justify-between px-1.5 py-1 rounded bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-300 font-bold">$SPY</span>
                <span className="text-emerald-400 font-semibold">+0.84%</span>
              </div>
              <svg width="60" height="18" className="overflow-visible">
                <path
                  d={spySparkline}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-slate-500 pt-0.5">
              <span>NYC-QUANT-01</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                PROD
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>v2.5.0-obsidian</span>
              <span className="flex items-center space-x-1">
                <span>Toggle:</span>
                <Kbd>[</Kbd>
              </span>
            </div>
          </>
        ) : (
          <div className="text-center font-bold text-slate-600">PROD</div>
        )}
      </div>
    </aside>
  );
};
