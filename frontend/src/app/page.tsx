'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ModuleId, CacheMetadata } from '@/types';
import { QuantLabAPI } from '@/lib/api';
import { MarketAPI } from '@/lib/api/market';
import { Sidebar } from '@/components/shell/Sidebar';
import { TickerTape } from '@/components/shell/TickerTape';
import { Header } from '@/components/shell/Header';
import { StatusBar } from '@/components/shell/StatusBar';
import { CommandPalette } from '@/components/ui/CommandPalette';

// Modules
import { Dashboard } from '@/components/dashboard/Dashboard';
import { MarketExplorer } from '@/components/explorer/MarketExplorer';
import { MultiAssetExplorer } from '@/components/modules/MultiAssetExplorer';
import { TechnicalAnalysis } from '@/components/technicals/TechnicalAnalysis';
import { OptionsGreeksPage } from '@/components/options/OptionsGreeksPage';
import { MacroRates } from '@/components/macro/MacroRates';
import { Seasonality } from '@/components/seasonality/Seasonality';
import { MLModels } from '@/components/ml/MLModels';
import { Experiments } from '@/components/ml/Experiments';
import { RiskAnalysis } from '@/components/risk/RiskAnalysis';
import { Optimisation } from '@/components/risk/Optimisation';
import { Backtesting } from '@/components/backtest/Backtesting';

import { MultiAssetData } from '@/types';

interface ConnectionStatus {
  api: boolean;
  db: boolean;
  latencyMs: number;
  checkedAt: string;
}

export default function QuantLabStation() {
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [focusTicker, setFocusTicker] = useState<string>('AAPL');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  // Real connection status: polled from the backend health endpoints (no placeholder values).
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [healthNonce, setHealthNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const t0 = performance.now();
      const h = await MarketAPI.health();
      if (cancelled) return;
      setStatus({ ...h, latencyMs: Math.round(performance.now() - t0), checkedAt: new Date().toLocaleTimeString() });
    };
    check();
    const id = setInterval(check, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [healthNonce]);

  const cacheMeta = useMemo<CacheMetadata>(
    () => ({
      state: status === null ? 'fetching' : status.api ? 'hit' : 'offline',
      latencyMs: status?.latencyMs ?? 0,
      lastSync: status?.checkedAt ?? '—',
      source:
        status === null
          ? 'Checking connection…'
          : !status.api
            ? 'Backend offline'
            : status.db
              ? 'Yahoo Finance · FRED · Supabase'
              : 'Yahoo Finance · FRED (database offline)',
    }),
    [status]
  );

  // Cross-Asset Analysis still uses the original correlation/ranking client.
  const [multiAssetData, setMultiAssetData] = useState<MultiAssetData | null>(null);
  const [multiAssetLoading, setMultiAssetLoading] = useState<boolean>(false);

  const loadMultiAsset = useCallback(async (symbols: string[]) => {
    setMultiAssetLoading(true);
    try {
      const res = await QuantLabAPI.getMultiAsset(symbols);
      setMultiAssetData(res.data);
    } finally {
      setMultiAssetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeModule !== 'multi_asset' || multiAssetData) return;
    let cancelled = false;
    QuantLabAPI.getMultiAsset(['AAPL', 'MSFT', 'NVDA', 'SPY', 'GLD']).then((res) => {
      if (!cancelled) setMultiAssetData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeModule, multiAssetData]);

  // Ctrl/Cmd+K toggles the command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectTicker = (ticker: string) => setFocusTicker(ticker.toUpperCase());

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#000000] text-slate-200 antialiased font-sans select-none relative">
      <Sidebar
        activeModule={activeModule}
        onSelectModule={(id) => setActiveModule(id)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        <TickerTape onSelect={handleSelectTicker} />
        <Header
          activeModule={activeModule}
          focusTicker={focusTicker}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          cacheMeta={cacheMeta}
          onRefreshCache={() => setHealthNonce((n) => n + 1)}
        />

        <main className="flex-1 overflow-y-auto px-5 py-4 min-w-0 bg-transparent">
          {activeModule === 'dashboard' && <Dashboard focusTicker={focusTicker} onSelectTicker={handleSelectTicker} />}

          {activeModule === 'explorer' && (
            <MarketExplorer
              focusTicker={focusTicker}
              onSelectTicker={handleSelectTicker}
              onOpenBacktest={(s) => {
                handleSelectTicker(s.replace('^', ''));
                setActiveModule('backtest');
              }}
            />
          )}

          {activeModule === 'multi_asset' && (
            <MultiAssetExplorer
              data={multiAssetData}
              loading={multiAssetLoading || !multiAssetData}
              error={null}
              onRefresh={(symbols) => loadMultiAsset(symbols)}
              onSelectTicker={handleSelectTicker}
            />
          )}

          {activeModule === 'technicals' && <TechnicalAnalysis focusTicker={focusTicker} onSelectTicker={handleSelectTicker} />}
          {activeModule === 'options_greeks' && <OptionsGreeksPage focusTicker={focusTicker} onSelectTicker={handleSelectTicker} />}
          {activeModule === 'macro' && <MacroRates />}
          {activeModule === 'seasonality' && <Seasonality focusTicker={focusTicker} onSelectTicker={handleSelectTicker} />}
          {activeModule === 'ml_predictor' && <MLModels key={focusTicker} initialSymbol={focusTicker} />}
          {activeModule === 'experiments' && <Experiments />}
          {activeModule === 'backtest' && <Backtesting initialSymbol={focusTicker} />}
          {activeModule === 'risk_var' && <RiskAnalysis key={focusTicker} initialSymbol={focusTicker} />}
          {activeModule === 'optimizer' && <Optimisation />}
        </main>

        <StatusBar cacheMeta={cacheMeta} activeTicker={focusTicker} />
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        currentTicker={focusTicker}
        onSelectTicker={(sym) => {
          handleSelectTicker(sym);
          setCommandPaletteOpen(false);
        }}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          setCommandPaletteOpen(false);
        }}
      />
    </div>
  );
}
