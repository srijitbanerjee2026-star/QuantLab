'use client';

import React, { useState, useEffect } from 'react';
import { api, FeatureRecord } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, BarChart2, ShieldAlert, Cpu, Layers, Activity, Database, Play, RefreshCw, Save } from 'lucide-react';

export default function QuantLabDashboard() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'features' | 'backtest' | 'risk' | 'portfolio' | 'ml' | 'experiments'>('explorer');
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [featureData, setFeatureData] = useState<FeatureRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab 3: Backtest State
  const [shortWindow, setShortWindow] = useState<number>(20);
  const [longWindow, setLongWindow] = useState<number>(50);
  const [initialCapital, setInitialCapital] = useState<number>(10000);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState<boolean>(false);

  // Tab 4: Risk State
  const [riskFreeRate, setRiskFreeRate] = useState<number>(0.02);
  const [riskMetrics, setRiskMetrics] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState<boolean>(false);

  // Tab 5: Portfolio State
  const [portfolioSymbols, setPortfolioSymbols] = useState<string>('AAPL, MSFT, NVDA');
  const [portfolioResult, setPortfolioResult] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState<boolean>(false);

  // Tab 6: ML State
  const [modelType, setModelType] = useState<string>('random_forest');
  const [mlResult, setMlResult] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState<boolean>(false);

  // Tab 7: Experiments State
  const [experiments, setExperiments] = useState<any[]>([]);
  const [expLoading, setExpLoading] = useState<boolean>(false);
  const [expMessage, setExpMessage] = useState<string | null>(null);

  // Auto-register instrument & fetch market features
  const fetchMarketData = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/instruments/', {
        symbol: targetSymbol,
        name: `${targetSymbol} Stock`,
        asset_class: 'Equity',
        region: 'US',
        currency: 'USD',
      }).catch(() => {});

      await api.post(`/market-data/fetch/${targetSymbol}?start_date=2023-01-01`);
      const res = await api.get<FeatureRecord[]>(`/features/${targetSymbol}`);
      setFeatureData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to connect to QuantLab backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData(symbol);
  }, []);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (symbol.trim()) {
      fetchMarketData(symbol.trim().toUpperCase());
    }
  };

  // Run Strategy Backtest (Tab 3)
  const runBacktest = async () => {
    setBacktestLoading(true);
    try {
      const res = await api.post('/strategies/backtest', {
        symbol: symbol.toUpperCase(),
        strategy_type: 'sma_crossover',
        initial_capital: initialCapital,
        short_window: shortWindow,
        long_window: longWindow,
      });
      setBacktestResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Backtest failed');
    } finally {
      setBacktestLoading(false);
    }
  };

  // Run Risk Analysis (Tab 4)
  const runRiskAnalysis = async () => {
    setRiskLoading(true);
    try {
      const res = await api.post('/risk/analyze', {
        symbol: symbol.toUpperCase(),
        risk_free_rate: riskFreeRate,
      });
      setRiskMetrics(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Risk analysis failed');
    } finally {
      setRiskLoading(false);
    }
  };

  // Run Portfolio Optimization (Tab 5)
  const runPortfolioOptimization = async () => {
    setPortfolioLoading(true);
    try {
      const symList = portfolioSymbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      
      // Ensure all tickers are ingested
      for (const sym of symList) {
        await api.post('/instruments/', { symbol: sym, name: sym, asset_class: 'Equity', region: 'US', currency: 'USD' }).catch(() => {});
        await api.post(`/market-data/fetch/${sym}?start_date=2023-01-01`).catch(() => {});
      }

      const res = await api.post('/portfolio/optimize', {
        symbols: symList,
        risk_free_rate: riskFreeRate,
      });
      setPortfolioResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Portfolio optimization failed');
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Train ML Prediction Model (Tab 6)
  const runMLTraining = async () => {
    setMlLoading(true);
    try {
      const res = await api.post('/ml/train', {
        symbol: symbol.toUpperCase(),
        model_type: modelType,
        test_size: 0.2,
      });
      setMlResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'ML model training failed');
    } finally {
      setMlLoading(false);
    }
  };

  // Fetch Saved Experiments (Tab 7)
  const fetchExperiments = async () => {
    setExpLoading(true);
    try {
      const res = await api.get('/experiments/');
      setExperiments(res.data);
    } catch (err: any) {
      setError('Failed to fetch experiments list');
    } finally {
      setExpLoading(false);
    }
  };

  // Log Experiment to Supabase/DB (Tab 7)
  const saveCurrentExperiment = async () => {
    if (!backtestResult && !mlResult && !portfolioResult) {
      setExpMessage('Run a Backtest, ML Model, or Portfolio Optimization first to save an experiment.');
      return;
    }
    try {
      const payload = {
        name: `${symbol} ${backtestResult ? 'Backtest Run' : mlResult ? 'ML Run' : 'Portfolio Run'}`,
        experiment_type: backtestResult ? 'backtest' : mlResult ? 'ml_model' : 'portfolio_opt',
        parameters: { symbol, shortWindow, longWindow, modelType },
        metrics: backtestResult ? { total_return_pct: backtestResult.total_return_pct, sharpe_ratio: backtestResult.sharpe_ratio } : mlResult ? mlResult.metrics : portfolioResult?.max_sharpe,
      };
      await api.post('/experiments/', payload);
      setExpMessage('Experiment saved successfully!');
      fetchExperiments();
    } catch (err: any) {
      setError('Failed to save experiment.');
    }
  };

  useEffect(() => {
    if (activeTab === 'experiments') fetchExperiments();
    if (activeTab === 'risk' && !riskMetrics) runRiskAnalysis();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Workstation Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">QuantLab</h1>
            <p className="text-xs text-slate-400">Quantitative Research Workstation</p>
          </div>
        </div>

        {/* Global Asset Search */}
        <form onSubmit={handleSymbolSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Ticker (e.g. AAPL, MSFT, SPY)"
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500 uppercase"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded-md font-medium transition disabled:opacity-50"
          >
            {loading ? 'Ingesting...' : 'Load Asset'}
          </button>
        </form>
      </header>

      {/* Feature Navigation Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex space-x-1 overflow-x-auto">
        {[
          { id: 'explorer', label: '1. Market Explorer', icon: BarChart2 },
          { id: 'features', label: '2. Data Analysis', icon: TrendingUp },
          { id: 'backtest', label: '3. Strategy Backtesting', icon: Layers },
          { id: 'risk', label: '4. Risk Analysis', icon: ShieldAlert },
          { id: 'portfolio', label: '5. Portfolio Opt.', icon: Activity },
          { id: 'ml', label: '6. Prediction Models', icon: Cpu },
          { id: 'experiments', label: '7. Experiments', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-200 px-4 py-3 rounded-md text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs bg-red-800 px-2 py-1 rounded">Dismiss</button>
          </div>
        )}

        {/* Tab 1 & 2: Market Explorer & Technical Features */}
        {(activeTab === 'explorer' || activeTab === 'features') && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{symbol.toUpperCase()} Adjusted Close Price</h2>
                  <p className="text-xs text-slate-400">Historical price series with SMA-20 and SMA-50 overlays</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">
                    ${featureData.length > 0 ? featureData[featureData.length - 1].adj_close.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              <div className="h-80 w-full">
                {featureData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={featureData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(str) => str.substring(5)} />
                      <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Legend />
                      <Line type="monotone" dataKey="adj_close" stroke="#3b82f6" dot={false} strokeWidth={2} name="Price" />
                      <Line type="monotone" dataKey="sma_20" stroke="#10b981" dot={false} strokeWidth={1.5} name="SMA 20" />
                      <Line type="monotone" dataKey="sma_50" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="SMA 50" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    {loading ? 'Ingesting market data...' : 'No market data loaded'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-md font-semibold mb-2 text-white">Relative Strength Index (RSI-14)</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={featureData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(str) => str.substring(5)} />
                      <YAxis stroke="#94a3b8" domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Line type="monotone" dataKey="rsi_14" stroke="#a855f7" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-md font-semibold mb-2 text-white">Annualized 20-Day Volatility</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={featureData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(str) => str.substring(5)} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                      <Line type="monotone" dataKey="volatility_20d" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Strategy Backtesting */}
        {activeTab === 'backtest' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">SMA Crossover Backtest Controls</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Asset Ticker</label>
                  <input type="text" value={symbol} readOnly className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 w-full uppercase" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Short SMA Window</label>
                  <input type="number" value={shortWindow} onChange={(e) => setShortWindow(Number(e.target.value))} className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Long SMA Window</label>
                  <input type="number" value={longWindow} onChange={(e) => setLongWindow(Number(e.target.value))} className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Initial Capital ($)</label>
                  <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-2 w-full" />
                </div>
              </div>
              <button onClick={runBacktest} disabled={backtestLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium text-sm flex items-center space-x-2">
                <Play className="h-4 w-4" />
                <span>{backtestLoading ? 'Executing Backtest...' : 'Execute Vectorized Backtest'}</span>
              </button>
            </div>

            {backtestResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="text-xs text-slate-400">Total Return</p>
                    <p className={`text-xl font-bold ${backtestResult.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {backtestResult.total_return_pct}%
                    </p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="text-xs text-slate-400">Sharpe Ratio</p>
                    <p className="text-xl font-bold text-white">{backtestResult.sharpe_ratio}</p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="text-xs text-slate-400">Max Drawdown</p>
                    <p className="text-xl font-bold text-red-400">{(backtestResult.max_drawdown * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <p className="text-xs text-slate-400">Total Trades</p>
                    <p className="text-xl font-bold text-white">{backtestResult.total_trades}</p>
                  </div>
                </div>

                <h3 className="text-md font-semibold text-white">Backtest Strategy Equity Curve</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backtestResult.equity_curve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(str) => str.substring(5)} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      <Line type="monotone" dataKey="portfolio_value" stroke="#10b981" dot={false} strokeWidth={2} name="Portfolio Value" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Risk Analysis */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Portfolio Risk Metrics: {symbol}</h2>
                <button onClick={runRiskAnalysis} disabled={riskLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Calculate Risk</span>
                </button>
              </div>

              {riskMetrics ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Annualized Return</p>
                    <p className="text-2xl font-bold text-green-400">{(riskMetrics.annualized_return * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Annualized Volatility</p>
                    <p className="text-2xl font-bold text-amber-400">{(riskMetrics.annualized_volatility * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Sharpe Ratio</p>
                    <p className="text-2xl font-bold text-blue-400">{riskMetrics.sharpe_ratio}</p>
                  </div>
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Sortino Ratio</p>
                    <p className="text-2xl font-bold text-purple-400">{riskMetrics.sortino_ratio}</p>
                  </div>
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Maximum Drawdown</p>
                    <p className="text-2xl font-bold text-red-400">{(riskMetrics.max_drawdown * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Parametric VaR (95%)</p>
                    <p className="text-2xl font-bold text-red-400">{(riskMetrics.var_95 * 100).toFixed(2)}%</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Click "Calculate Risk" to generate quantitative metrics.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Portfolio Optimization */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Markowitz Mean-Variance Portfolio Optimization</h2>
              <div className="flex items-center space-x-4 mb-4">
                <input
                  type="text"
                  value={portfolioSymbols}
                  onChange={(e) => setPortfolioSymbols(e.target.value)}
                  placeholder="Enter comma separated tickers (e.g. AAPL, MSFT, NVDA)"
                  className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2 flex-1 uppercase"
                />
                <button onClick={runPortfolioOptimization} disabled={portfolioLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium text-sm">
                  {portfolioLoading ? 'Optimizing SLSQP...' : 'Optimize Portfolio'}
                </button>
              </div>

              {portfolioResult && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
                    <h3 className="text-md font-bold text-blue-400 mb-2">Equal Weight Baseline</h3>
                    <p className="text-sm text-slate-300">Exp. Return: {(portfolioResult.equal_weight.expected_return * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300">Volatility: {(portfolioResult.equal_weight.volatility * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300">Sharpe: {portfolioResult.equal_weight.sharpe_ratio}</p>
                  </div>

                  <div className="bg-slate-800 p-5 rounded-lg border border-emerald-600/50">
                    <h3 className="text-md font-bold text-emerald-400 mb-2">Max Sharpe Allocation</h3>
                    <p className="text-sm text-slate-300">Exp. Return: {(portfolioResult.max_sharpe.expected_return * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300">Volatility: {(portfolioResult.max_sharpe.volatility * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300 mb-3">Sharpe: {portfolioResult.max_sharpe.sharpe_ratio}</p>
                    <div className="text-xs space-y-1 border-t border-slate-700 pt-2">
                      {Object.entries(portfolioResult.max_sharpe.weights).map(([sym, w]: any) => (
                        <div key={sym} className="flex justify-between"><span>{sym}:</span><span className="font-bold text-emerald-400">{(w * 100).toFixed(1)}%</span></div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-800 p-5 rounded-lg border border-purple-600/50">
                    <h3 className="text-md font-bold text-purple-400 mb-2">Min Volatility Allocation</h3>
                    <p className="text-sm text-slate-300">Exp. Return: {(portfolioResult.min_volatility.expected_return * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300">Volatility: {(portfolioResult.min_volatility.volatility * 100).toFixed(2)}%</p>
                    <p className="text-sm text-slate-300 mb-3">Sharpe: {portfolioResult.min_volatility.sharpe_ratio}</p>
                    <div className="text-xs space-y-1 border-t border-slate-700 pt-2">
                      {Object.entries(portfolioResult.min_volatility.weights).map(([sym, w]: any) => (
                        <div key={sym} className="flex justify-between"><span>{sym}:</span><span className="font-bold text-purple-400">{(w * 100).toFixed(1)}%</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Machine Learning Prediction Models */}
        {activeTab === 'ml' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Scikit-Learn Price Prediction Engine</h2>
              <div className="flex items-center space-x-4 mb-4">
                <select value={modelType} onChange={(e) => setModelType(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md px-3 py-2">
                  <option value="random_forest">Random Forest Classifier (Direction: UP/DOWN)</option>
                  <option value="linear_regression">Linear Regression (Continuous Return)</option>
                </select>
                <button onClick={runMLTraining} disabled={mlLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium text-sm">
                  {mlLoading ? 'Training Model...' : 'Train Model'}
                </button>
              </div>

              {mlResult && (
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mt-6 space-y-4">
                  <h3 className="text-md font-bold text-white">Model Training Results: {mlResult.model_type.toUpperCase()}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(mlResult.metrics).map(([k, v]: any) => (
                      <div key={k} className="bg-slate-900 p-3 rounded">
                        <p className="text-xs text-slate-400 uppercase">{k}</p>
                        <p className="text-lg font-bold text-blue-400">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <p className="text-sm font-semibold text-white">Latest Next-Day Prediction Signal:</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-4 py-2 rounded font-bold text-lg ${mlResult.latest_prediction.signal === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {mlResult.latest_prediction.signal}
                      </span>
                      {mlResult.latest_prediction.confidence && (
                        <span className="text-sm text-slate-400">Confidence: {(mlResult.latest_prediction.confidence * 100).toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Experiments Dashboard */}
        {activeTab === 'experiments' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Supabase Experiment Persistence Layer</h2>
                <button onClick={saveCurrentExperiment} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Log Current Run</span>
                </button>
              </div>

              {expMessage && <p className="text-xs text-amber-400 mb-4">{expMessage}</p>}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800 text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Experiment Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Metrics Logged</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {experiments.map((exp) => (
                      <tr key={exp.id}>
                        <td className="px-4 py-3 font-mono text-xs">{exp.id}</td>
                        <td className="px-4 py-3 font-medium text-white">{exp.name}</td>
                        <td className="px-4 py-3"><span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded">{exp.experiment_type}</span></td>
                        <td className="px-4 py-3 font-mono text-xs">{JSON.stringify(exp.metrics)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(exp.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}