import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, X, Clock, Layers } from 'lucide-react';
import { ModuleId } from '@/types';
import { Kbd } from './Kbd';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentTicker: string;
  onSelectTicker: (ticker: string) => void;
  onSelectModule: (moduleId: ModuleId) => void;
}

const POPULAR_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'US Equity' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'US Equity' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetClass: 'US Equity' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'Index ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: 'Index ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', assetClass: 'Commodity' },
  { symbol: 'TLT', name: '20+ Year Treasury Bond ETF', assetClass: 'Fixed Income' },
  { symbol: 'BTC-USD', name: 'Bitcoin / USD', assetClass: 'Digital Asset' },
];

const MODULE_COMMANDS: Array<{ id: ModuleId; label: string; group: string }> = [
  { id: 'multi_asset', label: 'Multi-Asset Explorer (2x2 Matrix)', group: 'Core Research' },
  { id: 'technicals', label: 'Single-Asset Technicals (SMA, RSI, Vol)', group: 'Core Research' },
  { id: 'options_greeks', label: 'Options & Greeks Exposure (GEX, DEX, IV)', group: 'Options & Vol' },
  { id: 'macro', label: 'Macroeconomics (Yield Curve, Sahm Rule)', group: 'Macroeconomics' },
  { id: 'seasonality', label: 'Market Seasonality (Monthly Distribution)', group: 'Quant Labs' },
  { id: 'ml_predictor', label: 'ML Direction Predictor (Random Forest)', group: 'Quant Labs' },
  { id: 'backtest', label: 'Strategy Backtest Engine', group: 'Portfolio & Risk' },
  { id: 'risk_var', label: 'Risk & VaR Distribution Analysis', group: 'Portfolio & Risk' },
  { id: 'optimizer', label: 'Markowitz Efficient Frontier Optimizer', group: 'Portfolio & Risk' },
  { id: 'experiments', label: 'Logged Quantitative Experiments', group: 'Quant Labs' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  currentTicker,
  onSelectTicker,
  onSelectModule,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut listener for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = query.trim().toUpperCase();

  // Filter tickers
  const filteredTickers = POPULAR_TICKERS.filter(
    (t) => t.symbol.includes(trimmed) || t.name.toUpperCase().includes(trimmed)
  );

  // Filter modules
  const filteredModules = MODULE_COMMANDS.filter(
    (m) => m.label.toUpperCase().includes(trimmed) || m.group.toUpperCase().includes(trimmed)
  );

  const totalItems = (trimmed && !filteredTickers.find((t) => t.symbol === trimmed) ? 1 : 0) +
    filteredTickers.length +
    filteredModules.length;

  const handleSelectCustomTicker = () => {
    if (trimmed) {
      onSelectTicker(trimmed);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#0d1322] border border-slate-700/60 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.7)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="h-12 px-4 border-b border-slate-800/80 flex items-center space-x-3 bg-slate-900/60">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a ticker symbol (e.g. AAPL) or jump to research module..."
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-xs font-mono focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Kbd>ESC</Kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Custom ticker match if user types something not in preset list */}
          {trimmed && !filteredTickers.find((t) => t.symbol === trimmed) && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 font-mono px-2 py-1">
                Custom Focus Ticker
              </div>
              <button
                type="button"
                onClick={handleSelectCustomTicker}
                className="w-full flex items-center justify-between px-3 py-2 rounded text-xs hover:bg-slate-800/70 text-left transition group"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-blue-400">${trimmed}</span>
                  <span className="text-slate-400 text-[11px]">Set as active single-asset context</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400" />
              </button>
            </div>
          )}

          {/* Tickers */}
          {filteredTickers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 font-mono px-2 py-1 flex items-center justify-between">
                <span>Instruments</span>
                <span className="text-[9px]">Select to set focus</span>
              </div>
              <div className="space-y-0.5">
                {filteredTickers.map((t) => {
                  const isCurrent = t.symbol === currentTicker;
                  return (
                    <button
                      key={t.symbol}
                      type="button"
                      onClick={() => {
                        onSelectTicker(t.symbol);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition ${
                        isCurrent
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                          : 'hover:bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono font-bold text-white tracking-wide">${t.symbol}</span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[240px]">{t.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {t.assetClass}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modules */}
          {filteredModules.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 font-mono px-2 py-1">
                Jump To Research Module
              </div>
              <div className="space-y-0.5">
                {filteredModules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectModule(m.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded text-xs hover:bg-slate-800/60 text-left transition group text-slate-200"
                  >
                    <div className="flex items-center space-x-2">
                      <Layers className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-400" />
                      <span className="font-medium text-slate-300 group-hover:text-white">{m.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{m.group}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {totalItems === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs font-mono">
              No matching tickers or research modules found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-8 px-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center space-x-3">
            <span><Kbd>↑↓</Kbd> Navigate</span>
            <span><Kbd>↵</Kbd> Select</span>
            <span><Kbd>ESC</Kbd> Close</span>
          </div>
          <span>Active: ${currentTicker}</span>
        </div>
      </div>
    </div>
  );
};
