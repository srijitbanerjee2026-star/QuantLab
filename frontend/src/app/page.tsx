'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ModuleId, CacheMetadata } from '@/types';
import { QuantLabAPI, registerCacheStatusListener } from '@/lib/api';
import { Sidebar } from '@/components/shell/Sidebar';
import { Header } from '@/components/shell/Header';
import { StatusBar } from '@/components/shell/StatusBar';
import { CommandPalette } from '@/components/ui/CommandPalette';

// Module Components
import { MultiAssetExplorer } from '@/components/modules/MultiAssetExplorer';
import { SingleAssetTechnicals } from '@/components/modules/SingleAssetTechnicals';
import { OptionsGreeks } from '@/components/modules/OptionsGreeks';
import { Macroeconomics } from '@/components/modules/Macroeconomics';
import { QuantLabs } from '@/components/modules/QuantLabs';
import { PortfolioRisk } from '@/components/modules/PortfolioRisk';

// Types
import {
  MultiAssetData,
  FeaturePoint,
  OptionsData,
  MacroData,
  SeasonalityData,
  MLPredictorData,
  ExperimentItem,
  BacktestData,
  RiskAnalysisData,
  PortfolioOptimizerData,
} from '@/types';

export default function QuantLabStation() {
  // Shell State
  const [activeModule, setActiveModule] = useState<ModuleId>('multi_asset');
  const [focusTicker, setFocusTicker] = useState<string>('AAPL');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  // Status & Telemetry
  const [cacheMeta, setCacheMeta] = useState<CacheMetadata>({
    state: 'hit',
    latencyMs: 14,
    lastSync: '10:00:00 AM',
    rowCount: 1250,
    source: 'PostgreSQL/Supabase',
  });

  // Module Data States
  const [multiAssetData, setMultiAssetData] = useState<MultiAssetData | null>(null);
  const [multiAssetLoading, setMultiAssetLoading] = useState<boolean>(false);

  const [technicalsData, setTechnicalsData] = useState<FeaturePoint[] | null>(null);
  const [technicalsLoading, setTechnicalsLoading] = useState<boolean>(false);

  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [optionsLoading, setOptionsLoading] = useState<boolean>(false);

  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [macroLoading, setMacroLoading] = useState<boolean>(false);

  const [seasonalityData, setSeasonalityData] = useState<SeasonalityData | null>(null);
  const [seasonalityLoading, setSeasonalityLoading] = useState<boolean>(false);

  const [mlData, setMlData] = useState<MLPredictorData | null>(null);
  const [mlLoading, setMlLoading] = useState<boolean>(false);

  const [experimentsData, setExperimentsData] = useState<ExperimentItem[] | null>(null);
  const [experimentsLoading, setExperimentsLoading] = useState<boolean>(false);

  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);

  const [riskData, setRiskData] = useState<RiskAnalysisData | null>(null);
  const [riskLoading, setRiskLoading] = useState<boolean>(false);

  const [optimizerData, setOptimizerData] = useState<PortfolioOptimizerData | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState<boolean>(false);

  // Register cache status callback
  useEffect(() => {
    setCacheMeta((prev) => ({
      ...prev,
      lastSync: new Date().toLocaleTimeString(),
    }));
    registerCacheStatusListener((meta) => {
      setCacheMeta(meta);
    });
  }, []);

  // Keyboard shortcut for Command Palette: Ctrl+K or Cmd+K
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

  // ---------------- Fetch Handlers ----------------

  const loadMultiAsset = useCallback(async (symbols: string[]) => {
    setMultiAssetLoading(true);
    try {
      const res = await QuantLabAPI.getMultiAsset(symbols);
      setMultiAssetData(res.data);
    } finally {
      setMultiAssetLoading(false);
    }
  }, []);

  const loadTechnicals = useCallback(async (sym: string) => {
    setTechnicalsLoading(true);
    try {
      const res = await QuantLabAPI.getSingleAsset(sym);
      setTechnicalsData(res.data);
    } finally {
      setTechnicalsLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async (sym: string) => {
    setOptionsLoading(true);
    try {
      const res = await QuantLabAPI.getOptions(sym);
      setOptionsData(res.data);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadMacro = useCallback(async () => {
    setMacroLoading(true);
    try {
      const res = await QuantLabAPI.getMacro();
      setMacroData(res.data);
    } finally {
      setMacroLoading(false);
    }
  }, []);

  const loadSeasonality = useCallback(async (sym: string) => {
    setSeasonalityLoading(true);
    try {
      const res = await QuantLabAPI.getSeasonality(sym);
      setSeasonalityData(res.data);
    } finally {
      setSeasonalityLoading(false);
    }
  }, []);

  const loadML = useCallback(async (sym: string, modelType: string = 'Random Forest') => {
    setMlLoading(true);
    try {
      const res = await QuantLabAPI.getMLPredictor(sym, modelType);
      setMlData(res.data);
    } finally {
      setMlLoading(false);
    }
  }, []);

  const loadExperiments = useCallback(async () => {
    setExperimentsLoading(true);
    try {
      const res = await QuantLabAPI.getExperiments();
      setExperimentsData(res.data);
    } finally {
      setExperimentsLoading(false);
    }
  }, []);

  const loadBacktest = useCallback(
    async (params: { shortWindow: number; longWindow: number; capital: number }) => {
      setBacktestLoading(true);
      try {
        const res = await QuantLabAPI.runBacktest({
          symbol: focusTicker,
          strategyType: 'moving_average_crossover',
          shortWindow: params.shortWindow,
          longWindow: params.longWindow,
          initialCapital: params.capital,
        });
        setBacktestData(res.data);
      } finally {
        setBacktestLoading(false);
      }
    },
    [focusTicker]
  );

  const loadRisk = useCallback(async (sym: string) => {
    setRiskLoading(true);
    try {
      const res = await QuantLabAPI.runRiskAnalysis(sym);
      setRiskData(res.data);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const loadOptimizer = useCallback(async (symbols: string[]) => {
    setOptimizerLoading(true);
    try {
      const res = await QuantLabAPI.runPortfolioOptimizer(symbols);
      setOptimizerData(res.data);
    } finally {
      setOptimizerLoading(false);
    }
  }, []);

  // Fetch data on module or ticker change
  useEffect(() => {
    switch (activeModule) {
      case 'multi_asset':
        if (!multiAssetData) {
          loadMultiAsset(['AAPL', 'MSFT', 'NVDA', 'SPY', 'GLD']);
        }
        break;
      case 'technicals':
        loadTechnicals(focusTicker);
        break;
      case 'options_greeks':
        loadOptions(focusTicker);
        break;
      case 'macro':
        if (!macroData) {
          loadMacro();
        }
        break;
      case 'seasonality':
        loadSeasonality(focusTicker);
        break;
      case 'ml_predictor':
        if (!mlData) {
          loadML(focusTicker);
        }
        break;
      case 'experiments':
        if (!experimentsData) {
          loadExperiments();
        }
        break;
      case 'backtest':
        if (!backtestData) {
          loadBacktest({ shortWindow: 20, longWindow: 50, capital: 100000 });
        }
        break;
      case 'risk_var':
        if (!riskData) {
          loadRisk(focusTicker);
        }
        break;
      case 'optimizer':
        if (!optimizerData) {
          loadOptimizer(['AAPL', 'MSFT', 'NVDA', 'SPY', 'TLT']);
        }
        break;
      default:
        break;
    }
  }, [
    activeModule,
    focusTicker,
    multiAssetData,
    macroData,
    mlData,
    experimentsData,
    backtestData,
    riskData,
    optimizerData,
    loadMultiAsset,
    loadTechnicals,
    loadOptions,
    loadMacro,
    loadSeasonality,
    loadML,
    loadExperiments,
    loadBacktest,
    loadRisk,
    loadOptimizer,
  ]);

  // Handle ticker change across workstation
  const handleSelectTicker = (ticker: string) => {
    const sym = ticker.toUpperCase();
    setFocusTicker(sym);
    if (activeModule === 'technicals') loadTechnicals(sym);
    if (activeModule === 'options_greeks') loadOptions(sym);
    if (activeModule === 'seasonality') loadSeasonality(sym);
    if (activeModule === 'ml_predictor') loadML(sym);
    if (activeModule === 'risk_var') loadRisk(sym);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#05070d] text-slate-200 antialiased font-sans select-none relative">
      {/* Slow-Drifting Obsidian Aurora Mesh */}
      <div className="aurora-mesh">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* 2% Film Grain Overlay */}
      <div className="film-grain" />

      {/* 1. Collapsible Left Sidebar */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={(id) => setActiveModule(id)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Main Station Work Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Sticky Institutional Header */}
        <Header
          activeModule={activeModule}
          focusTicker={focusTicker}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          cacheMeta={cacheMeta}
          onRefreshCache={() => {
            if (activeModule === 'multi_asset') loadMultiAsset(['AAPL', 'MSFT', 'NVDA', 'SPY', 'GLD']);
            else if (activeModule === 'technicals') loadTechnicals(focusTicker);
            else if (activeModule === 'options_greeks') loadOptions(focusTicker);
            else if (activeModule === 'macro') loadMacro();
            else if (activeModule === 'seasonality') loadSeasonality(focusTicker);
            else if (activeModule === 'ml_predictor') loadML(focusTicker);
            else if (activeModule === 'experiments') loadExperiments();
            else if (activeModule === 'backtest')
              loadBacktest({ shortWindow: 20, longWindow: 50, capital: 100000 });
            else if (activeModule === 'risk_var') loadRisk(focusTicker);
            else if (activeModule === 'optimizer')
              loadOptimizer(['AAPL', 'MSFT', 'NVDA', 'SPY', 'TLT']);
          }}
        />

        {/* Scrollable Viewport Canvas */}
        <main className="flex-1 overflow-y-auto px-5 py-4 min-w-0 bg-transparent">
          {activeModule === 'multi_asset' && (
            <MultiAssetExplorer
              data={multiAssetData}
              loading={multiAssetLoading}
              error={null}
              onRefresh={(symbols) => loadMultiAsset(symbols)}
              onSelectTicker={handleSelectTicker}
            />
          )}

          {activeModule === 'technicals' && (
            <SingleAssetTechnicals
              symbol={focusTicker}
              data={technicalsData}
              loading={technicalsLoading}
              error={null}
              onRefresh={() => loadTechnicals(focusTicker)}
            />
          )}

          {activeModule === 'options_greeks' && (
            <OptionsGreeks
              symbol={focusTicker}
              data={optionsData}
              loading={optionsLoading}
              error={null}
              onRefresh={() => loadOptions(focusTicker)}
            />
          )}

          {activeModule === 'macro' && (
            <Macroeconomics
              data={macroData}
              loading={macroLoading}
              error={null}
              onRefresh={() => loadMacro()}
            />
          )}

          {(activeModule === 'seasonality' ||
            activeModule === 'ml_predictor' ||
            activeModule === 'experiments') && (
            <QuantLabs
              symbol={focusTicker}
              subView={activeModule}
              seasonalityData={seasonalityData}
              seasonalityLoading={seasonalityLoading}
              mlData={mlData}
              mlLoading={mlLoading}
              experimentsData={experimentsData}
              experimentsLoading={experimentsLoading}
              onRefreshSeasonality={() => loadSeasonality(focusTicker)}
              onTrainML={(model) => loadML(focusTicker, model)}
              onRefreshExperiments={() => loadExperiments()}
              onLogExperiment={async () => {
                await QuantLabAPI.logExperiment({
                  experiment_name: `EXP-${focusTicker}-${Date.now().toString().slice(-4)}`,
                  model_type: 'Random Forest',
                  hyperparameters: { n_estimators: 100, max_depth: 5 },
                  metrics: { test_accuracy: 0.642, win_rate: 0.58 },
                  feature_importance: { rsi_14: 0.32, sma_20_ratio: 0.28 },
                  notes: `Institutional run for ${focusTicker}`,
                });
                loadExperiments();
              }}
            />
          )}

          {(activeModule === 'backtest' ||
            activeModule === 'risk_var' ||
            activeModule === 'optimizer') && (
            <PortfolioRisk
              symbol={focusTicker}
              subView={activeModule}
              backtestData={backtestData}
              backtestLoading={backtestLoading}
              onRunBacktest={(params) => loadBacktest(params)}
              riskData={riskData}
              riskLoading={riskLoading}
              onRunRisk={() => loadRisk(focusTicker)}
              optimizerData={optimizerData}
              optimizerLoading={optimizerLoading}
              onRunOptimizer={(symbols) => loadOptimizer(symbols)}
            />
          )}
        </main>

        {/* 3. Bottom Status Bar */}
        <StatusBar cacheMeta={cacheMeta} activeTicker={focusTicker} />
      </div>

      {/* 4. Global Command Palette Modal */}
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
